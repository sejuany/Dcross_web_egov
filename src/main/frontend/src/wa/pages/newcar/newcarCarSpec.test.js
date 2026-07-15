import {
    buildCarSpecPatch,
    isElectricBondLookupExemptArea,
    resolveBondSearchCriteria
} from './newcarCarSpec';

const carSpec = {
    MAKER: 'POLESTAR',
    CAR_NM: 'Polestar 4',
    MADE_DT: '20260101',
    MADE_YY: '2026',
    CAR_CC: 0,
    GETIN_NO: 5,
    FM_NM: 'PS4-FM',
    CAR_KD: '승용',
    CAR_KD_CD: '1',
    FUEL_CD: 'e',
    VH_TY_CD: '3',
    BUY_AMT: 66900000,
    VHCTY_ASORT_CODE: '1'
};

describe('회사별 차량제원 반영', () => {
    test('차량제원과 테이블 공급가액을 계산 상태로 변환함', () => {
        const result = buildCarSpecPatch({ BUY_AMT: 0, VH_TY_CD: '3' }, carSpec);

        expect(result.CAR_NM).toBe('Polestar 4');
        expect(result.GETIN_NO).toBe(5);
        expect(result.FM_NM).toBe('PS4-FM');
        expect(result.FUEL_CD).toBe('e');
        expect(result.VH_TY_CD).toBe('3');
        expect(result.BUY_AMT).toBe(66900000);
        expect(result.VHCTY_ASORT_CODE).toBe('1');
    });

    test('사용자가 입력한 공급가액은 테이블 공급가액보다 우선함', () => {
        const result = buildCarSpecPatch({
            BUY_AMT: '70,000,000',
            STANDARD_AMT: 50000000
        }, carSpec);

        expect(result.BUY_AMT).toBe('70,000,000');
        expect(result.STANDARD_AMT).toBe(0);
    });
});

describe('전기차 공채 조회 전 면제 지역', () => {
    test.each(['경기도', '부산광역시', '대구광역시', '경상남도'])(
        '%s는 TM_BOND 조회 전에 전액면제 처리함',
        area => expect(isElectricBondLookupExemptArea(area + ' 시청')).toBe(true)
    );

    test('서울은 지역 공채값 조회가 필요함', () => {
        expect(isElectricBondLookupExemptArea('서울특별시 강남구')).toBe(false);
    });
});

describe('다목적형 공채 조회 기준', () => {
    test.each([
        ['서울특별시 강남구', 5, 'e', 10000],
        ['서울특별시 강남구', 7, '2', 1011],
        ['부산광역시 해운대구', 5, '1', 1000],
        ['대구광역시 수성구', 5, '1', 1000],
        ['경상남도 창원시', 5, '1', 1600],
        ['인천광역시 연수구', 5, '1', 0],
        ['제주특별자치도 제주시', 5, '1', 1600],
        ['대전광역시 유성구', 5, '1', 0]
    ])('%s %i인승 다목적형은 CAR_GB=%s, 비교값=%i를 적용함', (baseAddress, getInNo, carGb, baseValue) => {
        const result = resolveBondSearchCriteria({
            BASE_ADDRESS: baseAddress,
            CAR_CC: 0,
            GETIN_NO: getInNo,
            VH_TY_CD: '3'
        });

        expect(result.carGb).toBe(carGb);
        expect(result.baseValue).toBe(baseValue);
        expect(result.multiPurpose).toBe(true);
    });

    test('다목적형이 아니면 기존 전기차 배기량 기준을 유지함', () => {
        const result = resolveBondSearchCriteria({
            BASE_ADDRESS: '서울특별시 강남구',
            CAR_CC: 500,
            GETIN_NO: 5,
            VH_TY_CD: ''
        });

        expect(result.carGb).toBe('e');
        expect(result.baseValue).toBe(500);
        expect(result.multiPurpose).toBe(false);
    });
});