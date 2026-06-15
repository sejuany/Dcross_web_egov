package com.dacos.company;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dacos.common.BusinessException;
import com.dacos.company.dto.CompanySearchRequest;
import com.dacos.company.mapper.CompanyMapper;

/**
 * 기업관리 서비스
 */
@Service
public class CompanyService {
    private static final Logger logger = LoggerFactory.getLogger(CompanyService.class);

    private static final String ROLE_CA = "CA";
    private static final String ROLE_BA = "BA";
    private static final String ROLE_SA = "SA";
    private static final String ROLE_SU = "SU";

    private final CompanyMapper companyMapper;

    public CompanyService(CompanyMapper companyMapper) {
        this.companyMapper = companyMapper;
    }

    public List<Map<String, Object>> getCompanyList(CompanySearchRequest request) {
        logger.info("[CompanyService] 기업 목록 조회");
        return companyMapper.getCompanyList(request);
    }

    public Map<String, Object> getCompanyDetail(String companyId) {
        logger.info("[CompanyService] 기업 상세 조회 - companyId: {}", companyId);

        Map<String, Object> detail = companyMapper.getCompanyDetail(companyId);

        if (detail == null || detail.isEmpty()) {
            throw new BusinessException("해당 기업 ID의 데이터를 찾을 수 없습니다: " + companyId, 404);
        }

        return detail;
    }

    public List<Map<String, Object>> getBranchSelectList(CompanySearchRequest request) {
        logger.info("[CompanyService] 지점 목록 조회 - companyId: {}", request.getCOMPANY_ID());

        if (isBlank(request.getCOMPANY_ID())) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        return companyMapper.getBranchSelectList(request);
    }

    /**
     * 기존 호출용.
     * 기존 일반회원사 동작을 깨지 않기 위해 유지.
     */
    public List<Map<String, Object>> getCompanyUserList(CompanySearchRequest request) {
        logger.info("[CompanyService] 사용자 목록 조회");
        return companyMapper.getCompanyUserList(request);
    }

    /**
     * 세션 로그인 사용자 기준 권한 스코프 적용 버전.
     * Controller에서 session user를 넘길 때 사용.
     */
    public List<Map<String, Object>> getCompanyUserList(CompanySearchRequest request, Object loginUser) {
        logger.info("[CompanyService] 사용자 목록 조회 - 권한 적용");

        applyCompanyUserSearchScope(request, loginUser);

        return companyMapper.getCompanyUserList(request);
    }

    /**
     * 기존 호출용.
     * 기존 일반회원사 동작을 깨지 않기 위해 유지.
     */
    public List<Map<String, Object>> getCompanyUserWork(CompanySearchRequest request) {
        logger.info(
                "[CompanyService] 사용자 업무권한 조회 - companyId: {}, memberId: {}",
                request.getCOMPANY_ID(),
                request.getMEMBER_ID()
        );

        if (isBlank(request.getCOMPANY_ID())) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        if (isBlank(request.getMEMBER_ID())) {
            throw new BusinessException("회원 ID가 없습니다.", 400);
        }

        return companyMapper.getCompanyUserWork(request);
    }

    /**
     * 세션 로그인 사용자 기준 권한 스코프 적용 버전.
     */
    public List<Map<String, Object>> getCompanyUserWork(CompanySearchRequest request, Object loginUser) {
        logger.info(
                "[CompanyService] 사용자 업무권한 조회 - 권한 적용 - companyId: {}, memberId: {}",
                request.getCOMPANY_ID(),
                request.getMEMBER_ID()
        );

        if (isBlank(request.getCOMPANY_ID())) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        if (isBlank(request.getMEMBER_ID())) {
            throw new BusinessException("회원 ID가 없습니다.", 400);
        }

        validateCompanyUserWorkScope(request, loginUser);

        return companyMapper.getCompanyUserWork(request);
    }

    public List<Map<String, Object>> getCompanyManageOptions(CompanySearchRequest request) {
        logger.info("[CompanyService] 기업관리 회원사 콤보 조회");
        return companyMapper.getCompanyManageOptions(request);
    }

    public Map<String, Object> getCompanyManageDetail(CompanySearchRequest request) {
        logger.info("[CompanyService] 기업관리 상세 조회 - companyId: {}", request.getCOMPANY_ID());

        if (isBlank(request.getCOMPANY_ID())) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        Map<String, Object> company = companyMapper.getCompanyManageDetail(request);

        if (company == null || company.isEmpty()) {
            throw new BusinessException("해당 회원사 정보를 찾을 수 없습니다: " + request.getCOMPANY_ID(), 404);
        }

        List<Map<String, Object>> baseAddrList = companyMapper.getCompanyManageBaseAddrList(request);
        List<Map<String, Object>> serviceList = companyMapper.getCompanyManageServiceList(request);

        Map<String, Object> result = new HashMap<>();
        result.put("company", company);
        result.put("baseAddrList", baseAddrList);
        result.put("serviceList", serviceList);

        return result;
    }

    public List<Map<String, Object>> getCompanyManageServiceList(CompanySearchRequest request) {
        logger.info("[CompanyService] 기업관리 서비스 설정 조회 - companyId: {}", request.getCOMPANY_ID());

        if (isBlank(request.getCOMPANY_ID())) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        return companyMapper.getCompanyManageServiceList(request);
    }

    @Transactional
    public Map<String, Object> saveCompanyManage(Map<String, Object> request) {
        logger.info("[CompanyService] 기업관리 저장");

        Map<String, Object> company = (Map<String, Object>) request.get("company");
        List<Map<String, Object>> baseAddrList = (List<Map<String, Object>>) request.get("baseAddrList");
        List<Map<String, Object>> serviceList = (List<Map<String, Object>>) request.get("serviceList");

        if (company == null || company.isEmpty()) {
            throw new BusinessException("회원사 기본정보가 없습니다.", 400);
        }

        String companyId = toStr(company.get("COMPANY_ID"));

        if (isBlank(companyId)) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        if (isBlank(toStr(company.get("INS_USER")))) {
            company.put("INS_USER", companyId);
        }

        int updateCount = companyMapper.updateCompanyManageInfo(company);

        if (updateCount <= 0) {
            throw new BusinessException("회원사 기본정보 저장에 실패했습니다.", 500);
        }

        /*
         * baseAddrList가 null이면 사용본거지는 건드리지 않음.
         * 특수회원사 CA가 회사 기본정보만 저장할 때 기존 사용본거지 삭제 방지.
         */
        if (baseAddrList != null) {
            companyMapper.deleteCompanyManageBaseAddr(company);

            for (Map<String, Object> baseAddr : baseAddrList) {
                if (baseAddr == null) {
                    continue;
                }

                baseAddr.put("COMPANY_ID", companyId);

                if (isBlank(toStr(baseAddr.get("INS_USER")))) {
                    baseAddr.put("INS_USER", company.get("INS_USER"));
                }

                if (!isBlank(toStr(baseAddr.get("BASE_NM")))) {
                    companyMapper.insertCompanyManageBaseAddr(baseAddr);
                }
            }
        }

        /*
         * serviceList가 null이면 서비스 설정은 건드리지 않음.
         * DACOS가 아닌 계정에서 저장할 때 TM_WORK_CP 삭제 방지.
         */
        if (serviceList != null) {
            companyMapper.deleteCompanyManageService(company);

            for (Map<String, Object> service : serviceList) {
                if (service == null) {
                    continue;
                }

                service.put("COMPANY_ID", companyId);

                if (isBlank(toStr(service.get("INS_USER")))) {
                    service.put("INS_USER", company.get("INS_USER"));
                }

                if (!isBlank(toStr(service.get("WORK_CD")))) {
                    companyMapper.insertCompanyManageService(service);
                }
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("saved", true);
        result.put("COMPANY_ID", companyId);

        return result;
    }

    public List<Map<String, Object>> getCompanyManageBranchList(Map<String, Object> request) {
        logger.info("[CompanyService] 기업관리 지점 목록 조회 - companyId: {}, branchId: {}",
                request.get("COMPANY_ID"),
                request.get("BRANCH_ID")
        );

        if (isBlank(toStr(request.get("COMPANY_ID")))) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        return companyMapper.getCompanyManageBranchList(request);
    }

    @Transactional
    public Map<String, Object> saveCompanyManageBranch(Map<String, Object> request) {
        logger.info("[CompanyService] 기업관리 지점 저장 - companyId: {}, branchId: {}",
                request.get("COMPANY_ID"),
                request.get("BRANCH_ID")
        );

        String companyId = toStr(request.get("COMPANY_ID"));
        String branchNm = toStr(request.get("BRANCH_NM"));
        String branchId = toStr(request.get("BRANCH_ID"));

        if (isBlank(companyId)) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        if (isBlank(branchNm)) {
            throw new BusinessException("지점명을 입력해주세요.", 400);
        }

        if (isBlank(toStr(request.get("INS_USER")))) {
            request.put("INS_USER", companyId);
        }

        int resultCount;

        if (isBlank(branchId)) {
            String nextBranchId = companyMapper.getNextBranchId(request);

            if (isBlank(nextBranchId)) {
                throw new BusinessException("지점 ID 채번에 실패했습니다.", 500);
            }

            request.put("BRANCH_ID", nextBranchId);
            resultCount = companyMapper.insertCompanyManageBranch(request);
        } else {
            resultCount = companyMapper.updateCompanyManageBranch(request);

            if (resultCount <= 0) {
                resultCount = companyMapper.insertCompanyManageBranch(request);
            }
        }

        if (resultCount <= 0) {
            throw new BusinessException("지점정보 저장에 실패했습니다.", 500);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("saved", true);
        result.put("COMPANY_ID", request.get("COMPANY_ID"));
        result.put("BRANCH_ID", request.get("BRANCH_ID"));

        return result;
    }

    @Transactional
    public Map<String, Object> updateSangsa(Map<String, Object> request) {
        logger.info("[CompanyService] 영업팀 수정 - companyId: {}, branchId: {}, sangsaId: {}",
                request.get("COMPANY_ID"),
                request.get("BRANCH_ID"),
                request.get("SANGSA_ID")
        );

        if (isBlank(toStr(request.get("COMPANY_ID")))) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        if (isBlank(toStr(request.get("BRANCH_ID")))) {
            throw new BusinessException("지점 ID가 없습니다.", 400);
        }

        if (isBlank(toStr(request.get("SANGSA_ID")))) {
            throw new BusinessException("영업팀 ID가 없습니다.", 400);
        }

        if (isBlank(toStr(request.get("SANGSA_NM")))) {
            throw new BusinessException("영업팀명을 입력해주세요.", 400);
        }

        if (isBlank(toStr(request.get("INS_USER")))) {
            request.put("INS_USER", request.get("COMPANY_ID"));
        }

        int updateCount = companyMapper.updateSangsa(request);

        if (updateCount <= 0) {
            throw new BusinessException("영업팀 수정에 실패했습니다.", 500);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("updated", true);
        result.put("COMPANY_ID", request.get("COMPANY_ID"));
        result.put("BRANCH_ID", request.get("BRANCH_ID"));
        result.put("SANGSA_ID", request.get("SANGSA_ID"));

        return result;
    }

    /**
     * 기존 호출용.
     * 기존 일반회원사 동작을 깨지 않기 위해 유지.
     */
    public Map<String, Object> getBranchWorkInfo(CompanySearchRequest request) {
        logger.info(
                "[CompanyService] 지점 업무정보 조회 - companyId: {}, branchId: {}",
                request.getCOMPANY_ID(),
                request.getBRANCH_ID()
        );

        if (isBlank(request.getCOMPANY_ID())) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        if (isBlank(request.getBRANCH_ID())) {
            throw new BusinessException("지점 ID가 없습니다.", 400);
        }

        Map<String, Object> data = companyMapper.getBranchWorkInfo(request);

        if (data == null) {
            return new HashMap<>();
        }

        return data;
    }

    /**
     * 세션 로그인 사용자 기준 권한 스코프 적용 버전.
     */
    public Map<String, Object> getBranchWorkInfo(CompanySearchRequest request, Object loginUser) {
        logger.info(
                "[CompanyService] 지점 업무정보 조회 - 권한 적용 - companyId: {}, branchId: {}",
                request.getCOMPANY_ID(),
                request.getBRANCH_ID()
        );

        if (isBlank(request.getCOMPANY_ID())) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        if (isBlank(request.getBRANCH_ID())) {
            throw new BusinessException("지점 ID가 없습니다.", 400);
        }

        validateBranchWorkScope(request, loginUser);

        Map<String, Object> data = companyMapper.getBranchWorkInfo(request);

        if (data == null) {
            return new HashMap<>();
        }

        return data;
    }

    /**
     * 기존 호출용.
     * 기존 일반회원사 동작을 깨지 않기 위해 유지.
     */
    @Transactional
    public Map<String, Object> updateCompanyUserWork(Map<String, Object> request) {
        logger.info("[CompanyService] 사용자 권한정보 저장");

        Map<String, Object> memberInfo = (Map<String, Object>) request.get("memberInfo");
        Map<String, Object> workInfo = (Map<String, Object>) request.get("workInfo");

        if (memberInfo == null || memberInfo.isEmpty()) {
            throw new BusinessException("회원 기본정보가 없습니다.", 400);
        }

        if (workInfo == null || workInfo.isEmpty()) {
            throw new BusinessException("회원 권한정보가 없습니다.", 400);
        }

        validateMemberInfo(memberInfo);

        /*
         * 기존 Dcross memberService.updMemberWork 순서
         * 1. TR_ACCOUNT_AUTH 변경이력 저장
         * 2. TM_MEMBER_DT 수정
         * 3. TM_MEMBER_MT 수정
         * 4. TM_WORK_MB 삭제
         * 5. 업무권한 5개 재등록
         */

        Map<String, Object> history = new HashMap<>();
        history.putAll(workInfo);
        history.putAll(memberInfo);

        companyMapper.insertAccountAuthHistory(history);

        companyMapper.updateCompanyUserDetail(memberInfo);
        companyMapper.updateCompanyUserMaster(memberInfo);
        
        /*
         * TM_MEMBER_ETC 이메일 저장
         * - 기존 row가 있으면 UPDATE
         * - 없으면 INSERT
         * - 이메일을 빈값으로 저장하면 MEMBER_MAIL도 NULL/빈값 처리
         */
        Object memberMailObj = memberInfo.get("MEMBER_MAIL");
        String memberMail = memberMailObj == null ? "" : String.valueOf(memberMailObj).trim();

        Map<String, Object> memberEtc = new HashMap<>();
        memberEtc.put("LOGIN_ID", memberInfo.get("LOGIN_ID"));
        memberEtc.put("MEMBER_ID", memberInfo.get("MEMBER_ID"));
        memberEtc.put("COMPANY_ID", memberInfo.get("COMPANY_ID"));
        memberEtc.put("MEMBER_MAIL", memberMail);
        memberEtc.put("UPD_USER", memberInfo.get("INS_USER"));

        logger.info(
                "[CompanyService] TM_MEMBER_ETC 이메일 저장 - LOGIN_ID: {}, MEMBER_ID: {}, COMPANY_ID: {}, MEMBER_MAIL: {}",
                memberEtc.get("LOGIN_ID"),
                memberEtc.get("MEMBER_ID"),
                memberEtc.get("COMPANY_ID"),
                memberEtc.get("MEMBER_MAIL")
        );

        companyMapper.mergeCompanyUserEtc(memberEtc);

        companyMapper.deleteCompanyUserWork(memberInfo);

        companyMapper.insertMortRegWork(makeWorkParam(memberInfo, workInfo, "MORTREG_USE", "MORTREG_PERM"));
        companyMapper.insertMortErsWork(makeWorkParam(memberInfo, workInfo, "MORTERS_USE", "MORTERS_PERM"));
        companyMapper.insertNewCarWork(makeWorkParam(memberInfo, workInfo, "NEWCAR_USE", "NEWCAR_PERM"));
        companyMapper.insertTrnsNameWork(makeWorkParam(memberInfo, workInfo, "TRNSNAME_USE", "TRNSNAME_PERM"));
        companyMapper.insertModifyWork(makeWorkParam(memberInfo, workInfo, "MODIFY_USE", "MODIFY_PERM"));

        Map<String, Object> result = new HashMap<>();
        result.put("updated", true);
        result.put("LOGIN_ID", memberInfo.get("LOGIN_ID"));
        result.put("MEMBER_ID", memberInfo.get("MEMBER_ID"));
        result.put("COMPANY_ID", memberInfo.get("COMPANY_ID"));

        return result;
    }

    /**
     * 세션 로그인 사용자 기준 권한 스코프 적용 버전.
     */
    @Transactional
    public Map<String, Object> updateCompanyUserWork(Map<String, Object> request, Object loginUser) {
        logger.info("[CompanyService] 사용자 권한정보 저장 - 권한 적용");

        Map<String, Object> memberInfo = (Map<String, Object>) request.get("memberInfo");

        if (memberInfo == null || memberInfo.isEmpty()) {
            throw new BusinessException("회원 기본정보가 없습니다.", 400);
        }

        validateCompanyUserTargetScope(memberInfo, loginUser);

        return updateCompanyUserWork(request);
    }

    /**
     * 기존 호출용.
     * 기존 일반회원사 동작을 깨지 않기 위해 유지.
     */
    @Transactional
    public Map<String, Object> resetCompanyUserPassword(Map<String, Object> request) {
        logger.info("[CompanyService] 사용자 패스워드 초기화 - loginId: {}", request.get("LOGIN_ID"));

        String loginId = toStr(request.get("LOGIN_ID"));
        String updUser = toStr(request.get("UPD_USER"));

        if (isBlank(loginId)) {
            throw new BusinessException("로그인 ID가 없습니다.", 400);
        }

        if (isBlank(updUser)) {
            updUser = loginId;
        }

        Map<String, Object> param = new HashMap<>();
        param.put("LOGIN_ID", loginId);
        param.put("PASS_WD", encryptSha256("a1234567"));
        param.put("UPD_USER", updUser);
        param.put("ERROR_COUNT", "0");

        companyMapper.resetCompanyUserPassword(param);
        companyMapper.updatePasswordDate(param);

        Map<String, Object> result = new HashMap<>();
        result.put("reset", true);
        result.put("LOGIN_ID", loginId);

        return result;
    }

    /**
     * 세션 로그인 사용자 기준 권한 스코프 적용 버전.
     *
     * 프론트에서 password-reset 요청 시 아래 값도 같이 보내야 정확히 검증 가능.
     * COMPANY_ID, BRANCH_ID, SANGSA_ID, MEMBER_GB
     */
    @Transactional
    public Map<String, Object> resetCompanyUserPassword(Map<String, Object> request, Object loginUser) {
        logger.info("[CompanyService] 사용자 패스워드 초기화 - 권한 적용 - loginId: {}", request.get("LOGIN_ID"));

        Map<String, Object> targetInfo = new HashMap<>();
        targetInfo.put("COMPANY_ID", request.get("COMPANY_ID"));
        targetInfo.put("BRANCH_ID", request.get("BRANCH_ID"));
        targetInfo.put("SANGSA_ID", request.get("SANGSA_ID"));
        targetInfo.put("MEMBER_GB", request.get("MEMBER_GB"));

        validateCompanyUserTargetScope(targetInfo, loginUser);

        return resetCompanyUserPassword(request);
    }

    public List<Map<String, Object>> getNumplateDeliveryList(CompanySearchRequest request) {
        logger.info("[CompanyService] 탈부착업체 목록 조회");
        return companyMapper.getNumplateDeliveryList(request);
    }

    public List<Map<String, Object>> getNumplateAssignList(CompanySearchRequest request) {
        logger.info("[CompanyService] 탈부착업체 목록 조회");
        return companyMapper.getNumplateAssignList(request);
    }

    public List<Map<String, Object>> getSangsaList(CompanySearchRequest request) {
        logger.info(
                "[CompanyService] 영업팀 목록 조회 - companyId: {}, branchId: {}, keyword: {}",
                request.getCOMPANY_ID(),
                request.getBRANCH_ID(),
                request.getKEYWORD()
        );

        if (isBlank(request.getCOMPANY_ID())) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        return companyMapper.getSangsaList(request);
    }

    @Transactional
    public Map<String, Object> saveSangsa(CompanySearchRequest request) {
        logger.info(
                "[CompanyService] 영업팀 신규등록 - companyId: {}, branchId: {}, sangsaNm: {}",
                request.getCOMPANY_ID(),
                request.getBRANCH_ID(),
                request.getSANGSA_NM()
        );

        if (isBlank(request.getCOMPANY_ID())) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        if (isBlank(request.getBRANCH_ID())) {
            throw new BusinessException("지점 ID가 없습니다.", 400);
        }

        if (isBlank(request.getSANGSA_NM())) {
            throw new BusinessException("영업팀명을 입력해주세요.", 400);
        }

        request.setCOMPANY_ID(request.getCOMPANY_ID().trim());
        request.setBRANCH_ID(request.getBRANCH_ID().trim());
        request.setSANGSA_NM(request.getSANGSA_NM().trim());

        if (isBlank(request.getUSE_YN())) {
            request.setUSE_YN("Y");
        }

        if (isBlank(request.getINS_USER())) {
            request.setINS_USER(request.getCOMPANY_ID());
        }

        int duplicateCount = companyMapper.countSangsaName(request);

        if (duplicateCount > 0) {
            throw new BusinessException("이미 같은 지점에 동일한 영업팀명이 등록되어 있습니다.", 400);
        }

        String nextSangsaId = companyMapper.getNextSangsaId(request);

        if (isBlank(nextSangsaId)) {
            throw new BusinessException("영업팀 ID 채번에 실패했습니다.", 500);
        }

        request.setSANGSA_ID(nextSangsaId);

        int insertCount = companyMapper.insertSangsa(request);

        if (insertCount <= 0) {
            throw new BusinessException("영업팀 등록에 실패했습니다.", 500);
        }

        Map<String, Object> saved = companyMapper.getSangsaDetail(request);

        if (saved == null || saved.isEmpty()) {
            throw new BusinessException("등록된 영업팀 정보를 다시 조회하지 못했습니다.", 500);
        }

        return saved;
    }

    private void validateMemberInfo(Map<String, Object> memberInfo) {
        if (isBlank(toStr(memberInfo.get("LOGIN_ID")))) {
            throw new BusinessException("로그인 ID가 없습니다.", 400);
        }

        if (isBlank(toStr(memberInfo.get("COMPANY_ID")))) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        if (isBlank(toStr(memberInfo.get("MEMBER_ID")))) {
            throw new BusinessException("회원 ID가 없습니다.", 400);
        }

        if (isBlank(toStr(memberInfo.get("MEMBER_GB")))) {
            throw new BusinessException("업무권한 정보가 없습니다.", 400);
        }

        if (isBlank(toStr(memberInfo.get("USE_YN")))) {
            throw new BusinessException("사용여부 정보가 없습니다.", 400);
        }

        if (isBlank(toStr(memberInfo.get("LOGIN_GB")))) {
            throw new BusinessException("인증구분 정보가 없습니다.", 400);
        }

        if (isBlank(toStr(memberInfo.get("REGIST_NO")))) {
            throw new BusinessException("등록번호 정보가 없습니다.", 400);
        }

        if (isBlank(toStr(memberInfo.get("INS_USER")))) {
            memberInfo.put("INS_USER", memberInfo.get("LOGIN_ID"));
        }

        if (memberInfo.get("PWD_RESET_YN") == null) {
            memberInfo.put("PWD_RESET_YN", "N");
        }

        if (memberInfo.get("SANGSA_ID") == null) {
            memberInfo.put("SANGSA_ID", "");
        }
    }

    private Map<String, Object> makeWorkParam(
            Map<String, Object> memberInfo,
            Map<String, Object> workInfo,
            String useKey,
            String permKey
    ) {
        Map<String, Object> param = new HashMap<>();

        param.put("LOGIN_ID", memberInfo.get("LOGIN_ID"));
        param.put("MEMBER_ID", memberInfo.get("MEMBER_ID"));
        param.put("COMPANY_ID", memberInfo.get("COMPANY_ID"));
        param.put("USE", workInfo.get(useKey));
        param.put("PERM", workInfo.get(permKey));

        return param;
    }

    /**
     * 사용자 목록 조회 범위 강제.
     *
     * 일반회원사:
     * - 기존 시스템 관리자 UA/UU는 기존 동작 유지
     * - 일반 회원사는 자기 COMPANY_ID로 제한
     *
     * 특수회원사:
     * - CA: 자기 COMPANY_ID 전체
     * - BA: 자기 COMPANY_ID + 자기 BRANCH_ID
     * - SA: 자기 COMPANY_ID + 자기 BRANCH_ID + 자기 SANGSA_ID
     * - SU: 접근 불가
     */
    private void applyCompanyUserSearchScope(CompanySearchRequest request, Object loginUser) {
        if (loginUser == null) {
            throw new BusinessException("로그인 정보가 없습니다.", 401);
        }

        String loginMemberGb = getLoginMemberGb(loginUser);

        if (!isSpecialMemberGb(loginMemberGb)) {
            if (!isSystemAdmin(loginUser)) {
                request.setCOMPANY_ID(getLoginCompanyId(loginUser));
            }

            return;
        }

        request.setCOMPANY_ID(getLoginCompanyId(loginUser));

        if (ROLE_CA.equals(loginMemberGb)) {
            return;
        }

        if (ROLE_BA.equals(loginMemberGb)) {
            request.setBRANCH_ID(getLoginBranchId(loginUser));
            request.setSANGSA_ID("");
            return;
        }

        if (ROLE_SA.equals(loginMemberGb)) {
            request.setBRANCH_ID(getLoginBranchId(loginUser));
            request.setSANGSA_ID(getLoginSangsaId(loginUser));
            return;
        }

        if (ROLE_SU.equals(loginMemberGb)) {
            throw new BusinessException("팀 사용자는 기업사용자관리에 접근할 수 없습니다.", 403);
        }
    }

    /**
     * 사용자 업무권한 조회 범위 검증.
     */
    private void validateCompanyUserWorkScope(CompanySearchRequest request, Object loginUser) {
        if (loginUser == null) {
            throw new BusinessException("로그인 정보가 없습니다.", 401);
        }

        String loginMemberGb = getLoginMemberGb(loginUser);
        String requestCompanyId = toStr(request.getCOMPANY_ID());

        if (isSpecialMemberGb(loginMemberGb)) {
            if (ROLE_SU.equals(loginMemberGb)) {
                throw new BusinessException("팀 사용자는 기업사용자관리에 접근할 수 없습니다.", 403);
            }

            if (!getLoginCompanyId(loginUser).equals(requestCompanyId)) {
                throw new BusinessException("다른 회원사의 사용자 권한은 조회할 수 없습니다.", 403);
            }

            return;
        }

        if (!isSystemAdmin(loginUser)) {
            if (!getLoginCompanyId(loginUser).equals(requestCompanyId)) {
                throw new BusinessException("다른 회원사의 사용자 권한은 조회할 수 없습니다.", 403);
            }
        }
    }

    /**
     * 지점 업무정보 조회 범위 검증.
     */
    private void validateBranchWorkScope(CompanySearchRequest request, Object loginUser) {
        if (loginUser == null) {
            throw new BusinessException("로그인 정보가 없습니다.", 401);
        }

        String loginMemberGb = getLoginMemberGb(loginUser);
        String requestCompanyId = toStr(request.getCOMPANY_ID());
        String requestBranchId = toStr(request.getBRANCH_ID());

        if (isSpecialMemberGb(loginMemberGb)) {
            if (ROLE_SU.equals(loginMemberGb)) {
                throw new BusinessException("팀 사용자는 기업사용자관리에 접근할 수 없습니다.", 403);
            }

            if (!getLoginCompanyId(loginUser).equals(requestCompanyId)) {
                throw new BusinessException("다른 회원사의 지점정보를 조회할 수 없습니다.", 403);
            }

            if ((ROLE_BA.equals(loginMemberGb) || ROLE_SA.equals(loginMemberGb))
                    && !getLoginBranchId(loginUser).equals(requestBranchId)) {
                throw new BusinessException("다른 지점의 업무정보를 조회할 수 없습니다.", 403);
            }

            return;
        }

        if (!isSystemAdmin(loginUser)) {
            if (!getLoginCompanyId(loginUser).equals(requestCompanyId)) {
                throw new BusinessException("다른 회원사의 지점정보를 조회할 수 없습니다.", 403);
            }
        }
    }

    /**
     * 사용자 수정/비밀번호 초기화 범위 검증.
     */
    private void validateCompanyUserTargetScope(Map<String, Object> memberInfo, Object loginUser) {
        if (loginUser == null) {
            throw new BusinessException("로그인 정보가 없습니다.", 401);
        }

        String loginMemberGb = getLoginMemberGb(loginUser);

        String targetCompanyId = toStr(memberInfo.get("COMPANY_ID"));
        String targetBranchId = toStr(memberInfo.get("BRANCH_ID"));
        String targetSangsaId = toStr(memberInfo.get("SANGSA_ID"));
        String targetMemberGb = toStr(memberInfo.get("MEMBER_GB")).toUpperCase();

        if (!isSpecialMemberGb(loginMemberGb)) {
            if (!isSystemAdmin(loginUser)) {
                if (!getLoginCompanyId(loginUser).equals(targetCompanyId)) {
                    throw new BusinessException("다른 회원사의 사용자는 수정할 수 없습니다.", 403);
                }
            }

            return;
        }

        if (!getLoginCompanyId(loginUser).equals(targetCompanyId)) {
            throw new BusinessException("다른 회원사의 사용자는 수정할 수 없습니다.", 403);
        }

        if (ROLE_CA.equals(loginMemberGb)) {
            return;
        }

        if (ROLE_BA.equals(loginMemberGb)) {
            if (!getLoginBranchId(loginUser).equals(targetBranchId)) {
                throw new BusinessException("다른 지점의 사용자는 수정할 수 없습니다.", 403);
            }

            if (ROLE_CA.equals(targetMemberGb)) {
                throw new BusinessException("지점 관리자는 기업 관리자 권한으로 변경할 수 없습니다.", 403);
            }

            return;
        }

        if (ROLE_SA.equals(loginMemberGb)) {
            if (!getLoginBranchId(loginUser).equals(targetBranchId)
                    || !getLoginSangsaId(loginUser).equals(targetSangsaId)) {
                throw new BusinessException("다른 팀의 사용자는 수정할 수 없습니다.", 403);
            }

            if (ROLE_CA.equals(targetMemberGb) || ROLE_BA.equals(targetMemberGb)) {
                throw new BusinessException("팀 관리자는 기업/지점 관리자 권한으로 변경할 수 없습니다.", 403);
            }

            return;
        }

        if (ROLE_SU.equals(loginMemberGb)) {
            throw new BusinessException("팀 사용자는 기업사용자관리에 접근할 수 없습니다.", 403);
        }
    }

    private boolean isSpecialMemberGb(String memberGb) {
        String value = toStr(memberGb).toUpperCase();

        return ROLE_CA.equals(value)
                || ROLE_BA.equals(value)
                || ROLE_SA.equals(value)
                || ROLE_SU.equals(value);
    }

    private boolean isSystemAdmin(Object loginUser) {
        String memberGb = getLoginMemberGb(loginUser);

        /*
         * 기존 프론트 isCompanyAdmin() 기준과 맞춤.
         * UA, UU는 전체 회원사 선택 가능 관리자 계열로 유지.
         */
        return "UA".equals(memberGb) || "UU".equals(memberGb);
    }

    private String getLoginMemberGb(Object loginUser) {
        return readLoginValue(
                loginUser,
                "MEMBER_GB",
                "memberGb",
                "member_GB",
                "member_gb",
                "USER_AUTH",
                "userAuth",
                "UserAuth",
                "AUTH_CD",
                "authCd"
        ).toUpperCase();
    }

    private String getLoginCompanyId(Object loginUser) {
        return readLoginValue(
                loginUser,
                "COMPANY_ID",
                "companyId",
                "company_ID",
                "company_id",
                "COMPANYID",
                "COMPANY_CD",
                "companyCd"
        );
    }

    private String getLoginBranchId(Object loginUser) {
        return readLoginValue(
                loginUser,
                "BRANCH_ID",
                "branchId",
                "branch_ID",
                "branch_id",
                "BranchID"
        );
    }

    private String getLoginSangsaId(Object loginUser) {
        return readLoginValue(
                loginUser,
                "SANGSA_ID",
                "sangsaId",
                "sangsa_ID",
                "sangsa_id",
                "SangsaID"
        );
    }

    private String readLoginValue(Object loginUser, String... keys) {
        if (loginUser == null) {
            return "";
        }

        if (loginUser instanceof Map) {
            Map<String, Object> map = (Map<String, Object>) loginUser;

            for (String key : keys) {
                Object value = map.get(key);

                if (value != null) {
                    return toStr(value);
                }
            }

            return "";
        }

        for (String key : keys) {
            String getterName = makeGetterName(key);

            try {
                Method method = loginUser.getClass().getMethod(getterName);
                Object value = method.invoke(loginUser);

                if (value != null) {
                    return toStr(value);
                }
            } catch (Exception ignored) {
                // 다음 후보 getter 확인
            }
        }

        return "";
    }

    private String makeGetterName(String key) {
        if (isBlank(key)) {
            return "";
        }

        return "get" + key.substring(0, 1).toUpperCase() + key.substring(1);
    }

    private String encryptSha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedHash = digest.digest(value.getBytes(StandardCharsets.UTF_8));

            StringBuilder hexString = new StringBuilder();

            for (byte b : encodedHash) {
                hexString.append(String.format("%02x", b));
            }

            return hexString.toString();

        } catch (Exception e) {
            throw new BusinessException("비밀번호 암호화 중 오류가 발생했습니다.", 500);
        }
    }

    private String toStr(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}