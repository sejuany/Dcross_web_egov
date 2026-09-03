// 신규등록 예상금액 계산 전용 모듈
/**
 * 신규등록 예상금액 계산 전용 모듈.
 *
 * 전체 호출 순서
 * 1. NewcarInfo.jsx가 차량명으로 TR_CAR_SPEC, WORK_CD=010의 TM_TAX를 조회한다.
 * 2. 차량제원과 사용본거지로 TM_BOND 조회 조건을 만들고 현재 공채 매입률을 조회한다.
 * 3. 조회값을 dsNewCar에 임시로 합쳐 calculateNewcarEstimate()를 한 번 호출한다.
 * 4. 반환된 금액은 화면 요약 카드와 TR_NEWCAR/TR_PAYMENT 저장값에 함께 반영된다.
 *
 * 이 파일은 서버 호출이나 React state 변경을 하지 않는 순수 계산 모듈이다.
 * 계산 규칙을 바꿀 때는 화면에 별도 계산식을 추가하지 말고 이 파일과 단위 테스트를 같이 수정한다.
 * 취득세 친환경 감면과 공채 친환경 감면은 대상 차량/지역 규칙이 서로 다르므로 합치지 않는다.
 *
 * 상세 운영·인수인계 문서: WA_신규등록_예상금액_처리_가이드.txt
 */
const ROUND_UNIT = 10;

// 결제항목 표시/정렬 순서
// 서버 NewcarService.getPaymentList()의 초기 결제항목 순서와 맞춤.
export const PAYMENT_ORDER = [
    'ACQ',
    'BFEE',
    'BOND',
    'FEE',
    'INJI',
    'SPARE',
    'STAMP',
    'TNUM',
    'UNUM',
    'UREG'
];

// 예상금액 계산 시 반드시 만들어둘 결제항목 목록
// 기존 TR_PAYMENT row가 없더라도 화면에서 예상금액 표를 구성할 수 있게 기본 row 생성함.
const ESTIMATE_PAYMENT_KINDS = [
    'ACQ',
    'BFEE',
    'BOND',
    'FEE',
    'INJI',
    'SPARE',
    'STAMP',
    'TNUM',
    'UNUM',
    'UREG'
];

// TM_TAX 세율이 아직 프론트로 내려오지 않을 때 쓰는 기본값
// 실제 운영 세율은 dsNewCar.ACQ*_PER 또는 codes.TM_TAX/TAX/taxInfo 값으로 덮어씀.
const DEFAULT_TAX_RATES = {
    ACQ1_PER: 0.07,
    ACQ2_PER: 0.05,
    ACQ3_PER: 0.05,
    ACQ210_PER: 0.05,
    ACQ211_PER: 0.05,
    ACQ0_PER: 0
};

// 계산 기본 설정값
// 지역/관청/업체별 요율이 확인되면 codes.NEWCAR_AMOUNT_CONFIG로 내려서 덮어쓰면 됨.
const DEFAULT_CALC_CONFIG = {
    bondRate: 0.2,
    bondDiscountRate: 0.1,
    bondFeeRate: 0.003,
    bondFeeBaseAmount: 0,
    stampAmount: 2500,
    injiAmount: 3000
};
// 감면대상 정보.xlsx와 공통코드 NTTCD의 감면 코드 매핑
// 서버에서 코드명만 다르게 내려오는 경우에도 이름으로 같은 규칙을 찾을 수 있게 함께 관리함.
const EXEMPTION_NAMES = {
    '01': '국가유공자',
    '02': '5.18 민주화운동대상',
    '03': '고엽제 후유증 대상',
    '04': '장애인',
    '05': '시각장애',
    '06': '다자녀(3자녀)',
    '09': '교환자동차 감면',
    '11': '수출용중고자동차',
    '12': '공동경비구역(JSA) 거주자',
    '13': '비영리사업자',
    '14': '보훈보상대상자',
    '15': '다자녀(2자녀)',
    '16': '다자녀3 + 장애인(중복감면)',
    '17': '다자녀3 + 시각장애(중복감면)',
    '18': '다자녀2 + 장애인(중복감면)',
    '19': '다자녀2 + 시각장애(중복감면)',
    EV: '전기자동차'
};

const normalizeExemptionName = (value) => String(value ?? '').replace(/\s+/g, '').trim();
const EXEMPTION_CODES_BY_NAME = Object.entries(EXEMPTION_NAMES).reduce((result, [code, name]) => {
    result[normalizeExemptionName(name)] = code;
    return result;
}, {});

// 금액 문자열에서 쉼표 제거 후 숫자로 변환함.
export const getNumber = (value) => Number(String(value ?? 0).replace(/,/g, '')) || 0;

// 0도 정상 설정값으로 인정하도록 null/빈 문자열만 누락으로 판단함.
const hasValue = (value) => value !== undefined && value !== null && value !== '';

// 원 단위 금액은 소수점 이하를 절사하고 표시함.
export const formatAmount = (value) => Math.trunc(getNumber(value)).toLocaleString();

// 첨부 금액처리 로직 기준으로 10원 단위 절사함.
const roundDown = (value, unit = ROUND_UNIT) => Math.floor(getNumber(value) / unit) * unit;

// 기존 결제 row 금액을 우선 사용하고, 없을 때만 fallback 금액 사용함.
const getPaymentAmount = (paymentList, payKd, fallback = 0) => {
    const item = paymentList.find(row => row.PAY_KD === payKd);
    const amount = item?.PAY_AMT ?? item?.PRE_PAY_AMT;
    return amount === undefined || amount === null || amount === '' ? fallback : getNumber(amount);
};

// 결제항목을 서버 초기 순서와 동일하게 정렬함.
export const sortPaymentRows = (rows) => [...rows].sort((a, b) => {
    const left = PAYMENT_ORDER.indexOf(a.PAY_KD);
    const right = PAYMENT_ORDER.indexOf(b.PAY_KD);
    return (left === -1 ? 999 : left) - (right === -1 ? 999 : right);
});

// 예상금액 계산용 결제 row 목록 생성함.
// 1. 서버/저장 데이터에 이미 있는 결제 row는 유지함.
// 2. 없는 결제항목은 기본 row로 채움.
// 3. 예상 계산 대상이 아닌 추가 row는 뒤에 그대로 붙임.
const buildPaymentRows = (paymentList) => {
    const rows = Array.isArray(paymentList) ? paymentList.filter(row => row?.PAY_KD) : [];
    const rowByKind = new Map(rows.map(row => [row.PAY_KD, row]));

    const estimateRows = ESTIMATE_PAYMENT_KINDS.map(payKd => ({
        PAY_KD: payKd,
        VBANK_NO: '',
        PAY_OP: 'Y',
        PRE_PAY_AMT: 0,
        PAY_AMT: 0,
        PAY_ST: 'N',
        PAY_DT: '',
        ...(rowByKind.get(payKd) || {})
    }));

    const extraRows = rows.filter(row => !ESTIMATE_PAYMENT_KINDS.includes(row.PAY_KD));
    return [...estimateRows, ...extraRows];
};

// 카드납부 토글 시 총액만 다시 계산함.
// 취득세(ACQ)는 카드납부 대상이므로 CARD_YN=Y일 때 총 입금액에서 제외함.
export const calculateTotalFromRows = (paymentList, cardYn) => {
    const rows = Array.isArray(paymentList) ? paymentList.filter(row => row?.PAY_KD) : [];

    if (!rows.length) {
        return null;
    }

    return rows.reduce((sum, row) => {
        if (cardYn === 'Y' && row.PAY_KD === 'ACQ') {
            return sum;
        }

        return sum + getNumber(row.PAY_AMT ?? row.PRE_PAY_AMT);
    }, 0);
};

// 취득세율 정보 가져옴.
// 우선순위: dsNewCar 직접값 > codes 세율값 > DEFAULT_TAX_RATES 기본값.
const getTaxInfo = ({ dsNewCar = {}, codes = {} }) => {
    const fromCodes = dsNewCar.TM_TAX_INFO || codes.TM_TAX || codes.TAX || codes.taxInfo || {};
    return {
        ...DEFAULT_TAX_RATES,
        ...fromCodes,
        ACQ1_PER: dsNewCar.ACQ1_PER ?? fromCodes.ACQ1_PER ?? DEFAULT_TAX_RATES.ACQ1_PER,
        ACQ2_PER: dsNewCar.ACQ2_PER ?? fromCodes.ACQ2_PER ?? DEFAULT_TAX_RATES.ACQ2_PER,
        ACQ3_PER: dsNewCar.ACQ3_PER ?? fromCodes.ACQ3_PER ?? DEFAULT_TAX_RATES.ACQ3_PER,
        ACQ210_PER: dsNewCar.ACQ210_PER ?? fromCodes.ACQ210_PER ?? DEFAULT_TAX_RATES.ACQ210_PER,
        ACQ211_PER: dsNewCar.ACQ211_PER ?? fromCodes.ACQ211_PER ?? DEFAULT_TAX_RATES.ACQ211_PER,
        ACQ0_PER: dsNewCar.ACQ0_PER ?? fromCodes.ACQ0_PER ?? DEFAULT_TAX_RATES.ACQ0_PER
    };
};

// 7, 20 같은 퍼센트 숫자와 0.07, 0.2 같은 소수 입력을 모두 허용함.
const normalizePercent = (value) => {
    const rate = getNumber(value);
    return rate > 1 ? rate / 100 : rate;
};
// TM_TAX의 BASE 컬럼에 따라 정액 또는 과세표준 비율 금액 계산함.
// STAMP는 증지대, REGIST는 인지세 결제항목에 각각 반영함.
const resolveTaxCharge = ({ taxInfo, prefix, taxableStandard, fallback = 0 }) => {
    const amountField = `${prefix}_AMT`;
    const percentField = `${prefix}_PER`;
    const baseField = `${prefix}_BASE`;
    const base = String(taxInfo?.[baseField] ?? '').trim().toUpperCase();

    if (base === percentField && hasValue(taxInfo?.[percentField])) {
        return roundDown(taxableStandard * normalizePercent(taxInfo[percentField]));
    }

    if (base === amountField && hasValue(taxInfo?.[amountField])) {
        return getNumber(taxInfo[amountField]);
    }

    // BASE 값이 비어 있는 기존 데이터는 정액값을 우선 사용함.
    if (hasValue(taxInfo?.[amountField])) {
        return getNumber(taxInfo[amountField]);
    }

    return getNumber(fallback);
};
// 숫자형 감면코드는 두 자리 문자열로 통일함.
// 예: 4, '4', '04' 모두 '04'로 처리함.
const normalizeExemptionCode = (value) => {
    const code = String(value ?? '').trim();

    if (!code) {
        return '';
    }

    return /^\d+$/.test(code) ? code.padStart(2, '0') : code;
};

// 화면에서 선택한 NTTCD 코드 가져옴.
// 알 수 없는 코드가 내려오면 해당 옵션의 코드명을 이용해 엑셀 기준 코드로 다시 매핑함.
const resolveExemptionCode = (dsNewCar, codes) => {
    const selectedCode = normalizeExemptionCode(dsNewCar.NTAX_TRGET_CD);

    // 화면의 빈 값도 프로시저의 비과세 미적용 코드 '00'과 같은 의미다.
    if (!selectedCode) {
        return '00';
    }

    if (selectedCode === '00' || EXEMPTION_NAMES[selectedCode]) {
        return selectedCode;
    }

    const options = Array.isArray(codes?.NTTCD) ? codes.NTTCD : [];
    const selectedOption = options.find(option => normalizeExemptionCode(
        option?.CODE_ID ?? option?.value ?? option?.CD
    ) === selectedCode);
    const selectedName = selectedOption?.CODE_NM ?? selectedOption?.label ?? selectedOption?.NAME;

    return EXEMPTION_CODES_BY_NAME[normalizeExemptionName(selectedName)] || selectedCode;
};

// 차량 분류코드 또는 차종명으로 승용/승합/화물/특수/이륜 구분함.
// 원부 연계값 VHCTY_ASORT_CODE가 있으면 최우선 사용함.
const resolveVehicleType = (dsNewCar) => {
    const rawType = String(
        dsNewCar.VHCTY_ASORT_CODE
        ?? dsNewCar.VEHICLE_ASORT_CODE
        ?? dsNewCar.CAR_ASORT_CD
        ?? ''
    ).trim();

    if (['1', '2', '3', '4', '5'].includes(rawType)) {
        return rawType;
    }

    const vehicleText = [dsNewCar.CAR_KD ?? '', dsNewCar.CAR_NM ?? ''].join(' ');

    if (vehicleText.includes('이륜')) {
        return '5';
    }
    if (vehicleText.includes('승합')) {
        return '2';
    }
    if (vehicleText.includes('화물')) {
        return '3';
    }
    if (vehicleText.includes('특수')) {
        return '4';
    }

    return '1';
};

// 프로시저의 CAR_CD 값으로 승용/승합/화물/경차/영업 구분함.
const resolveProcedureCarType = (dsNewCar) => {
    const explicitType = String(dsNewCar.CAR_CD ?? dsNewCar.CAR_KD ?? '').trim();
    if (['승용', '승합', '화물', '경차', '영업'].includes(explicitType)) {
        return explicitType;
    }

    const vehicleType = resolveVehicleType(dsNewCar);
    if (vehicleType === '2') return '승합';
    if (vehicleType === '3') return '화물';
    if (String(dsNewCar.CAR_KD_CD ?? '').trim() === '4' && getNumber(dsNewCar.CAR_CC) <= 1000) {
        return '경차';
    }
    return '승용';
};

// sp_NewCarTaxBondConfirm의 PROC_CD/TASK_CD/차종별 세율.
const resolveProcedureTaxRates = (dsNewCar) => {
    const carType = resolveProcedureCarType(dsNewCar);
    if (String(dsNewCar.PROC_CD ?? '').trim() === 'C') {
        const uregRate = String(dsNewCar.TASK_CD ?? '').trim() === 'ADD'
            ? 0.02
            : (['경차', '영업'].includes(carType)
                ? 0.02
                : (['승합', '화물'].includes(carType) ? 0.03 : 0.05));
        return { acqRate: 0.02, uregRate, acqRateField: 'PROCEDURE' };
    }

    const acqRate = ['경차', '영업'].includes(carType)
        ? 0.04
        : (['승합', '화물'].includes(carType) ? 0.05 : 0.07);
    return { acqRate, uregRate: null, acqRateField: 'PROCEDURE' };
};

// 감면 차량조건에 필요한 최대적재량 가져옴.
// 원부 연계 응답별 필드명이 다른 경우를 고려해 사용 가능한 값을 순서대로 확인함.
const getMaxLoad = (dsNewCar) => getNumber(
    dsNewCar.MXMM_LDG
    ?? dsNewCar.MAX_LOAD
    ?? dsNewCar.MAX_LOAD_AMT
    ?? dsNewCar.LOAD_AMT
);

// 국가유공자·장애인·보훈보상대상자 등에 공통으로 쓰는 차량조건 확인함.
// 엑셀 참고사항의 배기량, 승차정원, 최대적재량 기준을 그대로 적용함.
const resolveSpecialVehicleEligibility = (dsNewCar) => {
    const vehicleType = resolveVehicleType(dsNewCar);
    const carCcValue = dsNewCar.CAR_CC;
    const carCc = getNumber(carCcValue);
    const carCcPresent = hasValue(carCcValue);
    const passengers = getNumber(dsNewCar.GETIN_NO);
    const maxLoad = getMaxLoad(dsNewCar);

    if (vehicleType === '1') {
        // 전기차의 0cc도 프로시저의 "2000cc 이하" 조건에 포함함.
        if ((carCcPresent && carCc <= 2000) || passengers >= 7) {
            return { eligible: true, reason: '감면 차량조건 충족' };
        }
        return {
            eligible: false,
            reason: '승용차 감면 차량조건 미충족',
            missingRequirements: carCcPresent ? [] : ['배기량(CAR_CC)']
        };
    }

    if (vehicleType === '2') {
        return passengers > 0 && passengers <= 15
            ? { eligible: true, reason: '15인승 이하 승합차' }
            : {
                eligible: false,
                reason: '승합차 감면 차량조건 미충족',
                missingRequirements: passengers ? [] : ['승차정원(GETIN_NO)']
            };
    }

    if (vehicleType === '3') {
        return hasValue(dsNewCar.MXMM_LDG ?? dsNewCar.MAX_CAP ?? dsNewCar.CARPAYLOAD) && maxLoad <= 1000
            ? { eligible: true, reason: '최대적재량 1톤 이하 화물차' }
            : {
                eligible: false,
                reason: '화물차 감면 차량조건 확인 필요',
                missingRequirements: ['최대적재량(MXMM_LDG)']
            };
    }

    return { eligible: false, reason: '감면 대상 차량 종류 아님', missingRequirements: [] };
};

// 감면 계산 결과 형식 통일함.
// 납부세액은 감면 전 세액 범위 안으로 제한하고 감면액은 차액으로 계산함.
const buildExemptionResult = ({
    code = '',
    grossAcqTax,
    payableAcqTax = grossAcqTax,
    reason = '',
    missingRequirements = []
}) => {
    const payable = Math.min(grossAcqTax, Math.max(0, getNumber(payableAcqTax)));
    const reduction = Math.max(0, grossAcqTax - payable);

    return {
        code,
        name: EXEMPTION_NAMES[code] || '',
        grossAcqTax,
        acqReductionAmt: reduction,
        acqTax: payable,
        applied: reduction > 0,
        reason,
        missingRequirements,
        // 취득세 전액면제는 8, 일부감면은 확인필요 코드 11로 저장함.
        ntaxApplyCode: reduction >= grossAcqTax && grossAcqTax > 0 ? '8' : (reduction > 0 ? '11' : '0')
    };
};

// 감면대상 정보.xlsx 기준으로 취득세 감면 적용함.
// 차량조건이나 기존 차량 세액이 부족한 유형은 세액을 임의 면제하지 않고 확인 필요값 반환함.
const resolveAcqTaxExemption = ({ dsNewCar, codes, grossAcqTax }) => {
    const code = resolveExemptionCode(dsNewCar, codes);
    const carType = resolveProcedureCarType(dsNewCar);
    const passengers = getNumber(dsNewCar.GETIN_NO);
    const passengersPresent = hasValue(dsNewCar.GETIN_NO);
    const maxLoad = getMaxLoad(dsNewCar);
    const unchanged = (reason = '', missingRequirements = []) => buildExemptionResult({
        code,
        grossAcqTax,
        reason,
        missingRequirements
    });

    if (!code || code === '00' || code === '10') {
        return unchanged();
    }

    // 보훈보상대상자는 감면 차량조건을 충족하면 취득세의 50%만 면제한다.
    if (code === '14') {
        const eligibility = resolveSpecialVehicleEligibility(dsNewCar);
        return eligibility.eligible
            ? buildExemptionResult({
                code,
                grossAcqTax,
                payableAcqTax: grossAcqTax * 0.5,
                reason: '보훈보상대상자 취득세 50% 감면'
            })
            : unchanged(eligibility.reason, eligibility.missingRequirements);
    }

    // 프로시저의 일반 비과세 대상: 3자녀·침수·이용자명의리스·2자녀를 제외한 코드.
    if (!['06', '07', '10', '15'].includes(code)) {
        const grade = getNumber(dsNewCar.NTAX_TRGET_GR_CD);
        if ((code === '04' && grade > 3) || (code === '05' && grade > 4)) {
            return unchanged('선택한 장애등급은 취득세 면제 대상 아님');
        }

        // 운영 프로시저는 인천 시각장애 4급이 200만원 이상일 때만 15% 과세함.
        if (resolveBondArea(dsNewCar) === '인천광역시' && code === '05' && String(dsNewCar.NTAX_TRGET_GR_CD) === '4') {
            return grossAcqTax >= 2000000
                ? buildExemptionResult({
                    code,
                    grossAcqTax,
                    payableAcqTax: grossAcqTax * 0.15,
                    reason: '인천 시각장애 4급 취득세 15% 과세'
                })
                : unchanged('인천 시각장애 4급 200만원 미만 프로시저 기준 세액 유지');
        }

        const eligibility = resolveSpecialVehicleEligibility(dsNewCar);
        return eligibility.eligible
            ? buildExemptionResult({ code, grossAcqTax, payableAcqTax: 0, reason: eligibility.reason })
            : unchanged(eligibility.reason, eligibility.missingRequirements);
    }

    if (code === '06') {
        if (carType === '승용' && passengersPresent && passengers <= 6) {
            return buildExemptionResult({
                code,
                grossAcqTax,
                payableAcqTax: grossAcqTax - Math.min(grossAcqTax, 1400000),
                reason: '3자녀 승용차 취득세 최대 140만원 감면'
            });
        }
        const eligible = (carType === '승용' && passengers >= 7)
            || (carType === '승합' && passengersPresent && passengers <= 15)
            || (carType === '화물' && hasValue(dsNewCar.MAX_CAP ?? dsNewCar.CARPAYLOAD ?? dsNewCar.MXMM_LDG) && maxLoad <= 1000);
        return eligible
            ? buildExemptionResult({
                code,
                grossAcqTax,
                payableAcqTax: grossAcqTax >= 2000000 ? grossAcqTax * 0.15 : 0,
                reason: grossAcqTax >= 2000000 ? '3자녀 취득세 15% 과세' : '3자녀 취득세 전액면제'
            })
            : unchanged('3자녀 감면 차량조건 미충족');
    }

    if (code === '15') {
        let reduction = grossAcqTax * 0.5;
        if (carType === '승용' && passengersPresent && passengers <= 6) {
            reduction = Math.min(reduction, 700000);
        }
        return buildExemptionResult({
            code,
            grossAcqTax,
            payableAcqTax: grossAcqTax - reduction,
            reason: '2자녀 취득세 50% 감면'
        });
    }

    return unchanged('침수차량 취득세 확인 필요');
};

// 전기·수소차 여부와 운영 프로시저의 친환경 감면 대상 여부를 분리함.
// resolveEcoEligibility()는 취득세용 acquisitionEligible과 공채용 bondEligible을 따로 반환한다.
// 특정 차명이 취득세 친환경 감면에서 제외되더라도 지역별 공채 감면은 받을 수 있으므로
// 예외 차명을 bondEligible에도 적용하면 안 된다.
const isElectricVehicle = (dsNewCar) => {
    const fuelCode = String(dsNewCar.FUEL_CD ?? '').trim().toLowerCase();
    const maker = String(dsNewCar.CAR_SPEC_MAKER ?? dsNewCar.MAKER ?? '').replace(/\s+/g, '').toUpperCase();
    return ['e', 'q', 'r'].includes(fuelCode) || maker === 'POLESTAR';
};
const isElectricOrHydrogen = (dsNewCar) => ['e', 'q'].includes(
    String(dsNewCar.FUEL_CD ?? '').trim().toLowerCase()
);
const isHybridFuel = (dsNewCar) => {
    const fuelCode = String(dsNewCar.FUEL_CD ?? '').trim().toLowerCase();
    return fuelCode >= 'l' && fuelCode <= 'p';
};
const pipeContains = (pipeValues, value) => {
    if (!hasValue(pipeValues) || !hasValue(value)) return false;
    return String(pipeValues).includes('|' + String(value) + '|');
};
const normalizeCarName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
const ORIGINAL_ECO_EXCLUDED_CAR_NAME = normalizeCarName('타이칸 크로스 투리스모 터보 (5인승)');

const resolveEcoEligibility = ({ dsNewCar = {}, codes = {} }) => {
    const taxInfo = getTaxInfo({ dsNewCar, codes });
    const fmExclusions = taxInfo.HYBRID_FM_EXCLUSIONS ?? taxInfo.HYBRID ?? '';
    const enginePatterns = taxInfo.HYBRID_OK_PATTERNS ?? taxInfo.HYB_OK ?? '';
    const fmName = String(dsNewCar.FM_NM ?? '').trim();
    const fomName = String(dsNewCar.FOM_NM ?? '').trim();
    const carName = normalizeCarName(dsNewCar.CAR_NM);
    const hasEcoConfig = hasValue(fmExclusions) || hasValue(enginePatterns);
    const fmExcluded = pipeContains(fmExclusions, fmName);
    const originalNameExcluded = carName === ORIGINAL_ECO_EXCLUDED_CAR_NAME;
    const engineEligible = pipeContains(enginePatterns, fomName)
        || pipeContains(enginePatterns, fomName + '{' + fmName.slice(0, 5) + '}');
    const baseEligible = hasEcoConfig
        ? (!fmExcluded && !originalNameExcluded && engineEligible)
        : isElectricVehicle(dsNewCar);

    return {
        acquisitionEligible: baseEligible
            && !originalNameExcluded
            && String(dsNewCar.ECO_YN ?? '').trim().toUpperCase() !== 'N',
        bondEligible: baseEligible
    };
};

// 화면 안내와 예상금액 계산이 동일한 친환경 취득세 대상 판정을 사용한다.
export const isEcoAcquisitionEligible = ({ dsNewCar = {}, codes = {} }) => (
    resolveEcoEligibility({ dsNewCar, codes }).acquisitionEligible
);

// 일반 감면과 친환경차 감면은 프로시저처럼 중복 적용하지 않음.
// 2자녀 또는 취득세 면제 대상이 아닌 장애등급은 더 큰 전기차 감면으로 교체함.
const applyEcoAcqTaxExemption = ({
    dsNewCar,
    codes,
    grossAcqTax,
    targetExemptionResult,
    ecoEligibility
}) => {
    const targetCode = targetExemptionResult.code;
    const taxInfo = getTaxInfo({ dsNewCar, codes });

    if (isHybridFuel(dsNewCar)
        && String(taxInfo.BUBYN ?? '').trim() === 'N'
        && ecoEligibility.acquisitionEligible
        && (!targetCode || targetCode === '00')) {
        return buildExemptionResult({
            code: 'EV',
            grossAcqTax,
            payableAcqTax: grossAcqTax - Math.min(grossAcqTax, 400000),
            reason: '하이브리드 취득세 40만원 감면'
        });
    }

    if (!isElectricOrHydrogen(dsNewCar)) {
        return targetExemptionResult;
    }

    const taycanFallback = normalizeCarName(dsNewCar.CAR_NM) !== ORIGINAL_ECO_EXCLUDED_CAR_NAME
        && getNumber(dsNewCar.GETIN_NO) === 5
        && String(dsNewCar.CAR_NM ?? '').includes('타이칸');
    if (!ecoEligibility.acquisitionEligible && !taycanFallback) {
        return targetExemptionResult;
    }

    // 장애등급 자체 감면이 적용되지 않은 경우에는 별도 자격인 전기차 감면을 적용한다.
    const disabilityExemptionNotApplied = ['04', '05'].includes(targetCode)
        && targetExemptionResult.acqReductionAmt === 0;
    if (targetCode && !['00', '15'].includes(targetCode) && !disabilityExemptionNotApplied) {
        return targetExemptionResult;
    }

    const electricResult = buildExemptionResult({
        code: 'EV',
        grossAcqTax,
        payableAcqTax: grossAcqTax - Math.min(grossAcqTax, 1400000),
        reason: '전기자동차 취득세 최대 140만원 감면'
    });

    return targetExemptionResult.acqReductionAmt >= electricResult.acqReductionAmt
        ? targetExemptionResult
        : electricResult;
};

// 현재 예상금액의 과세표준은 운영 요청에 따라 차량 세금계산서 금액(BUY_AMT)만 사용한다.
// STANDARD_AMT는 계산 결과를 저장하는 필드이므로 입력 기준으로 다시 사용하지 않는다.
// 향후 신고가액/시가표준액 비교 규칙을 도입하면 이 함수와 buildNewcarEstimateKey(), 테스트를 함께 수정한다.
const resolveTaxableStandard = (dsNewCar) => getNumber(dsNewCar.BUY_AMT);

// 번호판대 계산함.
// 이미 TR_PAYMENT에 금액이 있으면 해당 금액 유지하고, 없을 때만 현재 화면의 간단 규칙 사용함.
const resolveNumplateAmount = (dsNewCar, paymentRows) => {
    const existingAmount = getPaymentAmount(paymentRows, 'TNUM', 0);

    if (existingAmount) {
        return existingAmount;
    }

    if (dsNewCar.NUMPLATE_GB === 'F') {
        return 28600;
    }

    if (dsNewCar.NUMPLATE_GB === '7') {
        return 31400;
    }

    return 0;
};

// TM_BOND 조회 지역명과 사용본거지 주소에서 프로시저 지역명 가져옴.
const resolveBondArea = (dsNewCar) => {
    const source = String(dsNewCar.BOND_AREA ?? dsNewCar.BASE_ADDRESS ?? '').trim();
    const areas = [
        '경상남도 함양군', '경상남도 함안군', '경상남도 창원시',
        '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
        '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
        '강원도', '충청북도', '충청남도', '전북특별자치도', '전라북도',
        '전라남도', '경상북도', '경상남도', '제주특별자치도'
    ];
    return areas.find(candidate => source.startsWith(candidate)) || source.split(/\s+/)[0] || '';
};

// TM_BOND 조회 전에 끝나는 운영 프로시저의 공채 전액면제 조건.
export const resolveBondPreExemption = (dsNewCar = {}, codes = {}) => {
    const area = resolveBondArea(dsNewCar);
    const carType = resolveProcedureCarType(dsNewCar);
    const carCc = getNumber(dsNewCar.CAR_CC);
    const carCcPresent = hasValue(dsNewCar.CAR_CC);
    const passengers = getNumber(dsNewCar.GETIN_NO);
    const bodyType = String(dsNewCar.VH_TY_CD ?? dsNewCar.CAR_US_KD ?? '').trim();
    const fuelCode = String(dsNewCar.FUEL_CD ?? '').trim().toLowerCase();
    const procCd = String(dsNewCar.PROC_CD ?? '').trim();
    const taskCd = String(dsNewCar.TASK_CD ?? '').trim();
    const targetCode = resolveExemptionCode(dsNewCar, codes);
    const friendlyFuel = fuelCode === 'e' || (fuelCode >= 'l' && fuelCode <= 'q');
    const exempt = (reason) => ({ exempt: true, area, reason });

    // 감면대상 표에서 공채 100% 면제로 명시된 대상만 여기서 계산을 종료한다.
    // 장애인·시각장애는 취득세 면제 여부와 달리 등급 전체가 공채 전액면제 대상이다.
    // 다자녀·보훈보상·공동경비구역·비영리사업자는 공채 감면 '해당 없음'이므로
    // 종료하지 않고 아래의 전기차·지역·차종 공채 규칙을 계속 확인한다.
    if (['01', '02', '03', '04', '05', '07'].includes(targetCode)) {
        if (targetCode === '01') {
            return exempt('국가유공자 공채 전액면제');
        }
        if (targetCode === '02') {
            return exempt('5.18 민주화운동대상 공채 전액면제');
        }
        if (targetCode === '03') {
            return exempt('고엽제 후유증 대상 공채 전액면제');
        }
        if (targetCode === '04') {
            return exempt('장애인 공채 전액면제');
        }
        if (targetCode === '05') {
            return exempt('시각장애 공채 전액면제');
        }
        if (targetCode === '07') {
            return exempt('침수차량 공채 전액면제');
        }
        return exempt('비과세 대상 공채 전액면제');
    }
    if (carType === '영업') {
        return exempt('영업용 공채 전액면제');
    }
    if (['부산광역시', '대구광역시', '경상남도 창원시'].includes(area)
        && (carType !== '승용' || (carCcPresent && carCc < 2000)
            || bodyType === '3' || (passengers >= 7 && passengers <= 10))) {
        return exempt(area + ' 차종 조건 공채 전액면제');
    }
    if (carType === '승용' && carCcPresent && carCc < 1600) {
        // 서울 전기차는 일반 감면코드 선택 여부로 전액면제하지 않고,
        // 위에서 확정한 감면대상별 전액면제 외에는 지역별 정액감면을 적용한다.
        const seoulElectricNormal = area === '서울특별시'
            && ['e', 'q'].includes(fuelCode);
        const seoulUnderOneThousand = area === '서울특별시'
            && carCc < 1000 && ['00', '15'].includes(targetCode);
        if (!seoulElectricNormal && !seoulUnderOneThousand) {
            return exempt('1600cc 미만 승용차 공채 매입의무 면제');
        }
    }
    if (area === '경기도' && ['e', 'q', 'r'].includes(fuelCode)) {
        return exempt('경기도 전기차 공채 전액면제');
    }
    if (area === '인천광역시' && fuelCode >= 'l' && fuelCode <= 'p') {
        return exempt('인천 하이브리드 공채 전액면제');
    }
    if (['부산광역시', '대구광역시'].includes(area) && friendlyFuel) {
        return exempt(area + ' 친환경차 공채 전액면제');
    }
    if (['경상남도', '경상남도 함양군', '경상남도 함안군', '경상남도 창원시'].includes(area)
        && friendlyFuel) {
        return exempt('경상남도 친환경차 공채 전액면제');
    }
    if (['전라북도', '전북특별자치도'].includes(area) && ['06', '15'].includes(targetCode)) {
        return exempt('전북 다자녀 공채 전액면제');
    }
    if (area === '경기도' && taskCd === 'LEASE' && procCd !== 'C') {
        return exempt('경기도 리스차량 공채 전액면제');
    }
    if (area === '인천광역시' && carCc >= 2000 && (procCd === 'C' || taskCd === 'LEASE')) {
        return exempt('인천 리스차량 공채 전액면제');
    }
    if (area === '대구광역시' && (procCd === 'C' || taskCd === 'LEASE')) {
        return exempt('대구 리스차량 공채 전액면제');
    }
    if (area === '충청북도' && (procCd === 'C' || taskCd === 'LEASE')) {
        return exempt('충북 리스차량 공채 전액면제');
    }
    const ecoEligibility = resolveEcoEligibility({ dsNewCar, codes });
    const fixedElectricAreas = [
        '서울특별시', '부산광역시', '대구광역시', '인천광역시',
        '강원도', '강원특별자치도', '광주광역시', '경상북도', '충청북도',
        '충청남도', '전라북도', '전북특별자치도', '전남광주통합특별시',
        '제주특별자치도', '울산광역시'
    ];
    if (isElectricOrHydrogen(dsNewCar)
        && ecoEligibility.bondEligible
        && !fixedElectricAreas.includes(area)) {
        return exempt('전기·수소차 공채 전액면제');
    }
    return { exempt: false, area, reason: '' };
};

// 금액처리 파일의 지역별 공채 절사/반올림 규칙 적용함.
const roundBondPurchaseAmount = (value, area) => {
    const amount = Math.max(0, Math.floor(getNumber(value)));
    if (['서울특별시', '부산광역시', '대구광역시'].includes(area)) {
        return Math.round(amount / 5000) * 5000;
    }
    if (area === '충청북도') {
        return amount < 10000 ? amount : Math.floor(amount / 10000) * 10000;
    }
    return Math.floor(amount / 5000) * 5000;
};

// 운영 프로시저의 전기·수소·하이브리드 공채 정액감면.
const resolveEcoBondRelief = ({ dsNewCar, bondGrossAmt, ecoEligibility }) => {
    const area = resolveBondArea(dsNewCar);
    const passengers = getNumber(dsNewCar.GETIN_NO);
    const electric = isElectricOrHydrogen(dsNewCar);
    const hybrid = isHybridFuel(dsNewCar);
    let limit = 0;
    let fullExemption = false;
    let reason = '친환경차 공채 감면 대상 아님';

    if (electric && ecoEligibility.bondEligible) {
        if (area === '부산광역시') {
            limit = 2500000;
        } else if (area === '서울특별시') {
            limit = passengers <= 6 ? 2500000 : 0;
        } else if (['대구광역시', '인천광역시'].includes(area)) {
            limit = 2500000;
        } else if ([
            '강원도', '강원특별자치도', '광주광역시', '경상북도', '충청북도',
            '충청남도', '전라북도', '전북특별자치도', '전남광주통합특별시'
        ].includes(area)) {
            limit = 1500000;
        } else if (!['제주특별자치도', '울산광역시'].includes(area)) {
            fullExemption = true;
        }
        reason = fullExemption
            ? '전기·수소차 공채 전액면제'
            : (limit > 0 ? '전기·수소차 공채 감면' : '해당 지역 전기·수소차 공채 감면 없음');
    } else if (hybrid && ecoEligibility.bondEligible) {
        if (['서울특별시', '부산광역시', '대구광역시'].includes(area)) {
            limit = passengers < 7 ? 1400000 : 0;
        } else if (![
            '제주특별자치도', '강원도', '강원특별자치도', '광주광역시',
            '경상북도', '충청북도', '충청남도', '울산광역시',
            '전라북도', '전북특별자치도', '경기도'
        ].includes(area)) {
            limit = 1500000;
        }
        reason = limit > 0 ? '하이브리드 공채 감면' : '해당 지역 하이브리드 공채 감면 없음';
    }

    const reduction = fullExemption
        ? bondGrossAmt
        : Math.min(bondGrossAmt, Math.max(0, limit));
    return {
        area,
        electric,
        limit,
        bondReductionAmt: reduction,
        bondBaseAmt: Math.max(0, bondGrossAmt - reduction),
        applied: fullExemption || reduction > 0,
        reason
    };
};

// 금액처리 파일의 TUSE/SBOND 상세값에서 서울, 그 외 지역 공채 할인율 가져옴.
// DETAIL_NM 형식은 "서울할인율,기타지역할인율"로 처리함.
const getBondSaleCodeRate = ({ dsNewCar = {}, codes = {} }) => {
    const bondSaleCode = (Array.isArray(codes.TUSE) ? codes.TUSE : []).find(item => String(
        item?.CODE_ID ?? item?.codeId ?? item?.code_ID ?? ''
    ).trim().toUpperCase() === 'SBOND');
    const detail = String(
        bondSaleCode?.DETAIL_NM
        ?? bondSaleCode?.detailNm
        ?? bondSaleCode?.detail_NM
        ?? ''
    ).trim();

    if (!detail) {
        return null;
    }

    const [seoulRate, otherRate] = detail.split(',').map(value => value.trim());
    const selectedRate = resolveBondArea(dsNewCar) === '서울특별시'
        ? seoulRate
        : (otherRate || seoulRate);

    return hasValue(selectedRate) ? getNumber(selectedRate) : null;
};
// 계산 설정값 가져옴.
// 추후 지역/관청별 채권요율, 할인율, 수수료 고정금액이 생기면 codes.NEWCAR_AMOUNT_CONFIG로 주입 처리함.
const getConfig = ({ dsNewCar = {}, codes = {} }) => {
    const calcConfig = codes.NEWCAR_AMOUNT_CONFIG || codes.newcarAmountConfig || {};

    return {
        ...DEFAULT_CALC_CONFIG,
        ...calcConfig,
        bondRate: dsNewCar.BOND_RATE ?? calcConfig.bondRate ?? DEFAULT_CALC_CONFIG.bondRate,
        bondDiscountRate: dsNewCar.BOND_DISCOUNT_RATE
            ?? getBondSaleCodeRate({ dsNewCar, codes })
            ?? calcConfig.bondDiscountRate
            ?? DEFAULT_CALC_CONFIG.bondDiscountRate
    };
};

// 첨부 로직과 100% 일치하려면 추가로 필요한 기준값 목록 생성함.
// 현재는 화면에 표시하지 않지만, 개발 중 디버깅/안내용으로 결과 객체에 같이 반환함.
const getMissingRequirements = ({ dsNewCar, codes, exemptionResult, bondPreExemption }) => {
    const missing = [];
    const hasTaxInfo = Boolean(dsNewCar?.TM_TAX_INFO || codes?.TM_TAX || codes?.TAX || codes?.taxInfo);

    if (!hasTaxInfo) {
        missing.push('TM_TAX rates');
    }

    if (!bondPreExemption?.exempt && !hasValue(dsNewCar.BOND_RATE)) {
        missing.push('bond purchase rate');
    }

    if (!hasValue(dsNewCar.BOND_DISCOUNT_RATE) && !hasValue(getBondSaleCodeRate({ dsNewCar, codes }))) {
        missing.push('TUSE/SBOND discount rate');
    }

    missing.push(...(exemptionResult?.missingRequirements || []));

    return [...new Set(missing)];
};

// 예상금액 결과가 현재 화면 입력값과 같은 기준으로 계산됐는지 비교할 key 생성함.
// 채권/카드/감면/차량제원/번호판 정보가 바뀌면 재계산 필요 상태로 보이게 처리함.
export const buildNewcarEstimateKey = ({ dsNewCar = {}, dsWorkCp = {} }) => [
    dsNewCar.BUY_AMT ?? '',
    dsNewCar.STANDARD_AMT ?? '',
    dsNewCar.TAX_AMT ?? '',
    JSON.stringify(dsNewCar.TM_TAX_INFO ?? {}),
    dsNewCar.BOND_DC ?? '',
    dsNewCar.BOND_RATE ?? '',
    dsNewCar.BOND_DISCOUNT_RATE ?? '',
    dsNewCar.BOND_AREA ?? '',
    dsNewCar.BOND_GB ?? '',
    dsNewCar.BOND_FULL_EXEMPT_YN ?? '',
    dsNewCar.BASE_ADDRESS ?? '',
    dsNewCar.FUEL_CD ?? '',
    dsNewCar.VH_TY_CD ?? '',
    dsNewCar.BOND_SEARCH_CAR_GB ?? '',
    dsNewCar.BOND_SEARCH_BASE_VALUE ?? '',
    dsNewCar.CARD_YN ?? '',
    dsNewCar.NTAX_WHO ?? '',
    dsNewCar.NTAX_TRGET_CD ?? '',
    dsNewCar.NTAX_TRGET_GR_CD ?? '',
    dsNewCar.CAR_NM ?? '',
    dsNewCar.ECO_YN ?? '',
    dsNewCar.MADE_YY ?? '',
    dsNewCar.VHCTY_ASORT_CODE ?? '',
    dsNewCar.CAR_KD ?? '',
    dsNewCar.CAR_CC ?? '',
    dsNewCar.GETIN_NO ?? '',
    dsNewCar.CAR_KD_CD ?? '',
    dsNewCar.MXMM_LDG ?? '',
    dsNewCar.EXCHANGE_OLD_ACQ_AMT ?? '',
    dsNewCar.NUMPLATE_GB ?? '',
    dsWorkCp.FEE ?? ''
].join('|');

/**
 * 신규등록 예상금액 전체 계산의 단일 진입점.
 *
 * 입력
 * - dsNewCar: 사용자 입력값 + 차량제원 + TM_TAX + TM_BOND 조회 결과
 * - dsPaymentList: 기존 TR_PAYMENT 목록. 없는 예상 결제항목은 이 함수에서 생성한다.
 * - dsWorkCp: 회사별 등록수수료(TM_WORK_CP.FEE)
 * - codes: 감면 코드(NTTCD), 공채 할인율(TUSE/SBOND) 등 공통코드
 *
 * 처리 순서
 * 1. BUY_AMT 기준 취득세 산출 -> 일반 감면 -> 친환경 감면 -> 10원 미만 절사
 * 2. 공채 매입의무 금액 산출 -> 사전 전액면제 -> 친환경 감면 -> 지역별 절사/반올림
 * 3. 채권 매입(BUY)은 매입기준금액, 매도(SELL)는 할인액을 실제 납부액으로 결정
 * 4. 등록수수료/인지/증지/번호판대 등을 합쳐 TR_PAYMENT 예상금액과 총액 생성
 *
 * 중요 반환값
 * - totalAmt: TR_NEWCAR.PREREG_AMT/TOTAL_AMT에 반영할 예상 납부 합계
 * - updatedPaymentList: TR_PAYMENT에 저장할 항목별 금액
 * - bondBaseAmt: 공채 감면 후 실제 매입기준금액(BOND row의 REAL_ALOAN)
 * - bond: 선택한 채권 처리방식에 따라 실제 납부할 금액(BOND row의 PRE_PAY_AMT/PAY_AMT)
 */
export const calculateNewcarEstimate = ({
    dsNewCar = {},
    dsPaymentList = [],
    dsWorkCp = {},
    codes = {}
}) => {
    const config = getConfig({ dsNewCar, codes });
    const paymentRows = buildPaymentRows(dsPaymentList);

    // 1. 운영 프로시저 순서로 취득세 계산함.
    // 감면 전 세액(grossAcqTax)과 실제 납부세액(acqTax)을 분리해야
    // 화면 감면 카드에서 10원 미만 절삭액을 감면액으로 잘못 표시하지 않는다.
    const taxableStandard = resolveTaxableStandard(dsNewCar);
    const taxInfo = getTaxInfo({ dsNewCar, codes });
    const procedureRates = resolveProcedureTaxRates(dsNewCar);
    const acqRateField = procedureRates.acqRateField;
    const acqRate = procedureRates.acqRate;
    const grossAcqTax = Number((taxableStandard * acqRate).toFixed(6));
    const baseAcqTax = resolveProcedureCarType(dsNewCar) === '경차'
        ? Math.max(0, grossAcqTax - 750000)
        : grossAcqTax;
    const ecoEligibility = resolveEcoEligibility({ dsNewCar, codes });
    const targetExemptionResult = resolveAcqTaxExemption({
        dsNewCar,
        codes,
        grossAcqTax: baseAcqTax
    });
    const exemptionResult = applyEcoAcqTaxExemption({
        dsNewCar,
        codes,
        grossAcqTax: baseAcqTax,
        targetExemptionResult,
        ecoEligibility
    });
    const acqTax = roundDown(Math.max(0, exemptionResult.acqTax));
    const acqReductionAmt = Math.max(0, exemptionResult.acqReductionAmt);

    // 2. 비과세·차종·지역·리스 사전면제를 먼저 적용하고, 남은 금액에 친환경 공채감면을 적용함.
    // BOND_RATE는 0~1이면 과세표준에 곱하는 비율, 1 이상이면 이미 계산된 정액으로 해석한다.
    const bondArea = resolveBondArea(dsNewCar);
    const bondValue = getNumber(config.bondRate);
    const bondValueType = bondValue > 0 && bondValue < 1 ? 'RATE' : 'AMOUNT';
    const bondRate = bondValueType === 'RATE' ? bondValue : 0;
    const bondGrossAmt = Math.floor(
        bondValueType === 'RATE' ? taxableStandard * bondValue : bondValue
    );
    const bondPreExemption = resolveBondPreExemption(dsNewCar, codes);
    const bondReliefResult = bondPreExemption.exempt
        ? {
            area: bondArea,
            electric: isElectricVehicle(dsNewCar),
            limit: bondGrossAmt,
            bondReductionAmt: bondGrossAmt,
            bondBaseAmt: 0,
            applied: true,
            reason: bondPreExemption.reason
        }
        : resolveEcoBondRelief({ dsNewCar, bondGrossAmt, ecoEligibility });
    const bondBaseAmt = roundBondPurchaseAmount(bondReliefResult.bondBaseAmt, bondArea);
    const bondDiscountRate = normalizePercent(config.bondDiscountRate);
    const bondDiscountAmt = Math.floor(bondBaseAmt * bondDiscountRate);
    // BUY(매입): 감면 후 채권 원금 전체를 납부한다.
    // SELL(매도/할인): 채권 원금은 REAL_ALOAN에 보관하고 할인액만 납부한다.
    const bond = dsNewCar.BOND_DC === 'BUY' ? bondBaseAmt : bondDiscountAmt;
    const bondFee = Math.floor(
        (bondBaseAmt * normalizePercent(config.bondFeeRate)) + getNumber(config.bondFeeBaseAmount)
    );

    // 3. 기타 결제항목 계산함.
    // 현재 로그인 회사의 WORK_CD=010 서비스 설정값을 등록수수료로 사용함.
    // TM_WORK_CP.FEE가 없을 때만 기존 TR_PAYMENT 등록수수료를 유지함.
    const fee = hasValue(dsWorkCp.FEE)
        ? getNumber(dsWorkCp.FEE)
        : getPaymentAmount(paymentRows, 'FEE', 0);
    const hasLoadedTaxInfo = Boolean(dsNewCar.TM_TAX_INFO || codes.TM_TAX || codes.TAX || codes.taxInfo);
    const calculatedStamp = resolveTaxCharge({
        taxInfo,
        prefix: 'STAMP',
        taxableStandard,
        fallback: config.stampAmount
    });
    const calculatedInji = resolveTaxCharge({
        taxInfo,
        prefix: 'REGIST',
        taxableStandard,
        fallback: config.injiAmount
    });
    // TM_TAX가 조회되면 기존 결제 row보다 현재 유효 세금정보를 우선 반영함.
    const stamp = hasLoadedTaxInfo
        ? calculatedStamp
        : getPaymentAmount(paymentRows, 'STAMP', calculatedStamp);
    const inji = hasLoadedTaxInfo
        ? calculatedInji
        : getPaymentAmount(paymentRows, 'INJI', calculatedInji);
    const tnum = resolveNumplateAmount(dsNewCar, paymentRows);
    const unum = getPaymentAmount(paymentRows, 'UNUM', 0);
    const ureg = procedureRates.uregRate === null
        ? getPaymentAmount(paymentRows, 'UREG', 0)
        : roundDown(taxableStandard * procedureRates.uregRate);
    const spare = getPaymentAmount(paymentRows, 'SPARE', 0);
    const isCardPay = dsNewCar.CARD_YN === 'Y';

    // TR_PAYMENT row에 반영할 계산 금액 묶음.
    const calculatedAmounts = {
        ACQ: acqTax,
        UREG: ureg,
        INJI: inji,
        STAMP: stamp,
        BOND: bond,
        BFEE: bondFee,
        FEE: fee,
        TNUM: tnum,
        UNUM: unum,
        SPARE: spare
    };

    // 계산 금액을 결제 row에 반영함.
    // PRE_PAY_AMT와 PAY_AMT에는 현재 예상 실제 납부액을 동일하게 넣는다.
    // BOND row만 REAL_ALOAN에 공채 매입기준금액을 별도 보관한다.
    // 특히 SELL은 PAY_AMT=할인액, REAL_ALOAN=감면 후 채권 원금이므로 두 값을 바꾸면 안 된다.
    const updatedPaymentList = paymentRows.map(row => {
        if (!Object.prototype.hasOwnProperty.call(calculatedAmounts, row.PAY_KD)) {
            return row;
        }

        const nextRow = {
            ...row,
            PRE_PAY_AMT: calculatedAmounts[row.PAY_KD],
            PAY_AMT: calculatedAmounts[row.PAY_KD]
        };

        if (row.PAY_KD === 'BOND') {
            nextRow.REAL_ALOAN = bondBaseAmt;
        }

        return nextRow;
    });

    // 총 입금액 계산함.
    // 카드납부면 취득세는 카드로 따로 처리되므로 합계에서 제외함.
    const totalAmt = Object.entries(calculatedAmounts).reduce((sum, [payKd, amount]) => {
        if (isCardPay && payKd === 'ACQ') {
            return sum;
        }

        return sum + amount;
    }, 0);

    // 화면 표시와 상태 저장에 필요한 계산 결과 반환함.
    return {
        key: buildNewcarEstimateKey({ dsNewCar, dsWorkCp }),
        buyAmt: getNumber(dsNewCar.BUY_AMT),
        taxableStandard,
        acqRateField,
        acqRate,
        grossAcqTax,
        acqReductionAmt,
        acqTax,
        exemptionCode: exemptionResult.code,
        exemptionName: exemptionResult.name,
        exemptionApplied: exemptionResult.applied,
        exemptionReason: exemptionResult.reason,
        ntaxApplyCode: exemptionResult.ntaxApplyCode,
        exemptionMissingRequirements: exemptionResult.missingRequirements,
        electricVehicle: isElectricVehicle(dsNewCar),
        bondArea,
        bondGb: dsNewCar.BOND_GB ?? '',
        bondDc: dsNewCar.BOND_DC ?? '',
        bondRate,
        bondValue,
        bondValueType,
        bondGrossAmt,
        bondPreExempt: bondPreExemption.exempt,
        bondReductionLimit: bondReliefResult.limit,
        bondReductionAmt: bondReliefResult.bondReductionAmt,
        bondReliefApplied: bondReliefResult.applied,
        bondReliefReason: bondReliefResult.reason,
        bondBaseAmt,
        bondDiscountRate,
        bondDiscountAmt,
        bond,
        bondFee,
        fee,
        stamp,
        inji,
        tnum,
        unum,
        ureg,
        spare,
        isCardPay,
        totalAmt,
        updatedPaymentList,
        missingRequirements: getMissingRequirements({ dsNewCar, codes, exemptionResult, bondPreExemption })
    };
};
