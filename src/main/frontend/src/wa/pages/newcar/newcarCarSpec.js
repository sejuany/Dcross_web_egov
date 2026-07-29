const getAmount = (value) => Number(String(value ?? 0).replace(/,/g, '')) || 0;

// 사용본거지 주소에서 프로시저 공채 분기에 사용할 시도명 가져옴.
const resolveBondArea = (baseAddress) => {
    const source = String(baseAddress ?? '').trim();
    const areas = [
        '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
        '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
        '강원도', '충청북도', '충청남도', '전북특별자치도', '전라북도',
        '전라남도', '경상북도', '경상남도', '제주특별자치도'
    ];
    return areas.find(area => source.startsWith(area)) || source.split(/\s+/)[0] || '';
};

// 프로시저에서 TM_BOND 조회 전에 전기차 공채를 전액면제하는 지역인지 확인함.
// 해당 지역은 사용 가능한 매입률 행이 없어도 예상금액을 0원으로 계산해야 함.
export const isElectricBondLookupExemptArea = (baseAddress) => [
    '경기도', '부산광역시', '대구광역시', '경상남도'
].includes(resolveBondArea(baseAddress));

// sp_NewCarTaxBondConfirm의 승용 다목적형 지역별 TM_BOND 조회 기준 생성함.
// 폴스타는 전기 승용차이며 VH_TY_CD=3인 경우 아래 비교값으로 조회함.
export const resolveBondSearchCriteria = (newCar = {}) => {
    const area = resolveBondArea(newCar.BASE_ADDRESS);
    const carCc = Math.max(0, getAmount(newCar.CAR_CC));
    const passengers = Math.max(0, getAmount(newCar.GETIN_NO));
    const multiPurpose = String(newCar.VH_TY_CD ?? '').trim() === '3';

    if (!multiPurpose) {
        return { area, carGb: 'e', baseValue: carCc, multiPurpose };
    }

    if (area === '서울특별시') {
        // 서울 7~10인승 승용은 승합 기준, 그 외 다목적 전기차는 전기 다목적 기준 사용함.
        return passengers >= 7 && passengers <= 10
            ? { area, carGb: '2', baseValue: 1011, multiPurpose }
            : { area, carGb: 'e', baseValue: 10000, multiPurpose };
    }

    if (['부산광역시', '대구광역시'].includes(area)) {
        return { area, carGb: '1', baseValue: 1000, multiPurpose };
    }

    if (area === '경상남도') {
        return {
            area,
            carGb: '1',
            baseValue: passengers >= 7 && passengers <= 10 ? 20000 : 1600,
            multiPurpose
        };
    }

    if (area === '인천광역시') {
        return { area, carGb: '1', baseValue: 0, multiPurpose };
    }

    if (area === '제주특별자치도') {
        return { area, carGb: '1', baseValue: 1600, multiPurpose };
    }

    // 경기 및 별도 다목적 분기가 없는 지역은 프로시저처럼 승용 배기량 기준 사용함.
    return { area, carGb: '1', baseValue: carCc, multiPurpose };
};
// TR_CAR_SPEC 조회 결과 중 TR_NEWCAR와 예상금액 계산에 필요한 필드만 추출함.
// 공급가액은 사용자가 직접 입력한 값이 있으면 유지하고, 없을 때만 제원 테이블 값을 사용함.
export const buildCarSpecPatch = (dsNewCar = {}, carSpec = {}) => {
    const preferValue = (...values) => values.find(
        value => value !== undefined && value !== null && value !== ''
    ) ?? '';
    const multiPurposeYn = preferValue(
        carSpec.MULTI_PURPOSE_YN,
        dsNewCar.MULTI_PURPOSE_YN
    );

    const patch = {
        CAR_NM: carSpec.CAR_NM ?? dsNewCar.CAR_NM ?? '',
        MADE_DT: carSpec.MADE_DT ?? dsNewCar.MADE_DT ?? '',
        MADE_YY: carSpec.MADE_YY ?? dsNewCar.MADE_YY ?? '',
        CAR_CC: carSpec.CAR_CC ?? dsNewCar.CAR_CC ?? '',
        GETIN_NO: carSpec.GETIN_NO ?? dsNewCar.GETIN_NO ?? '',
        CAR_KD: carSpec.CAR_KD ?? dsNewCar.CAR_KD ?? '',
        CAR_KD_CD: carSpec.CAR_KD_CD ?? dsNewCar.CAR_KD_CD ?? '',
        FM_NM: carSpec.FM_NM ?? dsNewCar.FM_NM ?? '',
        FOM_NM: preferValue(carSpec.FOM_NM, dsNewCar.FOM_NM),
        FUEL_CD: carSpec.FUEL_CD ?? dsNewCar.FUEL_CD ?? '',
        LENGTH: preferValue(
            carSpec.LENGTH,
            carSpec.CAR_LENGTH,
            dsNewCar.LENGTH,
            dsNewCar.CAR_LENGTH
        ),
        WIDTH: preferValue(
            carSpec.WIDTH,
            carSpec.CAR_WIDTH,
            dsNewCar.WIDTH,
            dsNewCar.CAR_WIDTH
        ),
        HEIGHT: preferValue(
            carSpec.HEIGHT,
            carSpec.CAR_HEIGHT,
            dsNewCar.HEIGHT,
            dsNewCar.CAR_HEIGHT
        ),
        MAX_CAP: preferValue(
            carSpec.MAX_CAP,
            carSpec.MXMM_LDG,
            dsNewCar.MAX_CAP,
            dsNewCar.MXMM_LDG
        ),
        TOTAL_CAP: preferValue(carSpec.TOTAL_CAP, dsNewCar.TOTAL_CAP),
        MULTI_PURPOSE_YN: multiPurposeYn,
        VH_TY_CD: String(multiPurposeYn).trim().toUpperCase() === 'Y'
            ? '3'
            : (dsNewCar.VH_TY_CD ?? ''),
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
