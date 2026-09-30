export const REQUEST_STEPS = [
    { no: 1, title: '소유자 정보', label: '소유자 정보 입력' },
    { no: 2, title: '자동차 정보', label: '자동차 정보 입력' },
    { no: 3, title: '신규등록 정보', label: '신규등록 정보 입력' },
    { no: 4, title: '최종 확인', label: '최종 확인' }
];

export const getVisibleRequestSteps = (skipVehicleStep) => (
    skipVehicleStep ? REQUEST_STEPS.filter(({ no }) => no !== 2) : REQUEST_STEPS
);

export const getAdjacentRequestStep = (steps, currentStep, offset) => {
    const index = steps.findIndex(({ no }) => no === currentStep);
    if (index < 0) return undefined;
    return steps[index + offset]?.no;
};

export const isDealCompany = (dealCodes, codeId, companyId) => {
    const targetCompanyId = String(companyId || '').trim().toUpperCase();
    const companyIds = String(
        dealCodes?.find(item => item.CODE_ID === codeId)?.DETAIL_NM || ''
    ).split('|').map(value => value.trim().toUpperCase());
    return Boolean(targetCompanyId) && companyIds.includes(targetCompanyId);
};
