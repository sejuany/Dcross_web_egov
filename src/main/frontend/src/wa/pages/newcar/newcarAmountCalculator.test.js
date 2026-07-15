import { calculateNewcarEstimate } from './newcarAmountCalculator';

const taxCodes = {
    TM_TAX: {
        ACQ1_PER: 0.07,
        ACQ2_PER: 0.05,
        ACQ3_PER: 0.05,
        ACQ210_PER: 0.05,
        ACQ211_PER: 0.05,
        ACQ0_PER: 0
    }
};

const makeCar = (overrides = {}) => ({
    BUY_AMT: 20000000,
    STANDARD_AMT: 20000000,
    BOND_DC: 'SELL',
    BOND_RATE: 0.2,
    BOND_DISCOUNT_RATE: 0.1,
    VHCTY_ASORT_CODE: '1',
    CAR_CC: 1600,
    GETIN_NO: 5,
    NTAX_TRGET_CD: '00',
    NTAX_TRGET_GR_CD: '0',
    FUEL_CD: 'g',
    BASE_ADDRESS: '서울특별시 강남구',
    BOND_AREA: '서울특별시',
    BOND_GB: 'M',
    ...overrides
});

const calculate = (overrides = {}) => calculateNewcarEstimate({
    dsNewCar: makeCar(overrides),
    codes: taxCodes
});

describe('신규등록 취득세 감면 계산', () => {
    test('감면대상이 아니면 산출된 취득세를 그대로 납부함', () => {
        const result = calculate();

        expect(result.grossAcqTax).toBe(1400000);
        expect(result.acqReductionAmt).toBe(0);
        expect(result.acqTax).toBe(1400000);
    });

    test('2자녀 6인승 이하는 50% 감면하되 70만원으로 제한함', () => {
        const result = calculate({ BUY_AMT: 40000000, STANDARD_AMT: 40000000, NTAX_TRGET_CD: '15' });

        expect(result.grossAcqTax).toBe(2800000);
        expect(result.acqReductionAmt).toBe(700000);
        expect(result.acqTax).toBe(2100000);
    });

    test('2자녀 7인승은 한도 없이 50% 감면함', () => {
        const result = calculate({
            BUY_AMT: 40000000,
            STANDARD_AMT: 40000000,
            GETIN_NO: 7,
            NTAX_TRGET_CD: '15'
        });

        expect(result.acqReductionAmt).toBe(1400000);
        expect(result.acqTax).toBe(1400000);
    });

    test('3자녀 6인승 이하는 최대 140만원 감면함', () => {
        const result = calculate({
            BUY_AMT: 30000000,
            STANDARD_AMT: 30000000,
            NTAX_TRGET_CD: '06'
        });

        expect(result.grossAcqTax).toBe(2100000);
        expect(result.acqReductionAmt).toBe(1400000);
        expect(result.acqTax).toBe(700000);
    });

    test('3자녀 7인승이고 취득세가 200만원을 넘으면 85% 감면함', () => {
        const result = calculate({
            BUY_AMT: 30000000,
            STANDARD_AMT: 30000000,
            GETIN_NO: 7,
            NTAX_TRGET_CD: '06'
        });

        expect(result.grossAcqTax).toBe(2100000);
        expect(result.acqReductionAmt).toBe(1785000);
        expect(result.acqTax).toBe(315000);
    });

    test('중증 장애인이 차량조건을 충족하면 취득세 전액 면제함', () => {
        const result = calculate({ NTAX_TRGET_CD: '04', NTAX_TRGET_GR_CD: '3' });

        expect(result.acqTax).toBe(0);
        expect(result.ntaxApplyCode).toBe('8');
    });

    test('경증 장애인은 취득세 면제를 적용하지 않음', () => {
        const result = calculate({ NTAX_TRGET_CD: '04', NTAX_TRGET_GR_CD: '4' });

        expect(result.acqReductionAmt).toBe(0);
        expect(result.acqTax).toBe(1400000);
    });

    test('수출용중고자동차의 취득세가 200만원을 넘으면 85% 감면함', () => {
        const result = calculate({
            BUY_AMT: 30000000,
            STANDARD_AMT: 30000000,
            NTAX_TRGET_CD: '11'
        });

        expect(result.acqReductionAmt).toBe(1785000);
        expect(result.acqTax).toBe(315000);
    });

    test('보훈보상대상자가 차량조건을 충족하면 50% 감면함', () => {
        const result = calculate({ NTAX_TRGET_CD: '14' });

        expect(result.acqReductionAmt).toBe(700000);
        expect(result.acqTax).toBe(700000);
    });

    test('교환자동차는 기존 차량 취득세액을 차감함', () => {
        const result = calculate({ NTAX_TRGET_CD: '09', EXCHANGE_OLD_ACQ_AMT: 900000 });

        expect(result.acqReductionAmt).toBe(900000);
        expect(result.acqTax).toBe(500000);
    });

    test('교환자동차의 기존 세액이 없으면 감면하지 않고 확인값을 반환함', () => {
        const result = calculate({ NTAX_TRGET_CD: '09' });

        expect(result.acqReductionAmt).toBe(0);
        expect(result.exemptionMissingRequirements).toContain('기존 차량 취득세액(EXCHANGE_OLD_ACQ_AMT)');
    });

    test('JSA 거주자는 조례 금액이 없으므로 자동 감면하지 않음', () => {
        const result = calculate({ NTAX_TRGET_CD: '12' });

        expect(result.acqReductionAmt).toBe(0);
        expect(result.exemptionMissingRequirements).toContain('JSA 관할 지자체 감면율 또는 감면금액');
    });
});

describe('폴스타 전기차 취득세 감면 계산', () => {
    test('전기차 취득세가 140만원이면 전액 감면함', () => {
        const result = calculate({ FUEL_CD: 'e' });

        expect(result.exemptionCode).toBe('EV');
        expect(result.acqReductionAmt).toBe(1400000);
        expect(result.acqTax).toBe(0);
        expect(result.ntaxApplyCode).toBe('8');
    });

    test('전기차 취득세가 140만원을 넘으면 초과분을 납부함', () => {
        const result = calculate({
            BUY_AMT: 30000000,
            STANDARD_AMT: 30000000,
            FUEL_CD: 'e'
        });

        expect(result.grossAcqTax).toBe(2100000);
        expect(result.acqReductionAmt).toBe(1400000);
        expect(result.acqTax).toBe(700000);
        expect(result.ntaxApplyCode).toBe('11');
    });

    test('다자녀 감면보다 전기차 감면액이 크면 전기차 감면만 적용함', () => {
        const result = calculate({
            BUY_AMT: 40000000,
            STANDARD_AMT: 40000000,
            FUEL_CD: 'e',
            NTAX_TRGET_CD: '15'
        });

        expect(result.exemptionCode).toBe('EV');
        expect(result.acqReductionAmt).toBe(1400000);
        expect(result.acqTax).toBe(1400000);
    });

    test('장애인 전액면제와 감면액이 같으면 선택한 장애인 감면을 유지함', () => {
        const result = calculate({
            FUEL_CD: 'e',
            NTAX_TRGET_CD: '04',
            NTAX_TRGET_GR_CD: '3'
        });

        expect(result.exemptionCode).toBe('04');
        expect(result.acqTax).toBe(0);
    });
});

describe('폴스타 전기차 공채 감면 계산', () => {
    test('서울 매도는 250만원 감면 후 할인율과 수수료를 계산함', () => {
        const result = calculate({ FUEL_CD: 'e' });
        const bondRow = result.updatedPaymentList.find(row => row.PAY_KD === 'BOND');

        expect(result.bondGrossAmt).toBe(4000000);
        expect(result.bondReductionAmt).toBe(2500000);
        expect(result.bondBaseAmt).toBe(1500000);
        expect(result.bond).toBe(150000);
        expect(result.bondFee).toBe(4500);
        expect(bondRow.T_VBANK_ID).toBe(1500000);
    });

    test('서울 매입은 감면 후 공채 매입액 전체를 납부함', () => {
        const result = calculate({ FUEL_CD: 'e', BOND_DC: 'BUY' });

        expect(result.bondBaseAmt).toBe(1500000);
        expect(result.bond).toBe(1500000);
    });

    test('경기도는 전기차 공채 매입액을 전액 면제함', () => {
        const result = calculate({
            FUEL_CD: 'e',
            BASE_ADDRESS: '경기도 성남시',
            BOND_AREA: '경기도'
        });

        expect(result.bondReductionAmt).toBe(4000000);
        expect(result.bondBaseAmt).toBe(0);
        expect(result.bond).toBe(0);
        expect(result.bondFee).toBe(0);
    });

    test('조회 전 전액면제 지역은 TM_BOND 값 없이도 0원 처리함', () => {
        const result = calculate({
            FUEL_CD: 'e',
            BASE_ADDRESS: '경기도 성남시',
            BOND_AREA: '경기도',
            BOND_RATE: 0,
            BOND_FULL_EXEMPT_YN: 'Y'
        });

        expect(result.bondGrossAmt).toBe(0);
        expect(result.bondBaseAmt).toBe(0);
        expect(result.bondReliefApplied).toBe(true);
        expect(result.bondReliefReason).toContain('전액면제');
    });

    test('경상북도는 전기차 공채를 최대 150만원 감면함', () => {
        const result = calculate({
            FUEL_CD: 'e',
            BASE_ADDRESS: '경상북도 포항시',
            BOND_AREA: '경상북도'
        });

        expect(result.bondReductionAmt).toBe(1500000);
        expect(result.bondBaseAmt).toBe(2500000);
        expect(result.bond).toBe(250000);
    });

    test('대전은 프로시저 ELSE 분기에 따라 전기차 공채를 전액 면제함', () => {
        const result = calculate({
            FUEL_CD: 'e',
            BASE_ADDRESS: '대전광역시 서구',
            BOND_AREA: '대전광역시'
        });

        expect(result.bondReductionAmt).toBe(4000000);
        expect(result.bondBaseAmt).toBe(0);
        expect(result.bond).toBe(0);
    });
    test('울산은 프로시저 기준 전기차 공채 감면을 적용하지 않음', () => {
        const result = calculate({
            FUEL_CD: 'e',
            BASE_ADDRESS: '울산광역시 남구',
            BOND_AREA: '울산광역시'
        });

        expect(result.bondReductionAmt).toBe(0);
        expect(result.bondBaseAmt).toBe(4000000);
        expect(result.bond).toBe(400000);
    });
});
describe('공채 할인율 공통코드 계산', () => {
    const bondSaleCodes = {
        ...taxCodes,
        TUSE: [{ CODE_ID: 'SBOND', DETAIL_NM: '21,11' }]
    };

    test('서울은 TUSE/SBOND 첫 번째 할인율을 사용함', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: makeCar({ FUEL_CD: 'e', BOND_DISCOUNT_RATE: undefined }),
            codes: bondSaleCodes
        });

        expect(result.bondDiscountAmt).toBe(315000);
        expect(result.bond).toBe(315000);
    });

    test('서울 외 지역은 TUSE/SBOND 두 번째 할인율을 사용함', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: makeCar({
                FUEL_CD: 'e',
                BOND_DISCOUNT_RATE: undefined,
                BASE_ADDRESS: '경상북도 포항시',
                BOND_AREA: '경상북도'
            }),
            codes: bondSaleCodes
        });

        expect(result.bondDiscountAmt).toBe(275000);
        expect(result.bond).toBe(275000);
    });
});
describe('TM_TAX 신규등록 세금 계산', () => {
    test('WORK_CD 010 정액 기준이면 증지대 2500원과 인지세 3000원을 적용함', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: makeCar({
                TM_TAX_INFO: {
                    WORK_CD: '010',
                    STAMP_PER: 0,
                    STAMP_AMT: 2500,
                    REGIST_PER: 0,
                    REGIST_AMT: 3000,
                    STAMP_BASE: 'STAMP_AMT',
                    REGIST_BASE: 'REGIST_AMT',
                    ACQ1_PER: 0.07,
                    ACQ2_PER: 0.05,
                    ACQ3_PER: 0.05,
                    ACQ0_PER: 0.04
                }
            }),
            codes: taxCodes
        });

        expect(result.stamp).toBe(2500);
        expect(result.inji).toBe(3000);
        expect(result.updatedPaymentList.find(row => row.PAY_KD === 'STAMP').PAY_AMT).toBe(2500);
        expect(result.updatedPaymentList.find(row => row.PAY_KD === 'INJI').PAY_AMT).toBe(3000);
    });

    test('정률 기준이면 과세표준에 STAMP_PER와 REGIST_PER를 적용함', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: makeCar({
                TM_TAX_INFO: {
                    WORK_CD: '000',
                    STAMP_PER: 0.004,
                    STAMP_AMT: 0,
                    REGIST_PER: 0.002,
                    REGIST_AMT: 0,
                    STAMP_BASE: 'STAMP_PER',
                    REGIST_BASE: 'REGIST_PER',
                    ACQ1_PER: 0.07
                }
            }),
            codes: taxCodes
        });

        expect(result.stamp).toBe(80000);
        expect(result.inji).toBe(40000);
    });
});
describe('TM_BOND VALUE 유형 계산', () => {
    test('VALUE가 정수이면 취득가액 비율이 아닌 고정 공채금액으로 사용함', () => {
        const result = calculate({
            FUEL_CD: 'g',
            BOND_RATE: 350000
        });

        expect(result.bondValueType).toBe('AMOUNT');
        expect(result.bondGrossAmt).toBe(350000);
        expect(result.bondBaseAmt).toBe(350000);
        expect(result.bond).toBe(35000);
    });
});
describe('TM_WORK_CP 등록수수료 계산', () => {
    test('로그인 회사의 WORK_CD 010 FEE 값을 등록수수료로 사용함', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: makeCar(),
            dsPaymentList: [{ PAY_KD: 'FEE', PAY_AMT: 27500, PRE_PAY_AMT: 27500 }],
            dsWorkCp: { WORK_CD: '010', COMPANY_ID: 'WA001', FEE: 33000 },
            codes: taxCodes
        });
        const feeRow = result.updatedPaymentList.find(row => row.PAY_KD === 'FEE');

        expect(result.fee).toBe(33000);
        expect(feeRow.PRE_PAY_AMT).toBe(33000);
        expect(feeRow.PAY_AMT).toBe(33000);
    });

    test('회사 서비스 설정이 없으면 기존 등록수수료를 유지함', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: makeCar(),
            dsPaymentList: [{ PAY_KD: 'FEE', PAY_AMT: 27500, PRE_PAY_AMT: 27500 }],
            codes: taxCodes
        });

        expect(result.fee).toBe(27500);
    });
});