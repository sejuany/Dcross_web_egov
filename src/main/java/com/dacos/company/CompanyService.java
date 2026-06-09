package com.dacos.company;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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

    @Autowired
    private CompanyMapper companyMapper;

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

    public List<Map<String, Object>> getCompanyUserList(CompanySearchRequest request) {
        logger.info("[CompanyService] 사용자 목록 조회");
        return companyMapper.getCompanyUserList(request);
    }

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

    @SuppressWarnings("unchecked")
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