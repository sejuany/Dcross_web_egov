export const REQUEST_STEPS = [
    { no: 1, title: '소유자 정보', label: '소유자 정보 입력' },
    // { no: 2, title: '자동차 정보', label: '자동차 정보 입력' },
    { no: 3, title: '신규등록 정보', label: '신규등록 정보 입력' },
    { no: 4, title: '최종 확인', label: '최종 확인' }
];

export const getAdjacentRequestStep = (steps, currentStep, offset) => {
    const index = steps.findIndex(({ no }) => no === currentStep);
    if (index < 0) return undefined;
    return steps[index + offset]?.no;
};

export const isRequestApplicant = (service, user) => {
    if (user?.MEMBER_GB === 'CA') {
        const companyId = String(user.COMPANY_ID || '').trim();
        const branchId = String(user.BRANCH_ID || '').trim();
        return Boolean(companyId && branchId)
            && companyId === String(service?.COMPANY_ID || '').trim()
            && branchId === String(service?.BRANCH_ID || '').trim();
    }
    const loginId = String(user?.LOGIN_ID || '').trim();
    return user?.MEMBER_GB === 'SU'
        && Boolean(loginId)
        && loginId === String(service?.MEMBER_ID || '').trim();
};

export const canEditOtherBranchRequest = (service, user) => (
    user?.MEMBER_GB === 'CA'
    && Boolean(service?.SERVICE_ID)
    && Boolean(String(user.COMPANY_ID || '').trim())
    && String(user.COMPANY_ID).trim() === String(service.COMPANY_ID || '').trim()
    && Boolean(String(user.BRANCH_ID || '').trim())
    && Boolean(String(service.BRANCH_ID || '').trim())
    && String(user.BRANCH_ID).trim() !== String(service.BRANCH_ID).trim()
    && ['INPUT', 'C_REQ', 'SAV', 'RET'].includes(service.PROC_ST)
    && !String(service.JUDGE_ST || '').trim()
);

export const isDealCompany = (dealCodes, codeId, companyId) => {
    const targetCompanyId = String(companyId || '').trim().toUpperCase();
    const companyIds = String(
        dealCodes?.find(item => item.CODE_ID === codeId)?.DETAIL_NM || ''
    ).split('|').map(value => value.trim().toUpperCase());
    return Boolean(targetCompanyId) && companyIds.includes(targetCompanyId);
};
