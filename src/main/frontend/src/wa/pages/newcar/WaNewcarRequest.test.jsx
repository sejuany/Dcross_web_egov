import { getAdjacentRequestStep, getVisibleRequestSteps, isDealCompany } from './requestSteps';
import { initialDsService, serviceMap } from './WaNewcarInitial';
import { registrationMailGuide, registrationPaperUrl } from './registrationMail';

test('빈 자동차 정보 단계를 제외하고 다음과 이전 단계로 이동한다', () => {
    const steps = getVisibleRequestSteps(true);

    expect(steps.map(({ no }) => no)).toEqual([1, 3, 4]);
    expect(getAdjacentRequestStep(steps, 1, 1)).toBe(3);
    expect(getAdjacentRequestStep(steps, 3, -1)).toBe(1);
    expect(getAdjacentRequestStep(steps, 2, 1)).toBeUndefined();
});

test('상세조회에서도 신청 지점 값을 유지한다', () => {
    expect(initialDsService).toHaveProperty('BRANCH_ID');
    expect(serviceMap.BRANCH_ID).toBe('BRANCH_ID');
});

test('DEAL 코드에 등록된 회사만 해당 후처리를 생략한다', () => {
    const dealCodes = [{ CODE_ID: 'AMOUNT', DETAIL_NM: '|WA001|WB001|' }];
    expect(isDealCompany(dealCodes, 'AMOUNT', 'WA001')).toBe(true);
    expect(isDealCompany(dealCodes, 'AMOUNT', 'WC001')).toBe(false);
});

test('등록증 이메일 안내는 폴스타와 지점 발송 여부를 구분한다', () => {
    expect(registrationMailGuide('WA001', 'Y')).toBe('등록증 및 영수증 / 차량대금 계산서가 발송됩니다.');
    expect(registrationMailGuide('WA001', 'N')).toBe('차량대금 계산서가 발송됩니다.');
    expect(registrationMailGuide('OTHER', 'Y')).toBe('등록증 및 영수증이 발송됩니다.');
});

test('등록증 경로는 심사일자와 차량번호로 만든다', () => {
    expect(registrationPaperUrl('2026-09-23', '12가3456'))
        .toBe('/api/newcar/carpaper/download?date=260923&carNo=12%EA%B0%803456');
});
