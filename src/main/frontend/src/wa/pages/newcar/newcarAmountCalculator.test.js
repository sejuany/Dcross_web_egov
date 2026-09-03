import {
    calculateNewcarEstimate,
    formatAmount
} from './newcarAmountCalculator';
import { resolveBondSearchCriteria } from './newcarCarSpec';

const calculatePolestar = (carName, ecoYn = 'Y') => calculateNewcarEstimate({
    dsNewCar: {
        CAR_NM: carName,
        ECO_YN: ecoYn,
        FUEL_CD: 'e',
        CAR_SPEC_MAKER: 'POLESTAR',
        BUY_AMT: 100000000,
        NTAX_TRGET_CD: '00',
        BOND_DC: 'SELL'
    }
});

describe('신규등록 예상금액', () => {
    test('원 단위 미만은 화면에 표시하지 않는다', () => {
        expect(formatAmount(1234567.89)).toBe('1,234,567');
    });

    test('취득세 절삭 금액은 감면액에 포함하지 않는다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_CD: '승용',
                BUY_AMT: 67281815,
                NTAX_TRGET_CD: '00',
                BOND_DC: 'BUY'
            }
        });

        expect(result.acqTax).toBe(4709720);
        expect(result.acqReductionAmt).toBe(0);
    });

    test('ECO_YN이 N이면 차명과 관계없이 취득세 전기차 감면에서 제외한다', () => {
        expect(calculatePolestar('Polestar 4 Long Range Single Motor', 'N').acqReductionAmt).toBe(0);
    });

    test.each([
        'Polestar 4 Coupe Performance',
        'Polestar 4 Long Range Dual Motor'
    ])('%s도 ECO_YN이 Y이면 취득세 감면을 적용한다', (carName) => {
        expect(calculatePolestar(carName, 'Y').acqReductionAmt).toBe(1400000);
    });

    test('Polestar 4 Long Range Single Motor는 취득세 감면을 적용한다', () => {
        expect(calculatePolestar('Polestar 4 Long Range Single Motor').acqReductionAmt).toBe(1400000);
    });

    test('공채 기준금액과 실제 납부액을 분리한다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_NM: 'Test Vehicle',
                FUEL_CD: 'g',
                BUY_AMT: 100000000,
                NTAX_TRGET_CD: '00',
                BOND_DC: 'SELL',
                BOND_RATE: 0.2,
                BOND_DISCOUNT_RATE: 0.1,
                BASE_ADDRESS: '서울특별시 중구'
            }
        });
        const bondRow = result.updatedPaymentList.find(row => row.PAY_KD === 'BOND');

        expect(bondRow.REAL_ALOAN).toBe(20000000);
        expect(bondRow.PRE_PAY_AMT).toBe(2000000);
    });


    test('전기 승용차 중증장애는 취득세와 공채를 모두 전액면제한다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_NM: 'Polestar 4 Coupe Performance',
                CAR_CD: '승용',
                CAR_CC: 0,
                GETIN_NO: 5,
                FUEL_CD: 'e',
                CAR_SPEC_MAKER: 'POLESTAR',
                BUY_AMT: 100000000,
                NTAX_TRGET_CD: '04',
                NTAX_TRGET_GR_CD: '01',
                BOND_DC: 'BUY',
                BOND_RATE: 0.2,
                BASE_ADDRESS: '울산광역시 남구'
            }
        });

        expect(result.acqTax).toBe(0);
        expect(result.bondBaseAmt).toBe(0);
        expect(result.bond).toBe(0);
    });

    test('공동경비구역 거주자는 감면대상 자체의 공채 면제를 적용하지 않는다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_NM: '일반 승용차',
                CAR_CD: '승용',
                CAR_CC: 2000,
                GETIN_NO: 5,
                FUEL_CD: 'g',
                BUY_AMT: 71000000,
                NTAX_TRGET_CD: '12',
                BOND_DC: 'SELL',
                BOND_RATE: 0.05,
                BASE_ADDRESS: '경기도 파주시 군내면 대성동길 150'
            }
        });

        expect(result.acqTax).toBe(0);
        expect(result.bondPreExempt).toBe(false);
        expect(result.bondGrossAmt).toBe(3550000);
        expect(result.bondBaseAmt).toBe(3550000);
        expect(result.bondReliefApplied).toBe(false);
    });

    test('비영리사업자는 감면대상 자체의 공채 면제를 적용하지 않는다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_NM: '일반 승용차',
                CAR_CD: '승용',
                CAR_CC: 2000,
                GETIN_NO: 5,
                FUEL_CD: 'g',
                BUY_AMT: 71000000,
                NTAX_TRGET_CD: '13',
                BOND_DC: 'SELL',
                BOND_RATE: 0.05,
                BASE_ADDRESS: '서울특별시 중구'
            }
        });

        expect(result.acqTax).toBe(0);
        expect(result.bondPreExempt).toBe(false);
        expect(result.bondGrossAmt).toBe(3550000);
        expect(result.bondBaseAmt).toBe(3550000);
        expect(result.bondReliefApplied).toBe(false);
    });

    test('보훈보상대상자는 취득세를 50% 감면한다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_CD: '승용',
                CAR_CC: 2000,
                GETIN_NO: 5,
                FUEL_CD: 'g',
                BUY_AMT: 100000000,
                NTAX_TRGET_CD: '14',
                BOND_DC: 'BUY',
                BOND_RATE: 0
            }
        });

        expect(result.grossAcqTax).toBe(7000000);
        expect(result.acqReductionAmt).toBe(3500000);
        expect(result.acqTax).toBe(3500000);
        expect(result.ntaxApplyCode).toBe('11');
    });

    test.each([
        ['장애인 경증', '04', '05'],
        ['장애인 4급', '04', '4'],
        ['장애인 5급', '04', '5'],
        ['장애인 6급', '04', '6'],
        ['시각장애 경증', '05', '05'],
        ['시각장애 5급', '05', '5'],
        ['시각장애 6급', '05', '6']
    ])('%s은 취득세는 전기차 감면, 공채는 장애감면 전액면제를 적용한다', (_, targetCode, gradeCode) => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_NM: 'Polestar 4 Long Range Single Motor',
                CAR_CD: '승용',
                CAR_CC: 0,
                GETIN_NO: 5,
                FUEL_CD: 'e',
                CAR_SPEC_MAKER: 'POLESTAR',
                BUY_AMT: 71000000,
                NTAX_TRGET_CD: targetCode,
                NTAX_TRGET_GR_CD: gradeCode,
                BOND_DC: 'SELL',
                BOND_RATE: 0.05,
                BASE_ADDRESS: '서울특별시 중구'
            }
        });

        expect(result.grossAcqTax).toBe(4970000);
        expect(result.acqReductionAmt).toBe(1400000);
        expect(result.acqTax).toBe(3570000);
        expect(result.exemptionName).toBe('전기자동차');
        expect(result.exemptionReason).toBe('전기자동차 취득세 최대 140만원 감면');
        expect(result.bondPreExempt).toBe(true);
        expect(result.bondReductionAmt).toBe(3550000);
        expect(result.bondBaseAmt).toBe(0);
        expect(result.bondReliefReason).toContain('공채 전액면제');
    });

    test('서울 전기차 보훈보상대상자는 공채 전액면제가 아닌 250만원 정액감면을 적용한다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_NM: 'Polestar 4 Long Range Single Motor',
                CAR_CD: '승용',
                CAR_CC: 0,
                GETIN_NO: 5,
                FUEL_CD: 'e',
                CAR_SPEC_MAKER: 'POLESTAR',
                BUY_AMT: 71909091,
                NTAX_TRGET_CD: '14',
                NTAX_TRGET_GR_CD: '1',
                BOND_DC: 'SELL',
                BOND_RATE: 0.05,
                BOND_DISCOUNT_RATE: 0.1,
                BASE_ADDRESS: '서울특별시 중구'
            }
        });

        expect(result.acqReductionAmt).toBeCloseTo(2516818.185, 3);
        expect(result.bondPreExempt).toBe(false);
        expect(result.bondGrossAmt).toBe(3595454);
        expect(result.bondReductionAmt).toBe(2500000);
        expect(result.bondBaseAmt).toBe(1095000);
        expect(result.bond).toBe(109500);
    });

    test('ECO_YN 취득세 감면 제외 차량도 일반 공채 면제조건은 별도로 적용한다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_NM: 'Polestar 4 Coupe Performance',
                ECO_YN: 'N',
                CAR_CD: '승용',
                CAR_CC: 0,
                GETIN_NO: 5,
                FUEL_CD: 'e',
                CAR_SPEC_MAKER: 'POLESTAR',
                BUY_AMT: 100000000,
                NTAX_TRGET_CD: '00',
                BOND_DC: 'BUY',
                BOND_RATE: 0.2,
                BASE_ADDRESS: '울산광역시 남구'
            }
        });

        expect(result.acqReductionAmt).toBe(0);
        expect(result.bond).toBe(0);
        expect(result.bondReliefReason).toContain('1600cc 미만');
    });

    test('PROC_CD C는 취득세 2%와 승용 등록면허세 5%를 적용한다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                PROC_CD: 'C',
                TASK_CD: 'LEASE',
                CAR_CD: '승용',
                CAR_CC: 2000,
                BUY_AMT: 10000000,
                NTAX_TRGET_CD: '00',
                BOND_DC: 'BUY',
                BOND_RATE: 0,
                BASE_ADDRESS: '대구광역시 중구'
            }
        });

        expect(result.acqTax).toBe(200000);
        expect(result.ureg).toBe(500000);
    });


    test('ECO_YN 취득세 예외와 공채 친환경 감면은 분리한다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_NM: 'Polestar 4 Coupe Performance',
                ECO_YN: 'N',
                CAR_CD: '승용',
                CAR_CC: 0,
                GETIN_NO: 5,
                FM_NM: 'FM12345',
                FOM_NM: 'EV-MOTOR',
                FUEL_CD: 'e',
                BUY_AMT: 100000000,
                NTAX_TRGET_CD: '00',
                BOND_DC: 'BUY',
                BOND_RATE: 0.05,
                BASE_ADDRESS: '서울특별시 중구',
                TM_TAX_INFO: {
                    HYBRID_FM_EXCLUSIONS: '',
                    HYBRID_OK_PATTERNS: '|EV-MOTOR|'
                }
            }
        });

        expect(result.acqReductionAmt).toBe(0);
        expect(result.bondReductionAmt).toBe(2500000);
        expect(result.bondBaseAmt).toBe(2500000);
    });

    test('Polestar 4 Coupe Long Range Dual Motor의 서울 공채 250만원 감면 산식을 유지한다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_NM: 'Polestar 4 Coupe Long Range Dual Motor',
                CAR_CD: '승용',
                CAR_CC: 0,
                GETIN_NO: 5,
                FOM_NM: 'EV-MOTOR',
                FUEL_CD: 'e',
                BUY_AMT: 71909091,
                // 화면에서 비과세 미적용을 선택하지 않은 초기 상태
                NTAX_TRGET_CD: '',
                BOND_DC: 'SELL',
                BOND_RATE: 0.05,
                BOND_DISCOUNT_RATE: 0.1,
                BASE_ADDRESS: '서울특별시 중구',
                TM_TAX_INFO: {
                    HYBRID_FM_EXCLUSIONS: '',
                    HYBRID_OK_PATTERNS: '|EV-MOTOR|'
                }
            }
        });

        expect(result.acqReductionAmt).toBe(1400000);
        expect(result.acqTax).toBe(3633630);
        expect(result.bondPreExempt).toBe(false);
        expect(result.bondGrossAmt).toBe(3595454);
        expect(result.bondReductionLimit).toBe(2500000);
        expect(result.bondReductionAmt).toBe(2500000);
        expect(result.bondBaseAmt).toBe(1095000);
        expect(result.bond).toBe(109500);
    });

    test('감면 해제 후 이전 공채 전액면제 조회값을 재사용하지 않는다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_NM: 'Polestar 4 Coupe Long Range Dual Motor',
                CAR_CD: '승용',
                CAR_CC: 0,
                GETIN_NO: 5,
                FOM_NM: 'EV-MOTOR',
                FUEL_CD: 'e',
                BUY_AMT: 80000000,
                NTAX_TRGET_CD: '00',
                BOND_DC: 'SELL',
                BOND_RATE: 0.05,
                BOND_DISCOUNT_RATE: 0.18,
                BOND_FULL_EXEMPT_YN: 'Y',
                BASE_ADDRESS: '서울특별시 은평구',
                TM_TAX_INFO: {
                    HYBRID_FM_EXCLUSIONS: '',
                    HYBRID_OK_PATTERNS: '|EV-MOTOR|'
                }
            }
        });

        expect(result.bondPreExempt).toBe(false);
        expect(result.bondGrossAmt).toBe(4000000);
        expect(result.bondReductionAmt).toBe(2500000);
        expect(result.bondBaseAmt).toBe(1500000);
        expect(result.bond).toBe(270000);
        expect(result.bondFee).toBe(4500);
    });

    test('서울 전기차의 3자녀 감면은 취득세 140만원과 공채 250만원을 각각 감면한다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_NM: 'Polestar 4 Coupe Long Range Dual Motor',
                CAR_CD: '승용',
                CAR_CC: 0,
                GETIN_NO: 5,
                FOM_NM: 'EV-MOTOR',
                FUEL_CD: 'e',
                BUY_AMT: 80000000,
                NTAX_TRGET_CD: '06',
                BOND_DC: 'SELL',
                BOND_RATE: 0.05,
                BOND_DISCOUNT_RATE: 0.18,
                BASE_ADDRESS: '서울특별시 은평구',
                TM_TAX_INFO: {
                    HYBRID_FM_EXCLUSIONS: '',
                    HYBRID_OK_PATTERNS: '|EV-MOTOR|'
                }
            }
        });

        expect(result.acqReductionAmt).toBe(1400000);
        expect(result.acqTax).toBe(4200000);
        expect(result.bondPreExempt).toBe(false);
        expect(result.bondReliefReason).toBe('전기·수소차 공채 감면');
        expect(result.bondGrossAmt).toBe(4000000);
        expect(result.bondReductionAmt).toBe(2500000);
        expect(result.bondBaseAmt).toBe(1500000);
        expect(result.bond).toBe(270000);
        expect(result.bondFee).toBe(4500);
    });

    test('서울 전기차 공채 조회값은 차체 크기로 정한다', () => {
        expect(resolveBondSearchCriteria({
            BASE_ADDRESS: '서울특별시 중구',
            CAR_CD: '승용',
            CAR_CC: 0,
            GETIN_NO: 5,
            FUEL_CD: 'e',
            LENGTH: 4839,
            WIDTH: 2008,
            HEIGHT: 1534
        })).toMatchObject({
            area: '서울특별시',
            carGb: 'e',
            baseValue: 1500
        });
    });

    test('서울 외 전기 승용차는 CAR_GB 1로 조회한다', () => {
        expect(resolveBondSearchCriteria({
            BASE_ADDRESS: '충청북도 청주시',
            CAR_CD: '승용',
            CAR_CC: 0,
            GETIN_NO: 5,
            FUEL_CD: 'e'
        })).toMatchObject({
            area: '충청북도',
            carGb: '1',
            baseValue: 0
        });
    });
});
