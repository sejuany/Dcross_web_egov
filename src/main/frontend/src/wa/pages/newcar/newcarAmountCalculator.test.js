import {
    calculateNewcarEstimate,
    formatAmount
} from './newcarAmountCalculator';
import { resolveBondSearchCriteria } from './newcarCarSpec';

const calculatePolestar = (carName) => calculateNewcarEstimate({
    dsNewCar: {
        CAR_NM: carName,
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

    test.each([
        'Polestar 4 Coupe Performance',
        '  POLESTAR   4 long range dual motor  '
    ])('%s는 취득세 전기차 감면에서 제외한다', (carName) => {
        expect(calculatePolestar(carName).acqReductionAmt).toBe(0);
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

    test('취득세 감면 제외 차종도 일반 공채 면제조건은 별도로 적용한다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_NM: 'Polestar 4 Coupe Performance',
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


    test('Coupe Performance의 취득세 예외와 공채 친환경 감면은 분리한다', () => {
        const result = calculateNewcarEstimate({
            dsNewCar: {
                CAR_NM: 'Polestar 4 Coupe Performance',
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
