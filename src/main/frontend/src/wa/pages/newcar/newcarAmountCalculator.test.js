import {
    buildNewcarEstimateKey,
    calculateNewcarEstimate
} from './newcarAmountCalculator';

const calculatePolestar = (carName) => calculateNewcarEstimate({
    dsNewCar: {
        CAR_NM: carName,
        FUEL_CD: 'e',
        CAR_SPEC_MAKER: 'POLESTAR',
        BUY_AMT: 100000000,
        NTAX_TRGET_CD: '00',
        BOND_DC: 'SELL'
    },
    dsPaymentList: [],
    dsWorkCp: {},
    codes: {}
});

describe('폴스타 전기차 취득세 감면', () => {
    test.each([
        'Polestar 4 Coupe Performance',
        '  POLESTAR   4 long range dual motor  '
    ])('%s는 전기차 취득세 감면을 적용하지 않는다', (carName) => {
        const result = calculatePolestar(carName);

        expect(result.electricVehicle).toBe(true);
        expect(result.grossAcqTax).toBe(7000000);
        expect(result.acqReductionAmt).toBe(0);
        expect(result.acqTax).toBe(7000000);
    });

    test('그 외 폴스타 전기차는 기존 취득세 감면을 유지한다', () => {
        const result = calculatePolestar('Polestar 3 Long Range Dual Motor');

        expect(result.acqReductionAmt).toBe(1400000);
        expect(result.acqTax).toBe(5600000);
        expect(result.exemptionCode).toBe('EV');
    });
});

const calculateBondPayment = (bondDc) => calculateNewcarEstimate({
    dsNewCar: {
        CAR_NM: 'Test Vehicle',
        FUEL_CD: 'g',
        BUY_AMT: 100000000,
        NTAX_TRGET_CD: '00',
        BOND_DC: bondDc,
        BOND_RATE: 0.2,
        BOND_DISCOUNT_RATE: 0.1,
        BASE_ADDRESS: '서울특별시 중구'
    },
    dsPaymentList: [],
    dsWorkCp: {},
    codes: {}
});

describe('공채 기준금액과 실제 납부액 분리', () => {
    test('매도 시 기준금액은 REAL_ALOAN, 할인 납부액은 예상/결제금액에 저장한다', () => {
        const result = calculateBondPayment('SELL');
        const bondRow = result.updatedPaymentList.find(row => row.PAY_KD === 'BOND');

        expect(result.bondBaseAmt).toBe(20000000);
        expect(result.bondDiscountAmt).toBe(2000000);
        expect(bondRow.REAL_ALOAN).toBe(20000000);
        expect(bondRow.PRE_PAY_AMT).toBe(2000000);
        expect(bondRow.PAY_AMT).toBe(2000000);
        expect(bondRow.T_VBANK_ID).toBeUndefined();
    });

    test('매입 시 기준금액과 실제 납부액은 같지만 각각의 컬럼에 저장한다', () => {
        const result = calculateBondPayment('BUY');
        const bondRow = result.updatedPaymentList.find(row => row.PAY_KD === 'BOND');

        expect(bondRow.REAL_ALOAN).toBe(20000000);
        expect(bondRow.PRE_PAY_AMT).toBe(20000000);
        expect(bondRow.PAY_AMT).toBe(20000000);
        expect(bondRow.T_VBANK_ID).toBeUndefined();
    });
});

const CORE_ESTIMATE = {
    GROSS_ACQ_AMT: 8000000,
    ACQ_AMT: 6300000,
    ACQ_SUBTRACT_AMT: 1700000,
    ACQ_RATIO: 0.08,
    UREG_AMT: null,
    BOND_PURCHASE_AMT: 12345000,
    BOND_GROSS_AMT: 15000000,
    BOND_SUBTRACT_AMT: 2655000,
    BOND_VALUE: 0.2,
    BOND_VALUE_TYPE: 'RATE',
    BOND_AREA: '서울특별시',
    NTAX_APPLC_CD: '11',
    ACQ_REASON: '서버 취득세 계산 결과',
    BOND_REASON: '서버 공채 계산 결과'
};

const paymentRow = (payKd, amount) => ({
    PAY_KD: payKd,
    PRE_PAY_AMT: amount,
    PAY_AMT: amount
});

const calculateWithCore = ({
    bondDc = 'SELL',
    cardYn = 'N',
    uregAmt = null
} = {}) => calculateNewcarEstimate({
    dsNewCar: {
        CAR_NM: 'Polestar 3 Long Range Dual Motor',
        FUEL_CD: 'e',
        CAR_SPEC_MAKER: 'POLESTAR',
        BUY_AMT: 100000000,
        STANDARD_AMT: 200000000,
        NTAX_TRGET_CD: '06',
        BOND_DC: bondDc,
        BOND_RATE: 0.9,
        BOND_DISCOUNT_RATE: 0.1,
        BASE_ADDRESS: '서울특별시 중구',
        CARD_YN: cardYn
    },
    dsPaymentList: [
        {
            PAY_KD: 'UREG',
            PRE_PAY_AMT: 43210,
            PAY_AMT: 0
        },
        paymentRow('INJI', 3000),
        paymentRow('STAMP', 2500),
        paymentRow('FEE', 1111),
        paymentRow('TNUM', 28600),
        paymentRow('UNUM', 400),
        paymentRow('SPARE', 500)
    ],
    dsWorkCp: { FEE: 7777 },
    codes: {},
    coreEstimate: {
        ...CORE_ESTIMATE,
        UREG_AMT: uregAmt
    }
});

describe('서버 핵심 예상금액 적용', () => {
    test('서버 취득세/공채를 우선하고 UREG null과 기타 결제항목은 기존값을 유지한다', () => {
        const result = calculateWithCore({ bondDc: 'SELL' });
        const rows = Object.fromEntries(
            result.updatedPaymentList.map(row => [row.PAY_KD, row])
        );

        expect(result.taxableStandard).toBe(100000000);
        expect(result.grossAcqTax).toBe(8000000);
        expect(result.acqTax).toBe(6300000);
        expect(result.acqReductionAmt).toBe(1700000);
        expect(result.acqRate).toBe(0.08);
        expect(result.ntaxApplyCode).toBe('11');
        expect(result.exemptionReason).toBe('서버 취득세 계산 결과');
        expect(result.bondGrossAmt).toBe(15000000);
        expect(result.bondReductionAmt).toBe(2655000);
        expect(result.bondBaseAmt).toBe(12345000);
        expect(result.bondReliefReason).toBe('서버 공채 계산 결과');
        expect(result.missingRequirements).toEqual([]);
        expect(result.exemptionMissingRequirements).toEqual([]);

        expect(rows.BOND.REAL_ALOAN).toBe(12345000);
        expect(rows.BOND.PRE_PAY_AMT).toBe(1234500);
        expect(rows.BOND.PAY_AMT).toBe(1234500);
        expect(rows.UREG.PRE_PAY_AMT).toBe(43210);
        expect(rows.UREG.PAY_AMT).toBe(0);
        expect(rows.FEE.PAY_AMT).toBe(7777);
        expect(rows.INJI.PAY_AMT).toBe(3000);
        expect(rows.STAMP.PAY_AMT).toBe(2500);
        expect(rows.BFEE.PAY_AMT).toBe(37035);
        expect(rows.TNUM.PAY_AMT).toBe(28600);
        expect(rows.UNUM.PAY_AMT).toBe(400);
        expect(rows.SPARE.PAY_AMT).toBe(500);
        expect(result.totalAmt).toBe(7614312);
    });

    test('매입과 서버 UREG 값을 반영하고 카드납부 합계에서는 취득세만 제외한다', () => {
        const result = calculateWithCore({
            bondDc: 'BUY',
            cardYn: 'Y',
            uregAmt: 98760
        });
        const rows = Object.fromEntries(
            result.updatedPaymentList.map(row => [row.PAY_KD, row])
        );

        expect(rows.BOND.REAL_ALOAN).toBe(12345000);
        expect(rows.BOND.PRE_PAY_AMT).toBe(12345000);
        expect(rows.BOND.PAY_AMT).toBe(12345000);
        expect(rows.UREG.PRE_PAY_AMT).toBe(98760);
        expect(rows.UREG.PAY_AMT).toBe(98760);
        expect(result.totalAmt).toBe(12523572);
    });
});

describe('예상금액 재계산 key의 서버 프로시저 입력값', () => {
    test.each([
        'PROC_CD',
        'TASK_CD',
        'FOM_NM',
        'LENGTH',
        'WIDTH',
        'HEIGHT',
        'MAX_CAP',
        'TOTAL_CAP',
        'MULTI_PURPOSE_YN'
    ])('%s 변경을 재계산 대상으로 인식한다', (field) => {
        const before = buildNewcarEstimateKey({ dsNewCar: {}, dsWorkCp: {} });
        const after = buildNewcarEstimateKey({
            dsNewCar: { [field]: 'changed' },
            dsWorkCp: {}
        });

        expect(after).not.toBe(before);
    });
});
