/**
 * 회사·지점이 모두 일치하는 TM_BRANCH 등록증 설정값만 반환한다.
 * 요소 표시·비활성화·필수입력 여부는 호출 화면에서 결정하며, 원본 목록은 변경하지 않는다.
 */
export const selectBranchRegistrationOptions = (branchList = [], companyId, branchId) => {
    const company = String(companyId ?? '').trim();
    const branch = String(branchId ?? '').trim();
    if (!company || !branch) return {};
    const row = branchList.find(item => String(item.COMPANY_ID ?? '').trim() === company
        && String(item.BRANCH_ID ?? '').trim() === branch);
    if (!row) return {};
    return { CARP_MAIL_YN: row.CARP_MAIL_YN, CARP_POST_YN: row.CARP_POST_YN, CARP_SCAN_YN: row.CARP_SCAN_YN };
};
