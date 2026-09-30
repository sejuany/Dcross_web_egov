import { isDacosUser } from './dacosRouting';

test('DACOS 회사 계정만 딜러시스템 사용자로 판별한다', () => {
    expect(isDacosUser({ COMPANY_ID: 'dacos' })).toBe(true);
    expect(isDacosUser({ company_ID: ' DACOS ' })).toBe(true);
    expect(isDacosUser({ COMPANY_ID: 'WA001' })).toBe(false);
    expect(isDacosUser(null)).toBe(false);
});
