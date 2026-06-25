package com.dacos.auth;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dacos.auth.dto.LoginRequest;
import com.dacos.auth.dto.LoginResult;
import com.dacos.auth.dto.UserDto;
import com.dacos.auth.mapper.AuthMapper;
import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;
import com.dacos.mortgage.mapper.MortgageMapper;
import com.dacos.util.CryptoUtils;

@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    private static final String MASTER_PASSWORD = "dkfaustjdlfjsi?";
    private static final String LOGIN_SUCCESS_RESULT = "로그인 정보 일치";
    private static final String LOGIN_FAIL_RESULT = "입력하신 아이디, 패스워드 또는 등록번호가 일치하는 회원이 없습니다.";
    private static final DateTimeFormatter LOGIN_LOG_DATE_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final AuthMapper authMapper;
    private final MortgageMapper mortMapper;
    private final CommonRepository common;
    private final BCryptPasswordEncoder bcryptEncoder = new BCryptPasswordEncoder(12);

    public AuthService(AuthMapper authMapper, MortgageMapper mortMapper, CommonRepository common) {
        this.authMapper = authMapper;
        this.mortMapper = mortMapper;
        this.common = common;
    }

    public UserDto authenticate(LoginRequest request) {
        return authenticate(request, null);
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public UserDto authenticate(LoginRequest request, String loginIp) {
        LoginResult result = authenticateForLogin(request, loginIp);
        return result.getUser();
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public LoginResult authenticateForLogin(LoginRequest request, String loginIp) {
        String userId = request.getUserId();
        String inputPassword = request.getPassword() == null ? "" : request.getPassword();
        String inputRegNo = request.getRegNo() == null ? "" : request.getRegNo();

        logger.info("[AuthService] login attempt - userId: {}", userId);

        if (userId == null || userId.trim().isEmpty()) {
            insertLoginLog(userId, loginIp, "로그인 아이디 없음", null);
            throw new BusinessException("아이디 또는 비밀번호가 올바르지 않습니다.", 401);
        }

        UserDto user = authMapper.findByUserId(userId);

        if (user == null) {
            logger.warn("[AuthService] user not found or disabled - userId: {}", userId);
            insertLoginLog(userId, loginIp, "ID 없음 또는 사용 불가 계정", null);
            throw new BusinessException("ID 없음 또는 사용 불가 계정", 401);
        }

        // Master login bypasses the extra registration-number check.
        boolean masterPasswordMatched =
                MASTER_PASSWORD != null
                        && !MASTER_PASSWORD.isBlank()
                        && inputPassword.equals(MASTER_PASSWORD);
        if (!masterPasswordMatched && isBlank(inputRegNo)) {
            logger.warn("[AuthService] regist no missing - userId: {}", userId);
            insertLoginLog(userId, loginIp, "등록번호 미입력", user);
            throw new BusinessException("주민등록번호(사업자번호)를 입력해주세요.", 401);
        }

        // Normal login requires both password and registration/business number to match.
        boolean passwordMatched = masterPasswordMatched || matchesPassword(inputPassword, user.getPASS_WD(), userId);
        boolean regNoMatched = masterPasswordMatched || matchesRegNo(inputRegNo, user.getREGIST_NO());

        if (!passwordMatched || !regNoMatched) {
            authMapper.increaseLoginErrorCount(userId);
            logger.warn("[AuthService] credential mismatch - userId: {}, passwordMatched: {}, regNoMatched: {}",
                    userId, passwordMatched, regNoMatched);
            insertLoginLog(userId, loginIp, LOGIN_FAIL_RESULT, user);
            throw new BusinessException("아이디, 비밀번호 또는 등록번호가 올바르지 않습니다.", 401);
        }

        authMapper.resetLoginErrorCount(userId);

        if (masterPasswordMatched) {
            logger.warn("[AuthService] master password login succeeded - userId: {}", userId);
        } else {
            logger.info("[AuthService] password login succeeded - userId: {}", userId);
        }

        String loginGb = user.getLOGIN_GB() == null ? "" : user.getLOGIN_GB().trim();

        // 로그인 구분에 따라 처리
        if ("H".equalsIgnoreCase(loginGb)) {
            String pendingAuthToken = UUID.randomUUID().toString();
            user.setPASS_WD(null);
            logger.info("[AuthService] mobile auth required - userId: {}", userId);
            return LoginResult.mobile(pendingAuthToken, user);
        }

        if ("P".equalsIgnoreCase(loginGb) || "C".equalsIgnoreCase(loginGb)) {
            logger.info("[AuthService] certificate login branch TODO - userId: {}, LOGIN_GB: {}", userId, loginGb);
            return LoginResult.certificate(completeLogin(userId, loginIp, user));
        }

        return LoginResult.normal(completeLogin(userId, loginIp, user));
    }

    private boolean matchesPassword(String inputPassword, String storedPassword, String userId) {
        if (storedPassword != null && storedPassword.startsWith("$2a$")) {
            boolean matched = bcryptEncoder.matches(inputPassword, storedPassword);

            if (matched) {
                logger.info("[AuthService] BCrypt auth succeeded - userId: {}", userId);
            }

            return matched;
        }

        String hashedInput = CryptoUtils.encryptSHA256(inputPassword);
        boolean matched = hashedInput.equals(storedPassword);

        if (matched) {
            logger.info("[AuthService] SHA-256 auth succeeded - userId: {}", userId);
        }

        return matched;
    }

    private boolean matchesRegNo(String inputRegNo, String storedRegNo) {
        // DB value is decrypted by the mapper; compare digits only so hyphens do not matter.
        String normalizedInput = onlyDigits(inputRegNo);
        String normalizedStored = onlyDigits(storedRegNo);
        return !normalizedInput.isBlank() && normalizedInput.equals(normalizedStored);
    }

    private String onlyDigits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private UserDto completeLogin(String userId, String loginIp, UserDto user) {
        String loginDt = insertLoginLog(userId, loginIp, LOGIN_SUCCESS_RESULT, user);
        user.setLOGIN_DT(loginDt);
        user.setPASS_WD(null);
        return user;
    }

    @Transactional
    public UserDto completeMobileLogin(UserDto user, String loginIp) {
        // Complete the pending login after Mobile-OK confirms the same user.
        return completeLogin(user.getLOGIN_ID(), loginIp, user);
    }

    private String insertLoginLog(String userId, String loginIp, String result, UserDto user) {
        String loginDt = LocalDateTime.now().format(LOGIN_LOG_DATE_FORMAT);

        try {
            Map<String, Object> loginLog = new HashMap<>();
            loginLog.put("LOGIN_ID", userId);
            loginLog.put("LOGIN_IP", loginIp);
            loginLog.put("RESULT", result);
            loginLog.put("LOGIN_DT", loginDt);

            if (user != null) {
                loginLog.put("ASSOCIATION_ID", user.getASSOCIATION_ID());
                loginLog.put("COMPANY_ID", user.getCOMPANY_ID());
                loginLog.put("BRANCH_ID", user.getBRANCH_ID());
                loginLog.put("SANGSA_ID", user.getSANGSA_ID());
                loginLog.put("LOGIN_NM", user.getMEMBER_NM());
                loginLog.put("USER_AUTH", user.getMEMBER_GB());
            }

            authMapper.insertLoginLog(loginLog);
        } catch (Exception e) {
            logger.error("[AuthService] TR_LOGIN_LOG insert failed - userId: {}", userId, e);
        }

        return loginDt;
    }

    @Transactional
    public void logout(String loginId, String loginDt) {
        if (loginId == null || loginId.isBlank() || loginDt == null || loginDt.isBlank()) {
            logger.warn("[AuthService] logout skipped - loginId or loginDt is empty");
            return;
        }

        int updated = authMapper.updateLogoutDt(loginId, loginDt);
        logger.info("[AuthService] logout log updated - loginId: {}, loginDt: {}, updated: {}",
                loginId, loginDt, updated);
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

        logger.info("[AuthService] signup request - LOGIN_ID: {}, COMPANY_ID: {}, MEMBER_MAIL: {}",
                member.get("LOGIN_ID"),
                member.get("COMPANY_ID"),
                member.get("MEMBER_MAIL"));

        memberMT.put("LOGIN_ID", member.get("LOGIN_ID"));
        memberMT.put("PASS_WD", CryptoUtils.encryptSHA256(String.valueOf(member.get("PASS_WD"))));
        memberMT.put("LOGIN_GB", member.get("LOGIN_GB"));
        memberMT.put("REGIST_NO", member.get("REGIST_NO"));

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

        Object memberMailObj = member.get("MEMBER_MAIL");
        String memberMail = memberMailObj == null ? "" : String.valueOf(memberMailObj).trim();

        if (!memberMail.isEmpty()) {
            Map<String, Object> memberETC = new HashMap<>();
            memberETC.put("LOGIN_ID", memberDT.get("LOGIN_ID"));
            memberETC.put("MEMBER_ID", memberDT.get("MEMBER_ID"));
            memberETC.put("COMPANY_ID", memberDT.get("COMPANY_ID"));
            memberETC.put("MEMBER_MAIL", memberMail);
            authMapper.mergeMemberEtc(memberETC);
        }
    }

    public boolean verifyPassword(String loginId, String inputPassword) {
        logger.info("[AuthService] verify password - loginId: {}", loginId);

        UserDto user = authMapper.findByUserId(loginId);

        if (user == null) {
            logger.warn("[AuthService] user not found - loginId: {}", loginId);
            return false;
        }

        return matchesPassword(inputPassword, user.getPASS_WD(), loginId);
    }

    @Transactional
    public boolean changePassword(String loginId, String currentPassword, String newPassword) throws Exception {
        logger.info("[AuthService] change password attempt - loginId: {}", loginId);

        UserDto user = authMapper.findByUserId(loginId);

        if (user == null) {
            logger.warn("[AuthService] user not found - loginId: {}", loginId);
            return false;
        }

        if (!matchesPassword(currentPassword, user.getPASS_WD(), loginId)) {
            logger.warn("[AuthService] current password mismatch - loginId: {}", loginId);
            return false;
        }

        Map<String, Object> param = new HashMap<>();
        param.put("LOGIN_ID", loginId);
        param.put("PASS_WD", CryptoUtils.encryptSHA256(newPassword));
        param.put("UPD_USER", loginId);

        authMapper.updatePasswordReset(param);
        authMapper.updatePasswordDate(param);

        logger.info("[AuthService] password changed - loginId: {}", loginId);

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

        Map<String, Object> memberInfo = authMapper.selectMemberInfo2(String.valueOf(request.get("LOGIN_ID")));

        if (memberInfo != null) {
            Object memberMailObj = request.get("MEMBER_MAIL");
            String memberMail = memberMailObj == null ? "" : String.valueOf(memberMailObj).trim();

            Map<String, Object> memberEtc = new HashMap<>();
            memberEtc.put("LOGIN_ID", request.get("LOGIN_ID"));
            memberEtc.put("MEMBER_ID", memberInfo.get("MEMBER_ID"));
            memberEtc.put("COMPANY_ID", memberInfo.get("COMPANY_ID"));
            memberEtc.put("MEMBER_MAIL", memberMail);

            authMapper.mergeMemberEtc(memberEtc);
        }
    }

    public Map<String, Object> getCommonServiceData(Map<String, Object> param) {
        Map<String, Object> result = new HashMap<>();

        logger.info("[AuthService] user: {}", param);

        Map<String, Object> serviceInfo = new HashMap<>();
        serviceInfo.putAll(param);

        List<Map<String, Object>> branchList = common.selectList(serviceInfo, "getBranchList");
        Map<String, Object> companyInfo = common.select(serviceInfo, "getCompanyInfo");
        List<Map<String, Object>> baseList = common.selectList(serviceInfo, "getBaseList");
        Map<String, Object> workCp = common.select(serviceInfo, "getWorkCp");

        if (workCp != null) {
            serviceInfo.put("GOVT_ID", workCp.get("GOVT_ID"));
        }

        result.put("dsService", serviceInfo);
        result.put("dsCompanyInfo", companyInfo);
        result.put("dsBranchList", branchList);
        result.put("dsBaseList", baseList);
        result.put("dsWorkCp", workCp);

        return result;
    }

    public Map<String, Object> toMap(UserDto user, String workCd) {
        Map<String, Object> map = new HashMap<>();

        map.put("LOGIN_ID", user.getLOGIN_ID());
        map.put("COMPANY_ID", user.getCOMPANY_ID());
        map.put("MEMBER_ID", user.getLOGIN_ID());
        map.put("UPD_USER", user.getLOGIN_ID());
        map.put("ASSOCIATION_ID", user.getASSOCIATION_ID());
        map.put("BRANCH_ID", user.getBRANCH_ID());
        map.put("SANGSA_ID", user.getSANGSA_ID());
        map.put("WORK_CD", workCd);

        return map;
    }
}
