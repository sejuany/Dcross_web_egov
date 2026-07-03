export const WA_COMPANY_KEYWORD = 'WA';
export const WA_HOME_PATH = '/wa/newcar-status';

export const getUserCompanyId = (user) => {
    if (!user) return '';

    return String(
        user.COMPANY_ID ??
        user.company_ID ??
        user.companyId ??
        user.company_id ??
        ''
    ).trim().toUpperCase();
};

export const isWaCompanyUser = (user) => getUserCompanyId(user).includes(WA_COMPANY_KEYWORD);

export const getHomePathForUser = (user) => (
    isWaCompanyUser(user) ? WA_HOME_PATH : '/home'
);