export const DACOS_DEALER_HOME_PATH = '/dealer/newcar-status';

export const isDacosUser = (user) => String(
    user?.COMPANY_ID ??
    user?.company_ID ??
    user?.companyId ??
    user?.company_id ??
    ''
).trim().toLowerCase() === 'dacos';
