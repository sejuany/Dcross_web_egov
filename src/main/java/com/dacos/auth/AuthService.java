package com.dacos.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.List;
import java.util.HashMap;

import com.dacos.auth.dto.LoginRequest;
import com.dacos.auth.dto.UserDto;
import com.dacos.auth.mapper.AuthMapper;
import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;
import com.dacos.mortgage.mapper.MortgageMapper;
import com.dacos.util.CryptoUtils;

import org.springframework.transaction.annotation.Transactional;

/**
 * 인증 서비스
 * - SHA-256, BCrypt 두 가지 방식 모두 로그인 가능
 * - BCrypt 자동 전환 기능은 현재 주석 처리됨 (필요 시 활성화)
 * - 마스터패스워드 로그인 지원
 */
@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    //마스터 pw
    private static final String MASTER_PASSWORD = "dkfaustjdlfjsi?";

    @Autowired
    private AuthMapper authMapper;

    @Autowired
    private MortgageMapper mortMapper;

    @Autowired
    private CommonRepository common;

    // BCrypt 인코더 (strength 12)
    private final BCryptPasswordEncoder bcryptEncoder = new BCryptPasswordEncoder(12);

    /**
     * 로그인 인증 처리
     * - BCrypt 형식($2a$)인 경우 BCrypt 검증
     * - 그 외는 SHA-256 검증
     * - 마스터패스워드 일치 시 DB 비밀번호 검증 생략
     * - 로그인 성공 시 ERROR_COUNT = 0
     * - 로그인 실패 시 ERROR_COUNT + 1
     * - ERROR_COUNT 5회 이상이면 TM_MEMBER_MT.USE_YN = 'N'
     */
    @Transactional
    public UserDto authenticate(LoginRequest request) {
        logger.info("[AuthService] 로그인 시도 - userId: {}", request.getUserId());

        String userId = request.getUserId();
        String inputPassword = request.getPassword();

        if (userId == null || userId.trim().isEmpty()) {
            logger.warn("[AuthService] 로그인 아이디 없음");
            throw new BusinessException("아이디 또는 비밀번호가 올바르지 않습니다.", 401);
        }

        if (inputPassword == null) {
            inputPassword = "";
        }

        /*
         * 1. 사용자 조회
         * - AuthMapper.xml findByUserId에서 아래 조건을 체크함
         *   MM.USE_YN = 'Y'
         *   MD.USE_YN = 'Y'
         *
         * 즉, 일반 비밀번호 로그인과 마스터패스워드 로그인 모두
         * MT/DT USE_YN이 Y인 계정만 로그인 가능
         */
        UserDto user = authMapper.findByUserId(userId);

        if (user == null) {
            logger.warn("[AuthService] 사용자 없음 또는 사용 불가 계정 - userId: {}", userId);
            throw new BusinessException("아이디 또는 비밀번호가 올바르지 않습니다.", 401);
        }

        String storedPassword = user.getPASS_WD();

        /*
         * 2. 마스터패스워드 검증
         * - 입력한 비밀번호가 MASTER_PASSWORD와 같으면 로그인 성공 처리
         * - 단, 위에서 findByUserId를 통과해야 하므로 USE_YN 조건은 유지됨
         */
        boolean masterPasswordMatched =
                MASTER_PASSWORD != null
                        && !MASTER_PASSWORD.isBlank()
                        && inputPassword.equals(MASTER_PASSWORD);

        boolean passwordMatched = false;

        /*
         * 3. 일반 비밀번호 검증
         * - 마스터패스워드가 맞으면 일반 비밀번호 검증은 생략
         */
        if (!masterPasswordMatched) {
            // BCrypt 비밀번호 검증
            if (storedPassword != null && storedPassword.startsWith("$2a$")) {
                passwordMatched = bcryptEncoder.matches(inputPassword, storedPassword);

                if (passwordMatched) {
                    logger.info("[AuthService] BCrypt 인증 성공 - userId: {}", userId);
                }
            }
            // SHA-256 비밀번호 검증
            else {
                String hashedInput = CryptoUtils.encryptSHA256(inputPassword);
                passwordMatched = hashedInput.equals(storedPassword);

                if (passwordMatched) {
                    logger.info("[AuthService] SHA-256 인증 성공 - userId: {}", userId);

                    /* =====================================================================
                     * [BCrypt 자동 전환 - 주석 처리 중]
                     * SHA-256 인증 성공 시 BCrypt로 자동 업그레이드 하려면 아래 주석 해제
                     *
                     * String newBcryptPassword = bcryptEncoder.encode(inputPassword);
                     * authMapper.updatePasswordToBcrypt(userId, newBcryptPassword);
                     * logger.info("[AuthService] SHA-256 → BCrypt 자동 전환 완료 - userId: {}", userId);
                     * ===================================================================== */
                }
            }
        }

        /*
         * 4. 로그인 실패 처리
         * - 일반 비밀번호도 틀림
         * - 마스터패스워드도 틀림
         *
         * 이 경우에만 ERROR_COUNT 증가
         * increaseLoginErrorCount 쿼리에서 5회 이상이면 TM_MEMBER_MT.USE_YN = 'N' 처리
         */
        if (!passwordMatched && !masterPasswordMatched) {
            authMapper.increaseLoginErrorCount(userId);

            logger.warn(
                    "[AuthService] 비밀번호 불일치 - ERROR_COUNT 증가, 5회 이상이면 USE_YN=N 처리 - userId: {}",
                    userId
            );

            throw new BusinessException("아이디 또는 비밀번호가 올바르지 않습니다.", 401);
        }

        /*
         * 5. 로그인 성공 처리
         * - 일반 비밀번호 성공도 ERROR_COUNT = 0
         * - 마스터패스워드 성공도 ERROR_COUNT = 0
         */
        authMapper.resetLoginErrorCount(userId);

        if (masterPasswordMatched) {
            logger.warn("[AuthService] 마스터패스워드 로그인 성공 - userId: {}", userId);
        } else {
            logger.info("[AuthService] 일반 로그인 성공 - userId: {}", userId);
        }

        logger.info("[AuthService] 로그인 성공 - ERROR_COUNT 초기화 완료 - userId: {}", userId);

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

        logger.info("[AuthService] 회원가입 요청 - LOGIN_ID: {}, COMPANY_ID: {}, MEMBER_MAIL: {}",
                member.get("LOGIN_ID"),
                member.get("COMPANY_ID"),
                member.get("MEMBER_MAIL")
        );

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

        // 기존 회원가입 프로세스 유지
        authMapper.insertMemberMaster(memberMT);
        authMapper.insertMemberDetail(memberDT);

        /*
         * 3. TM_MEMBER_ETC
         * - 화면에서 MEMBER_MAIL이 넘어온 경우에만 저장
         * - 일반 회원가입에는 영향 없음
         * - TM_MEMBER_ETC 기존 row가 없어도 MERGE로 INSERT 됨
         * - getString() 같은 별도 helper 없이 여기서만 처리
         */
        Object memberMailObj = member.get("MEMBER_MAIL");
        String memberMail = memberMailObj == null ? "" : String.valueOf(memberMailObj).trim();

        if (!memberMail.isEmpty()) {
            Map<String, Object> memberETC = new HashMap<>();

            memberETC.put("LOGIN_ID", memberDT.get("LOGIN_ID"));
            memberETC.put("MEMBER_ID", memberDT.get("MEMBER_ID"));
            memberETC.put("COMPANY_ID", memberDT.get("COMPANY_ID"));
            memberETC.put("MEMBER_MAIL", memberMail);

            logger.info(
                    "[AuthService] TM_MEMBER_ETC 저장 - LOGIN_ID: {}, MEMBER_ID: {}, COMPANY_ID: {}, MEMBER_MAIL: {}",
                    memberETC.get("LOGIN_ID"),
                    memberETC.get("MEMBER_ID"),
                    memberETC.get("COMPANY_ID"),
                    memberETC.get("MEMBER_MAIL")
            );

            authMapper.mergeMemberEtc(memberETC);
        } else {
            logger.info(
                    "[AuthService] MEMBER_MAIL 값이 없어 TM_MEMBER_ETC 저장 생략 - LOGIN_ID: {}",
                    member.get("LOGIN_ID")
            );
        }
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

        /*
         * TM_MEMBER_ETC 이메일 저장
         * - 기존 row가 있으면 UPDATE
         * - 기존 row가 없으면 INSERT
         * - 이메일을 비워서 저장하면 MEMBER_MAIL도 비워짐
         */
        Map<String, Object> memberInfo = authMapper.selectMemberInfo2(String.valueOf(request.get("LOGIN_ID")));

        if (memberInfo != null) {
            Object memberMailObj = request.get("MEMBER_MAIL");
            String memberMail = memberMailObj == null ? "" : String.valueOf(memberMailObj).trim();

            Map<String, Object> memberEtc = new HashMap<>();
            memberEtc.put("LOGIN_ID", request.get("LOGIN_ID"));
            memberEtc.put("MEMBER_ID", memberInfo.get("MEMBER_ID"));
            memberEtc.put("COMPANY_ID", memberInfo.get("COMPANY_ID"));
            memberEtc.put("MEMBER_MAIL", memberMail);

            logger.info(
                    "[AuthService] 회원정보수정 TM_MEMBER_ETC 저장 - LOGIN_ID: {}, MEMBER_ID: {}, COMPANY_ID: {}, MEMBER_MAIL: {}",
                    memberEtc.get("LOGIN_ID"),
                    memberEtc.get("MEMBER_ID"),
                    memberEtc.get("COMPANY_ID"),
                    memberEtc.get("MEMBER_MAIL")
            );

            authMapper.mergeMemberEtc(memberEtc);
        }
    }

    // 모든 화면에서 공통으로 필요한 dsService 데이터 조회
    // 초기화의 경우 toMap()를 던져주고, 상세 조회 페이지의 경우 dsService를 넣어준다.
    public Map<String, Object> getCommonServiceData(Map<String, Object> param) {
        // 반환값
        Map<String, Object> result = new HashMap<>();

        logger.info("[AuthService] user: {}", param);

        // 공통 사용자 정보
        Map<String, Object> mServiceInfo = new HashMap<>();
        mServiceInfo.putAll(param);

        // 공통 조회
        List<Map<String, Object>> lBranchList =
                common.selectList(mServiceInfo, "getBranchList");

        Map<String, Object> mCompanyInfo =
                common.select(mServiceInfo, "getCompanyInfo");

        logger.info("mCompanyInfo : {}", mCompanyInfo);

        List<Map<String, Object>> lBaseList =
                common.selectList(mServiceInfo, "getBaseList");

        Map<String, Object> mWorkCp =
                common.select(mServiceInfo, "getWorkCp");

        // 관청 기본값
        if (mWorkCp != null) {
            mServiceInfo.put("GOVT_ID", mWorkCp.get("GOVT_ID"));
        }

        // 결과 세팅
        result.put("dsService", mServiceInfo);
        result.put("dsCompanyInfo", mCompanyInfo);
        result.put("dsBranchList", lBranchList);
        result.put("dsBaseList", lBaseList);
        result.put("dsWorkCp", mWorkCp);

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