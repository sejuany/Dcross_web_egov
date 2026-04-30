package com.dacos.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.Map;
import com.dacos.auth.dto.LoginRequest;
import com.dacos.auth.dto.UserDto;
import com.dacos.auth.mapper.AuthMapper;
import com.dacos.common.BusinessException;
import com.dacos.util.CryptoUtils;
import java.util.List;
import java.util.HashMap;
import org.springframework.transaction.annotation.Transactional;

/**
 * 인증 서비스
 * - SHA-256, BCrypt 두 가지 방식 모두 로그인 가능
 * - BCrypt 자동 전환 기능은 현재 주석 처리됨 (필요 시 활성화)
 */
@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    @Autowired
    private AuthMapper authMapper;

    // BCrypt 인코더 (strength 12)
    private final BCryptPasswordEncoder bcryptEncoder = new BCryptPasswordEncoder(12);

    /**
     * 로그인 인증 처리
     * - BCrypt 형식($2a$)인 경우 BCrypt 검증
     * - 그 외는 SHA-256 검증
     * (두 방식 모두 로그인 가능, 자동 전환 없음)
     */
    public UserDto authenticate(LoginRequest request) {
        logger.info("[AuthService] 로그인 시도 - userId: {}", request.getUserId());

        // 1. 사용자 조회
        UserDto user = authMapper.findByUserId(request.getUserId());
        if (user == null) {
            logger.warn("[AuthService] 사용자 없음 - userId: {}", request.getUserId());
            throw new BusinessException("아이디 또는 비밀번호가 올바르지 않습니다.", 401);
        }

        String storedPassword = user.getPASS_WD();
        String inputPassword = request.getPassword();

        // 2. BCrypt 비밀번호 검증 (DB에 BCrypt 형식으로 저장된 경우)
        if (storedPassword != null && storedPassword.startsWith("$2a$")) {
            if (!bcryptEncoder.matches(inputPassword, storedPassword)) {
                logger.warn("[AuthService] BCrypt 비밀번호 불일치 - userId: {}", request.getUserId());
                throw new BusinessException("아이디 또는 비밀번호가 올바르지 않습니다.", 401);
            }
            logger.info("[AuthService] BCrypt 인증 성공 - userId: {}", request.getUserId());
        }
        // 3. SHA-256 비밀번호 검증 (기존 방식)
        else {
            String hashedInput = CryptoUtils.encryptSHA256(inputPassword);
            if (!hashedInput.equals(storedPassword)) {
                logger.warn("[AuthService] SHA-256 비밀번호 불일치 - userId: {}", request.getUserId());
                throw new BusinessException("아이디 또는 비밀번호가 올바르지 않습니다.", 401);
            }
            logger.info("[AuthService] SHA-256 인증 성공 - userId: {}", request.getUserId());

            /* =====================================================================
             * [BCrypt 자동 전환 - 주석 처리 중]
             * SHA-256 인증 성공 시 BCrypt로 자동 업그레이드 하려면 아래 주석 해제
             *
             * String newBcryptPassword = bcryptEncoder.encode(inputPassword);
             * authMapper.updatePasswordToBcrypt(request.getUserId(), newBcryptPassword);
             * logger.info("[AuthService] SHA-256 → BCrypt 자동 전환 완료 - userId: {}", request.getUserId());
             * ===================================================================== */
        }

        // 보안상 비밀번호 필드 제거 후 반환
        user.setPASS_WD(null);
        return user;
    }
    
    public Map<String, Object> selectCompanyInfo(Map<String, Object> request) {
        return authMapper.selectCompanyInfo(request);
    }
    public List<Map<String, Object>> selectAssociation(Map<String, Object> request) {
        return authMapper.selectAssociation(request);
    }

    public List<Map<String, Object>> selectBranchID(Map<String, Object> request) {
        return authMapper.selectBranchID(request);
    }
    
    public Map<String, Object> selectMBCount(Map<String, Object> request) {
        return authMapper.selectMBCount(request);
    }
    
    @Transactional
    public void setMember(Map<String, Object> member) throws Exception {
        Map<String, Object> memberMT = new HashMap<>();
        Map<String, Object> memberDT = new HashMap<>();

        // 1. TM_MEMBER_MT
        memberMT.put("LOGIN_ID", member.get("LOGIN_ID"));

        String encPassword = CryptoUtils.encryptSHA256(String.valueOf(member.get("PASS_WD")));
        memberMT.put("PASS_WD", encPassword);

        memberMT.put("LOGIN_GB", member.get("LOGIN_GB"));
        memberMT.put("REGIST_NO", member.get("REGIST_NO"));

        // 2. TM_MEMBER_DT
        memberDT.put("LOGIN_ID", member.get("LOGIN_ID"));
        memberDT.put("MEMBER_ID", member.get("LOGIN_ID"));

        String regGb = String.valueOf(member.get("REG_GB"));

        if ("A".equals(regGb) || "G".equals(regGb)) {
            memberDT.put("ASSOCIATION_ID", member.get("ASSOCIATION_ID"));
            memberDT.put("COMPANY_ID", member.get("ASSOCIATION_ID"));
        } else {
            memberDT.put("ASSOCIATION_ID", member.get("ASSOCIATION_ID"));
            memberDT.put("COMPANY_ID", member.get("COMPANY_ID"));
        }

        memberDT.put("BRANCH_ID", member.get("BRANCH_ID"));
        memberDT.put("SANGSA_ID", member.get("SANGSA_ID"));
        memberDT.put("MEMBER_NM", member.get("MEMBER_NM"));
        memberDT.put("MEMBER_GB", member.get("MEMBER_GB"));
        memberDT.put("TEL_NO", member.get("TEL_NO"));
        memberDT.put("MPHONE_NO", member.get("MPHONE_NO"));

        authMapper.insertMemberMaster(memberMT);
        authMapper.insertMemberDetail(memberDT);
    }
    
    public boolean verifyPassword(String loginId, String inputPassword) {
        logger.info("[AuthService] 회원정보수정 비밀번호 확인 - loginId: {}", loginId);

        UserDto user = authMapper.findByUserId(loginId);
        if (user == null) {
            logger.warn("[AuthService] 사용자 없음 - loginId: {}", loginId);
            return false;
        }

        String storedPassword = user.getPASS_WD();

        if (storedPassword != null && storedPassword.startsWith("$2a$")) {
            boolean matched = bcryptEncoder.matches(inputPassword, storedPassword);
            if (!matched) {
                logger.warn("[AuthService] BCrypt 비밀번호 불일치 - loginId: {}", loginId);
            }
            return matched;
        } else {
            String hashedInput = CryptoUtils.encryptSHA256(inputPassword);
            boolean matched = hashedInput.equals(storedPassword);
            if (!matched) {
                logger.warn("[AuthService] SHA-256 비밀번호 불일치 - loginId: {}", loginId);
            }
            return matched;
        }
    }
    
    @Transactional
    public boolean changePassword(String loginId, String currentPassword, String newPassword) throws Exception {
        logger.info("[AuthService] 비밀번호 변경 시도 - loginId: {}", loginId);

        UserDto user = authMapper.findByUserId(loginId);
        if (user == null) {
            logger.warn("[AuthService] 사용자 없음 - loginId: {}", loginId);
            return false;
        }

        String storedPassword = user.getPASS_WD();
        boolean matched = false;

        // 현재 비밀번호 검증: 기존 로그인 규칙 그대로
        if (storedPassword != null && storedPassword.startsWith("$2a$")) {
            matched = bcryptEncoder.matches(currentPassword, storedPassword);
        } else {
            String hashedInput = CryptoUtils.encryptSHA256(currentPassword);
            matched = hashedInput.equals(storedPassword);
        }

        if (!matched) {
            logger.warn("[AuthService] 현재 비밀번호 불일치 - loginId: {}", loginId);
            return false;
        }

        // 새 비밀번호 암호화
        String encryptedNewPassword = CryptoUtils.encryptSHA256(newPassword);

        Map<String, Object> param = new HashMap<>();
        param.put("LOGIN_ID", loginId);
        param.put("PASS_WD", encryptedNewPassword);
        param.put("UPD_USER", loginId);

        authMapper.updatePasswordReset(param);
        authMapper.updatePasswordDate(param);

        logger.info("[AuthService] 비밀번호 변경 완료 - loginId: {}", loginId);
        return true;
    }

    public Map<String, Object> selectMemberInfo(String loginId) {
        return authMapper.selectMemberInfo(loginId);
    }
    
    public Map<String, Object> selectMemberInfo2(String loginId) {
        return authMapper.selectMemberInfo2(loginId);
    }

    @Transactional
    public void updateMemberBasic(Map<String, Object> request) throws Exception {
        authMapper.updateMemberMaster(request);
        authMapper.updateMemberDetail(request);
    }
}
