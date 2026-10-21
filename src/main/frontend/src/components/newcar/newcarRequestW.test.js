import { normalizeWData, pdfWChanges, requiredWFields, validateW, canEditW } from './newcarRequestW';

export const validWData = () => normalizeWData({
    dsUserInfo: { COMPANY_ID: 'WB001' }, dsService: { SERVICE_ID: 'TEST-SERVICE', LINK_ID: 'ORDER001', PROC_ST: 'SAV' },
    dsCarNoDetach: { CUSTOMER_NM: 'TEST-CUSTOMER', HOLE_YN: '02', SEAL_YN: '02' },
    dsNewCar: { TASK_CD: 'NORML', CARID_NO: 'AAAAAAAAAAAAAAAAA', REGIST_DATE: '2026-10-22', NUMPLATE_GB: 'F', BUY_AMT: 50000000,
        REG_GB: 'R', REG_NO: '9001011234567', OWNER_NM: 'TEST-OWNER', RATIO_NO: '100', MPHONE_NO: '01000000000',
        ADDRESS: 'TEST-ADDRESS', BASE_ADDRESS: 'TEST-BASE', NTAX_TRGET_CD: '00', CARD_YN: 'N', BOND_DC: 'SELL',
        PAY_NM: 'TEST-PAYER', PAY_HP_NO: '01000000000', RT_BANK_CD: 'TEST-BANK', RETURN_NO: '00001234', RETURN_NM: 'TEST-OWNER', CARP_ADDRESS: 'TEST-DEST' }
});

test('주문번호·계약자명을 각각의 데이터셋에서 검사하며 선택 차량번호는 필수가 아니다', () => {
    const data = validWData();
    expect(validateW(data, 'REQUEST')).toBeNull();
    data.dsService.LINK_ID = '';
    expect(validateW(data, 'REQUEST')).toMatchObject({ key: 'dsService', name: 'LINK_ID' });
    data.dsService.LINK_ID = 'ORDER001'; data.dsCarNoDetach.CUSTOMER_NM = '';
    expect(validateW(data, 'REQUEST')).toMatchObject({ key: 'dsCarNoDetach', name: 'CUSTOMER_NM' });
});
test('임시저장은 차대번호만 필수이며 잘못된 이메일도 허용하지 않는다', () => {
    const data = normalizeWData({ dsNewCar: { CARID_NO: 'AAAAAAAAAAAAAAAAA' } });
    expect(validateW(data)).toBeNull();
    data.dsNewCar.CARP_MAIL = 'bad@'; expect(validateW(data).name).toBe('CARP_MAIL');
    data.dsNewCar.CARP_MAIL = ''; data.dsNewCar.CARID_NO = ''; expect(validateW(data).name).toBe('CARID_NO');
});
test('사업자번호·감면등급은 해당 유형에만 필수이며 카드납부 N도 유효하다', () => {
    const data = validWData();
    expect(requiredWFields(data)).not.toContainEqual(['dsNewCar', 'BIZ_NO']);
    data.dsNewCar.REG_GB = 'B'; expect(validateW(data, 'REQUEST').name).toBe('BIZ_NO');
    data.dsNewCar.BIZ_NO = '1234567890'; data.dsNewCar.NTAX_TRGET_CD = '04';
    expect(validateW(data, 'REQUEST').name).toBe('NTAX_TRGET_GR_CD');
    data.dsNewCar.NTAX_TRGET_GR_CD = '01'; expect(validateW(data, 'REQUEST')).toBeNull();
});
test('공동소유자는 100% 미만에서 필수이며 활성 소유자 전체 비율을 검사한다', () => {
    const data = validWData(); data.dsNewCar.RATIO_NO = '99';
    expect(validateW(data, 'REQUEST').key).toBe('dsOwnerInfo');
    Object.assign(data.dsOwnerInfo, { DEBTOR_GB: 'R', DEBTOR_NM: 'TEST-JOINT', DEBTOR_REG_NO: '9001011234567', DEBTOR_TEL_NO: '01000000000', DEBTOR_RATIO: '1' });
    expect(validateW(data, 'REQUEST')).toBeNull();
    data.dsOwnerInfo.DEBTOR_RATIO = '2'; expect(validateW(data, 'REQUEST').name).toBe('RATIO_NO');
    data.dsNewCar.RATIO_NO = '100'; expect(validateW(data, 'REQUEST').name).toBe('RATIO_NO');
});
test('제작증은 현재 차량만 허용하고 추출되지 않은 입력을 비우지 않는다', () => {
    const data = validWData();
    expect(pdfWChanges(data.dsNewCar, { carIdNo: data.dsNewCar.CARID_NO, carName: 'TEST-MODEL', ownerName: '' }))
        .toEqual({ CARID_NO: data.dsNewCar.CARID_NO, CAR_NM: 'TEST-MODEL' });
    expect(() => pdfWChanges(data.dsNewCar, { carIdNo: 'BBBBBBBBBBBBBBBBB' })).toThrow('차대번호가 다릅니다');
    expect(() => pdfWChanges(data.dsNewCar, { carIdNo: '' })).toThrow('차대번호');
});
test('증빙정보와 등록증 이메일은 독립적이며 신청·심사 중에는 공동소유자도 잠긴다', () => {
    const data = validWData(); data.dsNewCar.CARP_MAIL = 'registration@example.com';
    data.dsTaxReceipt = { GUBUN: 'CASH', PHONE_NO: '01000000000' };
    expect(validateW(data, 'REQUEST')).toBeNull();
    data.dsTaxReceipt = { GUBUN: 'TAX' }; expect(validateW(data, 'REQUEST').key).toBe('dsTaxReceipt');
    expect(canEditW({ PROC_ST: 'P_REQ' })).toBe(false);
    expect(canEditW({ PROC_ST: 'SAV', JUDGE_ST: 'J_ING' })).toBe(false);
});
test('조회 시 공동소유자 전화번호와 날짜를 화면 필드로 복원한다', () => {
    const data = normalizeWData({ dsOwnerInfo: { DSIGN_HP_NO: '01000000000', REG_NO: '9001011234567' },
        dsNewCar: { MADE_DT: '2026-10-21T00:00:00', REGIST_DATE: '20261022' }, dsService: { JUDGE_DT: '20261023' } });
    expect(data.dsOwnerInfo.DEBTOR_TEL_NO).toBe('01000000000');
    expect(data.dsNewCar.MADE_DT).toBe('2026-10-21'); expect(data.dsNewCar.REGIST_DATE).toBe('2026-10-22');
    expect(data.dsService.JUDGE_DT).toBe('2026-10-23');
});
