const getAmount = (value) => Number(String(value ?? 0).replace(/,/g, '')) || 0;
const hasValue = (value) => value !== undefined && value !== null && value !== '';

/**
 * 차량제원과 사용본거지를 TM_BOND 조회 파라미터로 변환하는 모듈.
 *
 * 이 함수들은 공채 금액을 직접 계산하지 않는다.
 * 운영 프로시저의 지역·차종 분기를 재현하여 TM_BOND에서 어느 요율 row를 조회할지 결정한다.
 *
 * CAR_GB 의미
 * - 1: 승용/경차
 * - 2: 승합
 * - 3: 화물
 * - e: 서울 전기 승용차의 크기 구간 조회
 *
 * baseValue는 차종과 지역에 따라 배기량, 승차정원, 적재량 또는 차체 크기 구간값이 된다.
 * 따라서 공채 요율이 0이거나 잘못 조회되면 계산식보다 먼저 이 함수의
 * area/carGb/baseValue와 TR_CAR_SPEC 제원값을 확인한다.
 *
 * 상세 운영·인수인계 문서: WA_신규등록_예상금액_처리_가이드.txt
 */

// 사용본거지 주소에서 프로시저 공채 분기에 사용할 지역명 가져옴.
const resolveBondArea = (baseAddress) => {
    const source = String(baseAddress ?? '').trim();
    const areas = [
        '경상남도 함양군', '경상남도 함안군', '경상남도 창원시',
        '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
        '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
        '강원도', '충청북도', '충청남도', '전북특별자치도', '전라북도',
        '전라남도', '경상북도', '경상남도', '제주특별자치도'
    ];
    return areas.find(area => source.startsWith(area)) || source.split(/\s+/)[0] || '';
};

// sp_NewCarTaxBondConfirm의 지역·차종별 TM_BOND 조회 기준 생성함.
// 반환값은 NewcarInfo.jsx가 GET /api/newcar/bond-rate 요청 파라미터로 사용한다.
export const resolveBondSearchCriteria = (newCar = {}) => {
    let area = resolveBondArea(newCar.BASE_ADDRESS);
    const carCc = Math.max(0, getAmount(newCar.CAR_CC));
    const passengers = Math.max(0, getAmount(newCar.GETIN_NO));
    const length = getAmount(newCar.LENGTH ?? newCar.CARLENGTH);
    const width = getAmount(newCar.WIDTH ?? newCar.CARWIDTH);
    const height = getAmount(newCar.HEIGHT ?? newCar.CARHEIGTH);
    const maxCap = getAmount(newCar.MAX_CAP ?? newCar.CARPAYLOAD ?? newCar.MXMM_LDG);
    const totalCap = getAmount(newCar.TOTAL_CAP ?? newCar.CARWEIGHT);
    const bodyType = String(newCar.VH_TY_CD ?? newCar.CAR_US_KD ?? '').trim();
    const fuelCode = String(newCar.FUEL_CD ?? '').trim().toLowerCase();
    const carTypeText = String(newCar.CAR_CD ?? newCar.CAR_KD ?? '').trim();
    const vehicleType = String(newCar.VHCTY_ASORT_CODE ?? '').trim();
    const carType = ['경차', '승용', '승합', '화물', '영업'].includes(carTypeText)
        ? carTypeText
        : (vehicleType === '2' ? '승합' : (vehicleType === '3' ? '화물' : '승용'));
    const multiPurpose = bodyType === '3';
    const electric = fuelCode === 'e' || fuelCode === 'q';
    const hasDimensions = [
        newCar.LENGTH ?? newCar.CARLENGTH,
        newCar.WIDTH ?? newCar.CARWIDTH,
        newCar.HEIGHT ?? newCar.CARHEIGTH
    ].every(hasValue);
    const small = hasDimensions && length <= 4700 && width <= 1700 && height <= 2000;
    const large = hasDimensions && length > 4700 && width > 1700 && height > 2000;
    let carGb;
    let baseValue;

    if (carType === '승용' || carType === '경차') {
        carGb = '1';
        baseValue = carCc;

        if (area === '서울특별시') {
            if (carType === '승용' && passengers >= 7 && passengers <= 10) {
                carGb = '2';
                baseValue = 1011;
            } else if (electric) {
                carGb = 'e';
                baseValue = multiPurpose && passengers < 7
                    ? 10000
                    : (small ? 500 : (large ? 5000 : 1500));
            } else if (multiPurpose) {
                baseValue = 10000;
            } else if (carCc < 1000) {
                baseValue = carCc;
            } else if (carCc >= 1000 && carCc < 1600 && small) {
                baseValue = carCc;
            } else if (carCc >= 2000 || large) {
                baseValue = carCc;
            } else {
                baseValue = 1800;
            }
        } else if (area === '부산광역시') {
            if ((carCc >= 2000 || large) && carType === '승용') baseValue = 20000;
            else if (multiPurpose) baseValue = 1000;
            else if (passengers >= 7 && passengers <= 10) baseValue = 20000;
        } else if (area === '대구광역시') {
            if (multiPurpose) baseValue = 1000;
            else if (passengers >= 7 && passengers <= 10) baseValue = 20000;
        } else if (['경상남도', '경상남도 함양군', '경상남도 함안군'].includes(area)) {
            area = '경상남도';
            if (passengers >= 7 && passengers <= 10) baseValue = 20000;
            else if (multiPurpose) baseValue = 1600;
        } else if (area === '인천광역시') {
            carGb = '1';
            if (electric && hasDimensions && (length > 4700 || width > 1700 || height > 2000)) {
                baseValue = 0;
            } else if (!electric) {
                if ((passengers >= 7 && passengers <= 10) || carCc < 2000) baseValue = 0;
                else if (carCc >= 2000) baseValue = multiPurpose ? 0 : 2000;
            }
        } else if (area === '제주특별자치도') {
            if (multiPurpose) baseValue = 1600;
            else if (passengers >= 7 && passengers <= 10) baseValue = 20000;
        }
    } else if (carType === '승합') {
        carGb = '2';
        if (['경상남도', '경상남도 함양군', '경상남도 함안군'].includes(area)) {
            area = '경상남도';
        }
        baseValue = passengers >= 11 ? passengers + 1000 : carCc;
        if (area === '인천광역시' && passengers >= 11) baseValue = 0;
        if ([
            '강원특별자치도', '경기도', '경상북도', '전라남도', '울산광역시',
            '대전광역시', '세종특별자치시', '광주광역시', '충청남도'
        ].includes(area)) {
            baseValue = carCc;
        }
    } else {
        carGb = '3';
        if (area === '서울특별시') {
            baseValue = String(newCar.CAR_NM ?? '').includes('Cybertruck')
                ? 3500
                : (totalCap >= 10000 ? 4700 : maxCap);
        } else if (carCc < 1000) {
            baseValue = 20000;
        } else if (area === '인천광역시') {
            baseValue = 0;
        } else {
            if (['경상남도 함양군', '경상남도 함안군'].includes(area)) area = '경상남도';
            baseValue = maxCap;
        }
        if (['경상북도', '충청남도', '대전광역시', '세종특별자치시'].includes(area)) {
            baseValue = carCc;
        }
    }

    return { area, carGb, baseValue, multiPurpose };
};

// TR_CAR_SPEC 조회 결과 중 TR_NEWCAR와 예상금액 계산에 필요한 필드만 추출함.
// 이 patch를 먼저 dsNewCar에 합쳐야 취득세 차량조건과 TM_BOND 검색조건이 같은 제원을 사용한다.
// 공급가액은 사용자가 직접 입력한 값이 있으면 유지하고, 없을 때만 제원 테이블 값을 사용한다.
// 새 제원 컬럼을 추가할 때는 아래 매핑뿐 아니라 resolveBondSearchCriteria()와
// buildNewcarEstimateKey()가 그 값을 계산/재계산 기준으로 사용하는지도 확인한다.
export const buildCarSpecPatch = (dsNewCar = {}, carSpec = {}) => {
    const preferValue = (...values) => values.find(
        value => value !== undefined && value !== null && value !== ''
    ) ?? '';
    const multiPurposeYn = preferValue(
        carSpec.MULTI_PURPOSE_YN,
        dsNewCar.MULTI_PURPOSE_YN
    );
    const carUseKind = String(preferValue(
        carSpec.CAR_US_KD,
        dsNewCar.CAR_US_KD
    )).trim();

    const patch = {
        CAR_NM: carSpec.CAR_NM ?? dsNewCar.CAR_NM ?? '',
        MADE_DT: carSpec.MADE_DT ?? dsNewCar.MADE_DT ?? '',
        MADE_YY: carSpec.MADE_YY ?? dsNewCar.MADE_YY ?? '',
        CAR_CC: carSpec.CAR_CC ?? dsNewCar.CAR_CC ?? '',
        GETIN_NO: carSpec.GETIN_NO ?? dsNewCar.GETIN_NO ?? '',
        CAR_KD: carSpec.CAR_KD ?? dsNewCar.CAR_KD ?? '',
        CAR_CD: carSpec.CAR_CD ?? dsNewCar.CAR_CD ?? '',
        CAR_KD_CD: carSpec.CAR_KD_CD ?? dsNewCar.CAR_KD_CD ?? '',
        FM_NM: carSpec.FM_NM ?? dsNewCar.FM_NM ?? '',
        FOM_NM: preferValue(carSpec.FOM_NM, dsNewCar.FOM_NM),
        FUEL_CD: carSpec.FUEL_CD ?? dsNewCar.FUEL_CD ?? '',
        LENGTH: preferValue(
            carSpec.CARLENGTH,
            carSpec.LENGTH,
            carSpec.CAR_LENGTH,
            dsNewCar.CARLENGTH,
            dsNewCar.LENGTH,
            dsNewCar.CAR_LENGTH
        ),
        WIDTH: preferValue(
            carSpec.CARWIDTH,
            carSpec.WIDTH,
            carSpec.CAR_WIDTH,
            dsNewCar.CARWIDTH,
            dsNewCar.WIDTH,
            dsNewCar.CAR_WIDTH
        ),
        HEIGHT: preferValue(
            carSpec.CARHEIGTH,
            carSpec.HEIGHT,
            carSpec.CAR_HEIGHT,
            dsNewCar.CARHEIGTH,
            dsNewCar.HEIGHT,
            dsNewCar.CAR_HEIGHT
        ),
        MAX_CAP: preferValue(
            carSpec.CARPAYLOAD,
            carSpec.MAX_CAP,
            carSpec.MXMM_LDG,
            dsNewCar.CARPAYLOAD,
            dsNewCar.MAX_CAP,
            dsNewCar.MXMM_LDG
        ),
        TOTAL_CAP: preferValue(
            carSpec.CARWEIGHT,
            carSpec.TOTAL_CAP,
            dsNewCar.CARWEIGHT,
            dsNewCar.TOTAL_CAP
        ),
        CAR_US_KD: carUseKind,
        MULTI_PURPOSE_YN: multiPurposeYn,
        VH_TY_CD: carUseKind || (
            String(multiPurposeYn).trim().toUpperCase() === 'Y'
                ? '3'
                : (dsNewCar.VH_TY_CD ?? '')
        ),
        BUY_AMT: getAmount(dsNewCar.BUY_AMT) > 0
            ? dsNewCar.BUY_AMT
            : (carSpec.BUY_AMT ?? 0),
        // 서버의 회사별 설정에서 가져온 차종구분으로 취득세율과 감면 차량조건을 적용함.
        VHCTY_ASORT_CODE: carSpec.VHCTY_ASORT_CODE ?? dsNewCar.VHCTY_ASORT_CODE ?? '',
        // 이전 차명으로 계산한 과세표준이 남지 않게 다시 산출함.
        STANDARD_AMT: 0,
        CAR_SPEC_MAKER: carSpec.MAKER ?? ''
    };

    return patch;
};
