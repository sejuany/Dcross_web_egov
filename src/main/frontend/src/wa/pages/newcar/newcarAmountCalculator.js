// 신규등록 예상금액 계산 전용 모듈
// 화면 입력/상태 변경은 NewcarInfo.jsx에서 처리함. 금액 산출 규칙은 이 파일에서만 관리함.
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

// 화면 표시용 금액 포맷 처리함.
export const formatAmount = (value) => getNumber(value).toLocaleString();

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

    if (!selectedCode || selectedCode === '00' || EXEMPTION_NAMES[selectedCode]) {
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
    const carCc = getNumber(dsNewCar.CAR_CC);
    const passengers = getNumber(dsNewCar.GETIN_NO);
    const maxLoad = getMaxLoad(dsNewCar);

    if (vehicleType === '1') {
        if ((carCc > 0 && carCc <= 2000) || (passengers >= 7 && passengers <= 10)) {
            return { eligible: true, reason: '감면 차량조건 충족' };
        }

        const missingRequirements = [];
        if (!carCc) missingRequirements.push('배기량(CAR_CC)');
        if (!passengers) missingRequirements.push('승차정원(GETIN_NO)');

        return { eligible: false, reason: '승용차 감면 차량조건 미충족', missingRequirements };
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
        return maxLoad > 0 && maxLoad <= 1000
            ? { eligible: true, reason: '최대적재량 1톤 이하 화물차' }
            : {
                eligible: false,
                reason: '화물차 감면 차량조건 확인 필요',
                missingRequirements: maxLoad ? [] : ['최대적재량(MXMM_LDG)']
            };
    }

    if (vehicleType === '5') {
        return carCc > 0 && carCc <= 250
            ? { eligible: true, reason: '배기량 250cc 이하 이륜자동차' }
            : {
                eligible: false,
                reason: '이륜자동차 감면 차량조건 미충족',
                missingRequirements: carCc ? [] : ['배기량(CAR_CC)']
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
    const vehicleType = resolveVehicleType(dsNewCar);
    const passengers = getNumber(dsNewCar.GETIN_NO);
    const grade = getNumber(dsNewCar.NTAX_TRGET_GR_CD);
    const unchanged = (reason = '', missingRequirements = []) => buildExemptionResult({
        code,
        grossAcqTax,
        reason,
        missingRequirements
    });

    if (!code || code === '00') {
        return unchanged();
    }

    // 2자녀: 취득세 50% 감면, 6인승 이하 승용차는 최대 70만원 감면함.
    if (code === '15') {
        const missingRequirements = vehicleType === '1' && !passengers ? ['승차정원(GETIN_NO)'] : [];
        let reduction = Math.ceil((grossAcqTax * 0.5) / ROUND_UNIT) * ROUND_UNIT;

        if (vehicleType === '1' && (!passengers || passengers <= 6)) {
            reduction = Math.min(reduction, 700000);
        }

        return buildExemptionResult({
            code,
            grossAcqTax,
            payableAcqTax: grossAcqTax - reduction,
            reason: vehicleType === '1' && passengers > 0 && passengers <= 6
                ? '취득세 50% 감면, 6인승 이하 최대 70만원 한도 적용'
                : '취득세 50% 감면 적용',
            missingRequirements
        });
    }

    // 3자녀: 6인승 이하 승용차는 최대 140만원 감면함.
    // 그 외 대상차량은 200만원 이하 전액면제, 200만원 초과 시 85% 감면함.
    if (code === '06') {
        if (vehicleType === '1' && (!passengers || passengers <= 6)) {
            return buildExemptionResult({
                code,
                grossAcqTax,
                payableAcqTax: grossAcqTax - Math.min(grossAcqTax, 1400000),
                reason: '6인승 이하 승용차 최대 140만원 감면 적용',
                missingRequirements: passengers ? [] : ['승차정원(GETIN_NO)']
            });
        }

        const payableAcqTax = grossAcqTax <= 2000000 ? 0 : roundDown(grossAcqTax * 0.15);
        return buildExemptionResult({
            code,
            grossAcqTax,
            payableAcqTax,
            reason: grossAcqTax <= 2000000 ? '취득세 전액면제 적용' : '취득세 85% 감면 적용'
        });
    }

    // 국가유공자·5.18·고엽제는 엑셀의 공통 차량조건 충족 시 전액면제함.
    if (['01', '02', '03'].includes(code)) {
        const eligibility = resolveSpecialVehicleEligibility(dsNewCar);
        return eligibility.eligible
            ? buildExemptionResult({ code, grossAcqTax, payableAcqTax: 0, reason: eligibility.reason })
            : unchanged(eligibility.reason, eligibility.missingRequirements);
    }

    // 장애인은 기존 1~3급, 시각장애인은 기존 1~4급까지만 취득세 면제함.
    if (code === '04' || code === '05') {
        const maxEligibleGrade = code === '04' ? 3 : 4;

        if (!grade || grade > maxEligibleGrade) {
            return unchanged(
                grade ? '선택한 장애등급은 취득세 면제 대상 아님' : '장애등급 확인 필요',
                grade ? [] : ['감면등급(NTAX_TRGET_GR_CD)']
            );
        }

        const eligibility = resolveSpecialVehicleEligibility(dsNewCar);
        return eligibility.eligible
            ? buildExemptionResult({ code, grossAcqTax, payableAcqTax: 0, reason: eligibility.reason })
            : unchanged(eligibility.reason, eligibility.missingRequirements);
    }

    // 교환자동차는 새 차량 세액에서 기존 차량 세액을 뺀 차액만 납부함.
    if (code === '09') {
        const oldAcqTax = getNumber(
            dsNewCar.EXCHANGE_OLD_ACQ_AMT
            ?? dsNewCar.OLD_ACQ_AMT
            ?? dsNewCar.PREV_ACQ_AMT
        );

        if (!oldAcqTax) {
            return unchanged('기존 차량 취득세액 확인 필요', ['기존 차량 취득세액(EXCHANGE_OLD_ACQ_AMT)']);
        }

        return buildExemptionResult({
            code,
            grossAcqTax,
            payableAcqTax: Math.max(grossAcqTax - oldAcqTax, 0),
            reason: '새 차량과 기존 차량 취득세 차액 적용'
        });
    }

    // 수출용중고자동차는 200만원 이하 전액면제, 초과 시 85% 감면함.
    if (code === '11') {
        return buildExemptionResult({
            code,
            grossAcqTax,
            payableAcqTax: grossAcqTax <= 2000000 ? 0 : roundDown(grossAcqTax * 0.15),
            reason: grossAcqTax <= 2000000 ? '취득세 전액면제 적용' : '취득세 85% 감면 적용'
        });
    }

    // JSA 거주자 항목은 엑셀에 감면율과 금액이 없어 자동 계산하지 않음.
    if (code === '12') {
		return buildExemptionResult({
            code,
            grossAcqTax,
            payableAcqTax: 0,
            reason: '공동경비구역(JSA) 거주자 취득세 전액면제 적용'
        });
	
    }

    // 비영리사업자는 관용차량 요건을 확인하고 선택한 것으로 보고 전액면제함.
    if (code === '13') {
        return buildExemptionResult({
            code,
            grossAcqTax,
            payableAcqTax: 0,
            reason: '관용차량 비영리사업자 취득세 전액면제 적용'
        });
    }

    // 보훈보상대상자는 공통 차량조건 충족 시 취득세 50% 감면함.
    if (code === '14') {
        const eligibility = resolveSpecialVehicleEligibility(dsNewCar);
        return eligibility.eligible
            ? buildExemptionResult({
                code,
                grossAcqTax,
                payableAcqTax: roundDown(grossAcqTax * 0.5),
                reason: '취득세 50% 감면 적용'
            })
            : unchanged(eligibility.reason, eligibility.missingRequirements);
    }

    // 중복감면은 엑셀의 중복 불가 기준에 따라 다자녀 정액 감면만 적용함.
    if (['18', '19'].includes(code)) {
        return buildExemptionResult({
            code,
            grossAcqTax,
            payableAcqTax: grossAcqTax - Math.min(grossAcqTax, 700000),
            reason: '중복감면 불가, 다자녀2 기준 최대 70만원 감면 적용'
        });
    }

    if (['16', '17'].includes(code)) {
        return buildExemptionResult({
            code,
            grossAcqTax,
            payableAcqTax: grossAcqTax - Math.min(grossAcqTax, 1400000),
            reason: '중복감면 불가, 다자녀3 기준 최대 140만원 감면 적용'
        });
    }

    return unchanged('등록되지 않은 감면유형 확인 필요', ['감면 계산 규칙']);
};

// 폴스타 전기차 여부 확인함.
// WA001 차량제원 응답은 서버에서 FUEL_CD=e로 통일하며 Maker 값은 저장 데이터 보완용으로 확인함.
const isElectricVehicle = (dsNewCar) => {
    const fuelCode = String(dsNewCar.FUEL_CD ?? '').trim().toLowerCase();
    const maker = String(dsNewCar.CAR_SPEC_MAKER ?? dsNewCar.MAKER ?? '').replace(/\s+/g, '').toUpperCase();
    return ['e', 'q', 'r'].includes(fuelCode) || maker === 'POLESTAR';
};

// 전기차이지만 취득세 전기차 감면 대상이 아닌 차종.
// 대소문자와 앞뒤/중복 공백 차이로 감면이 다시 적용되지 않도록 정규화해서 비교함.
const normalizeCarName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
const ELECTRIC_ACQ_TAX_EXCLUDED_CAR_NAMES = new Set([
    'Polestar 4 Coupe Performance',
    'Polestar 4 Long Range Dual Motor'
].map(normalizeCarName));

const isElectricAcqTaxExemptionEligible = (dsNewCar) => (
    isElectricVehicle(dsNewCar)
    && !ELECTRIC_ACQ_TAX_EXCLUDED_CAR_NAMES.has(normalizeCarName(dsNewCar.CAR_NM))
);

// 일반 감면과 전기차 취득세 감면은 중복 적용하지 않고 감면액이 큰 한 건만 적용함.
// 전기차 취득세는 금액처리 파일 기준 최대 140만원 감면함.
const applyElectricAcqTaxExemption = ({ dsNewCar, grossAcqTax, targetExemptionResult }) => {
    if (!isElectricAcqTaxExemptionEligible(dsNewCar)) {
        return targetExemptionResult;
    }

    const electricResult = buildExemptionResult({
        code: 'EV',
        grossAcqTax,
        payableAcqTax: grossAcqTax - Math.min(grossAcqTax, 1400000),
        reason: '전기자동차 취득세 최대 140만원 감면 적용'
    });

    // 감면액이 같으면 사용자가 선택한 감면대상 결과를 유지함.
    return targetExemptionResult.acqReductionAmt >= electricResult.acqReductionAmt
        ? targetExemptionResult
        : electricResult;
};
// 과세표준 금액 결정함.
// 첨부 로직처럼 표준과세금액/신고금액이 있으면 BUY_AMT와 비교해 큰 금액 사용함.
// STANDARD_AMT/TAX_AMT가 없으면 현재 화면에서 입력 가능한 BUY_AMT 기준으로 계산함.
const resolveTaxableStandard = (dsNewCar) => {
    const explicitStandard = getNumber(dsNewCar.STANDARD_AMT ?? dsNewCar.TAX_AMT);
    const buyAmt = getNumber(dsNewCar.BUY_AMT);

    if (!explicitStandard) {
        return buyAmt;
    }

    return Math.max(explicitStandard, buyAmt);
};

// 적용할 취득세율 컬럼명 결정함.
// 첨부 로직의 VHCTY_ASORT_CODE, GETIN_NO, CAR_KD_CD, CAR_CC 분기 기준을 프론트 보유값으로 축약 반영함.
const resolveAcqRateField = (dsNewCar) => {
    const vehicleKind = String(
        dsNewCar.VHCTY_ASORT_CODE
        ?? dsNewCar.VEHICLE_ASORT_CODE
        ?? dsNewCar.CAR_ASORT_CD
        ?? dsNewCar.CAR_KD
        ?? '1'
    );
    const carKindCode = String(dsNewCar.CAR_KD_CD ?? '');
    const carCc = getNumber(dsNewCar.CAR_CC);
    const passengers = getNumber(dsNewCar.GETIN_NO);
    const carName = String(dsNewCar.CAR_NM ?? '');

    // 경차: 차종코드 4 + 1000cc 이하이면 ACQ0_PER 적용함.
    if (carKindCode === '4' && carCc > 0 && carCc <= 1000) {
        return 'ACQ0_PER';
    }

    // 캠핑카: 첨부 로직처럼 11인승 이상 승합 세율 컬럼 적용함.
    if (carName.includes('\uCEA0\uD551')) {
        return 'ACQ211_PER';
    }

    // 승합: 11인승 이상/미만에 따라 다른 세율 컬럼 사용함.
    if (vehicleKind === '2') {
        return passengers >= 11 ? 'ACQ211_PER' : 'ACQ210_PER';
    }

    // 화물/특수 계열로 넘어온 값은 ACQ3_PER 사용함.
    if (vehicleKind === '3') {
        return 'ACQ3_PER';
    }

    // 기본 승용 세율 사용함.
    return 'ACQ1_PER';
};

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

// TM_BOND 조회 지역명과 사용본거지 주소에서 시도명 가져옴.
// 특별자치도 개편 전 명칭은 현재 명칭으로 통일해 동일한 감면 규칙 적용함.
const resolveBondArea = (dsNewCar) => {
    const source = String(dsNewCar.BOND_AREA ?? dsNewCar.BASE_ADDRESS ?? '').trim();
    const aliases = {
        강원도: '강원특별자치도',
        전라북도: '전북특별자치도'
    };
    const areas = [
        '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
        '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
        '강원도', '충청북도', '충청남도', '전북특별자치도', '전라북도',
        '전라남도', '경상북도', '경상남도', '제주특별자치도'
    ];
    const area = areas.find(candidate => source.startsWith(candidate)) || source.split(/\s+/)[0] || '';
    return aliases[area] || area;
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

// sp_NewCarTaxBondConfirm 기준 전기차 공채 감면액 계산함.
// 경기·부산·대구·경남은 전액면제하며 나머지 지역은 프로시저의 정액/전액 규칙 적용함.
const resolveElectricBondRelief = ({ dsNewCar, bondGrossAmt }) => {
    const area = resolveBondArea(dsNewCar);
    const electric = isElectricVehicle(dsNewCar);
    const forcedFullExemption = String(dsNewCar.BOND_FULL_EXEMPT_YN ?? '').trim().toUpperCase() === 'Y';
    const passengers = getNumber(dsNewCar.GETIN_NO);
    const fullExemptionAreas = ['경기도', '부산광역시', '대구광역시', '경상남도'];
    const reducedBy150Areas = [
        '강원특별자치도', '광주광역시', '경상북도', '충청북도',
        '충청남도', '전북특별자치도', '전남광주통합특별시'
    ];
    let limit = 0;
    let reason = electric ? '해당 지역 전기차 공채 감면 없음' : '전기차 공채 감면 대상 아님';

    if (electric) {
        if (forcedFullExemption || fullExemptionAreas.includes(area)) {
            limit = bondGrossAmt;
            reason = '전기자동차 공채 매입 전액면제 적용';
        } else if (area === '서울특별시') {
            limit = passengers >= 7 ? 0 : 2500000;
            reason = passengers >= 7
                ? '서울 7인승 이상 승용 전기차 공채 감면 없음'
                : '전기자동차 공채 최대 250만원 감면 적용';
        } else if (area === '인천광역시') {
            limit = 2500000;
            reason = '전기자동차 공채 최대 250만원 감면 적용';
        } else if (reducedBy150Areas.includes(area)) {
            limit = 1500000;
            reason = '전기자동차 공채 최대 150만원 감면 적용';
        } else if (!['울산광역시', '제주특별자치도'].includes(area)) {
            // 프로시저 ELSE 분기처럼 별도 정액감면 지역이 아니면 공채 전액면제 처리함.
            limit = bondGrossAmt;
            reason = '전기자동차 공채 매입 전액면제 적용';
        }
    }

    const reduction = Math.min(bondGrossAmt, Math.max(0, limit));
    return {
        area,
        electric,
        limit,
        bondReductionAmt: reduction,
        bondBaseAmt: Math.max(0, bondGrossAmt - reduction),
        applied: electric && (forcedFullExemption || reduction > 0),
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
const getMissingRequirements = ({ dsNewCar, codes, exemptionResult }) => {
    const missing = [];
    const hasTaxInfo = Boolean(dsNewCar?.TM_TAX_INFO || codes?.TM_TAX || codes?.TAX || codes?.taxInfo);

    if (!hasTaxInfo) {
        missing.push('TM_TAX rates');
    }

    if (!dsNewCar.STANDARD_AMT && !dsNewCar.TAX_AMT) {
        missing.push('standard taxable amount / residual rate');
    }

    if (!hasValue(dsNewCar.BOND_RATE)) {
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
    dsNewCar.PROC_CD ?? '',
    dsNewCar.TASK_CD ?? '',
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
    dsNewCar.FOM_NM ?? '',
    dsNewCar.LENGTH ?? '',
    dsNewCar.WIDTH ?? '',
    dsNewCar.HEIGHT ?? '',
    dsNewCar.MAX_CAP ?? '',
    dsNewCar.TOTAL_CAP ?? '',
    dsNewCar.MULTI_PURPOSE_YN ?? '',
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

// 신규등록 예상금액 전체 계산함.
// 반환값은 화면 요약, TR_NEWCAR 금액 필드, TR_PAYMENT row 갱신에 함께 사용함.
export const calculateNewcarEstimate = ({
    dsNewCar = {},
    dsPaymentList = [],
    dsWorkCp = {},
    codes = {},
    coreEstimate = null
}) => {
    const config = getConfig({ dsNewCar, codes });
    const paymentRows = buildPaymentRows(dsPaymentList);
    // 서버가 취득세와 공채 매입액을 모두 계산한 경우에만 운영 프로시저 결과를 사용함.
    // 둘 중 하나라도 없으면 기존 프런트 계산을 그대로 유지함.
    const useCoreEstimate = hasValue(coreEstimate?.ACQ_AMT)
        && hasValue(coreEstimate?.BOND_PURCHASE_AMT);

    // 1. 과세표준 및 취득세 계산함.
    // 서버 계산은 운영 프로시저와 동일하게 BUY_AMT를 과세표준으로 사용함.
    const taxableStandard = useCoreEstimate
        ? getNumber(dsNewCar.BUY_AMT)
        : resolveTaxableStandard(dsNewCar);
    const acqRateField = resolveAcqRateField(dsNewCar);
    const taxInfo = getTaxInfo({ dsNewCar, codes });
    const acqRate = useCoreEstimate
        ? getNumber(coreEstimate.ACQ_RATIO)
        : normalizePercent(taxInfo[acqRateField]);
    const grossAcqTax = useCoreEstimate
        ? getNumber(coreEstimate.GROSS_ACQ_AMT)
        : roundDown(taxableStandard * acqRate);
    const exemptionResult = useCoreEstimate
        ? {
            code: resolveExemptionCode(dsNewCar, codes),
            name: EXEMPTION_NAMES[resolveExemptionCode(dsNewCar, codes)] || '',
            grossAcqTax,
            acqReductionAmt: getNumber(coreEstimate.ACQ_SUBTRACT_AMT),
            acqTax: getNumber(coreEstimate.ACQ_AMT),
            applied: getNumber(coreEstimate.ACQ_SUBTRACT_AMT) > 0,
            reason: String(coreEstimate.ACQ_REASON ?? ''),
            missingRequirements: [],
            ntaxApplyCode: String(
                coreEstimate.NTAX_APPLC_CD
                ?? dsNewCar.NTAX_APPLC_CD
                ?? '0'
            )
        }
        : (() => {
            const targetExemptionResult = resolveAcqTaxExemption({
                dsNewCar,
                codes,
                grossAcqTax
            });

            return applyElectricAcqTaxExemption({
                dsNewCar,
                grossAcqTax,
                targetExemptionResult
            });
        })();
    const acqTax = exemptionResult.acqTax;

    // 2. 공채 계산함.
    // TM_BOND.VALUE로 감면 전 매입액을 만든 뒤 지역별 전기차 공채 감면을 차감함.
    // BUY는 감면 후 매입액 전체, SELL은 감면 후 매입액에 할인율을 적용한 금액 납부함.
    const bondArea = useCoreEstimate
        ? String(coreEstimate.BOND_AREA ?? '')
        : resolveBondArea(dsNewCar);
    const bondValue = useCoreEstimate
        ? getNumber(coreEstimate.BOND_VALUE)
        : getNumber(config.bondRate);
    const bondValueType = useCoreEstimate
        ? (String(coreEstimate.BOND_VALUE_TYPE ?? '').trim().toUpperCase()
            || (bondValue > 0 && bondValue < 1 ? 'RATE' : 'AMOUNT'))
        : (bondValue > 0 && bondValue < 1 ? 'RATE' : 'AMOUNT');
    const bondRate = bondValueType === 'RATE' ? bondValue : 0;
    // 프로시저처럼 VALUE가 소수면 취득가액에 곱하고 정수면 고정 공채금액으로 사용함.
    const bondGrossAmt = useCoreEstimate
        ? getNumber(coreEstimate.BOND_GROSS_AMT)
        : Math.floor(bondValueType === 'RATE' ? taxableStandard * bondValue : bondValue);
    const bondReliefResult = useCoreEstimate
        ? {
            limit: getNumber(coreEstimate.BOND_SUBTRACT_AMT),
            bondReductionAmt: getNumber(coreEstimate.BOND_SUBTRACT_AMT),
            bondBaseAmt: getNumber(coreEstimate.BOND_PURCHASE_AMT),
            applied: getNumber(coreEstimate.BOND_SUBTRACT_AMT) > 0,
            reason: String(coreEstimate.BOND_REASON ?? '')
        }
        : resolveElectricBondRelief({ dsNewCar, bondGrossAmt });
    // 프로시저 순서대로 감면액을 먼저 차감한 뒤 지역별 5천원/1만원 단위 처리함.
    const bondBaseAmt = useCoreEstimate
        ? getNumber(coreEstimate.BOND_PURCHASE_AMT)
        : roundBondPurchaseAmount(bondReliefResult.bondBaseAmt, bondArea);
    const bondDiscountAmt = Math.floor(bondBaseAmt * normalizePercent(config.bondDiscountRate));
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
    // 서버가 등록면허세를 계산하지 않은(null/미제공) 경우 기존 결제 row를 보존함.
    const preserveExistingUregRow = useCoreEstimate && !hasValue(coreEstimate.UREG_AMT);
    const ureg = useCoreEstimate && hasValue(coreEstimate.UREG_AMT)
        ? getNumber(coreEstimate.UREG_AMT)
        : getPaymentAmount(paymentRows, 'UREG', 0);
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
    // BOND row는 실제 납부액과 공채 매입 기준금액을 분리해서 보관함.
    const updatedPaymentList = paymentRows.map(row => {
        if (preserveExistingUregRow && row.PAY_KD === 'UREG') {
            return row;
        }

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
        // 화면 state에는 계산이 확정한 과세표준을 저장하므로 같은 값으로 key를 생성함.
        key: buildNewcarEstimateKey({
            dsNewCar: {
                ...dsNewCar,
                STANDARD_AMT: taxableStandard
            },
            dsWorkCp
        }),
        buyAmt: getNumber(dsNewCar.BUY_AMT),
        taxableStandard,
        acqRateField,
        acqRate,
        grossAcqTax,
        acqReductionAmt: exemptionResult.acqReductionAmt,
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
        bondRate,
        bondValue,
        bondValueType,
        bondGrossAmt,
        bondReductionLimit: bondReliefResult.limit,
        bondReductionAmt: bondReliefResult.bondReductionAmt,
        bondReliefApplied: bondReliefResult.applied,
        bondReliefReason: bondReliefResult.reason,
        bondBaseAmt,
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
        // 서버 핵심 계산을 사용한 경우 클라이언트 TM_TAX/TM_BOND 누락 안내를 섞지 않음.
        missingRequirements: useCoreEstimate
            ? []
            : getMissingRequirements({ dsNewCar, codes, exemptionResult })
    };
};
