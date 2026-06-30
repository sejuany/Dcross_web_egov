export const WA_COMPANY_ID = 'WA001';

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

export const isWaCompanyUser = (user) => getUserCompanyId(user) === WA_COMPANY_ID;