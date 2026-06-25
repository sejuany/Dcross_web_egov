package com.dacos.auth;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.auth.dto.LoginRequest;
import com.dacos.auth.dto.LoginResult;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.ApiResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    public static final String SESSION_USER = "user";
    public static final String PENDING_LOGIN_USER = "PENDING_LOGIN_USER";
    public static final String PENDING_LOGIN_IP = "PENDING_LOGIN_IP";
    public static final String PENDING_AUTH_TOKEN = "PENDING_AUTH_TOKEN";

    private final AuthService authService;
    private final MobileOkService mobileOkService;

    AuthController(AuthService authService, MobileOkService mobileOkService) {
        this.authService = authService;
        this.mobileOkService = mobileOkService;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody LoginRequest request,
            HttpSession session,
            HttpServletRequest httpRequest) {

        logger.info("[AuthController] login request - userId: {}", request.getUserId());
        String loginIp = getClientIp(httpRequest);
        LoginResult loginResult = authService.authenticateForLogin(request, loginIp);

        if (loginResult.isRequiresMobileAuth()) {
            session.removeAttribute(SESSION_USER);
            session.setAttribute(PENDING_LOGIN_USER, loginResult.getUser());
            session.setAttribute(PENDING_LOGIN_IP, loginIp);
            session.setAttribute(PENDING_AUTH_TOKEN, loginResult.getPendingAuthToken());
            logger.info("[AuthController] mobile auth pending - userId: {}", request.getUserId());
            return ResponseEntity.ok(toLoginResponse(loginResult));
        }

        session.removeAttribute(PENDING_LOGIN_USER);
        session.removeAttribute(PENDING_LOGIN_IP);
        session.removeAttribute(PENDING_AUTH_TOKEN);
        session.setAttribute(SESSION_USER, loginResult.getUser());
        logger.info("[AuthController] login completed - userId: {}", request.getUserId());

        return ResponseEntity.ok(toLoginResponse(loginResult));
    }

    private Map<String, Object> toLoginResponse(LoginResult loginResult) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", loginResult.isSuccess());
        response.put("authType", loginResult.getAuthType());
        response.put("requiresMobileAuth", loginResult.isRequiresMobileAuth());
        response.put("requiresCertificateAuth", loginResult.isRequiresCertificateAuth());
        response.put("pendingAuthToken", loginResult.getPendingAuthToken());
        response.put("user", loginResult.getUser());
        return response;
    }

    private String getClientIp(HttpServletRequest request) {
        String clientIp = request.getHeader("X-Forwarded-For");

        if (clientIp != null && !clientIp.isBlank()) {
            int commaIndex = clientIp.indexOf(',');
            return commaIndex >= 0 ? clientIp.substring(0, commaIndex).trim() : clientIp.trim();
        }

        clientIp = request.getHeader("X-Real-IP");

        if (clientIp != null && !clientIp.isBlank()) {
            return clientIp.trim();
        }

        return request.getRemoteAddr();
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpSession session) {
        UserDto user = (UserDto) session.getAttribute(SESSION_USER);

        if (user != null) {
            authService.logout(user.getLOGIN_ID(), user.getLOGIN_DT());
            logger.info("[AuthController] logout - userId: {}", user.getLOGIN_ID());
        }

        session.invalidate();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/auth/mobile/request")
    public ResponseEntity<Map<String, Object>> requestMobileAuth(
            @RequestBody Map<String, Object> request,
            HttpSession session) {

        // Only the session that started password login can request Mobile-OK auth.
        Map<String, Object> response = new HashMap<>();

        if (!isValidPendingAuthToken(request, session)) {
            response.put("success", false);
            response.put("message", "휴대폰 본인인증 대기 정보가 유효하지 않습니다.");
            return ResponseEntity.ok(response);
        }

        try {
            UserDto pendingUser = (UserDto) session.getAttribute(PENDING_LOGIN_USER);
            response.putAll(mobileOkService.requestAuth(
                    session,
                    pendingUser,
                    String.valueOf(request.get("providerId"))));
            response.put("pendingAuthToken", session.getAttribute(PENDING_AUTH_TOKEN));
        } catch (Exception e) {
            logger.error("[AuthController] Mobile-OK auth request failed", e);
            response.put("success", false);
            response.put("ready", false);
            response.put("message", e.getMessage());
        }

        return ResponseEntity.ok(response);
    }

    @PostMapping("/auth/mobile/verify")
    public ResponseEntity<Map<String, Object>> verifyMobileAuth(
            @RequestBody Map<String, Object> request,
            HttpSession session) {

        // Complete login only after Mobile-OK confirms the pending user.
        Map<String, Object> response = new HashMap<>();

        if (!isValidPendingAuthToken(request, session)) {
            response.put("success", false);
            response.put("message", "휴대폰 본인인증 대기 정보가 유효하지 않습니다.");
            return ResponseEntity.ok(response);
        }

        try {
            UserDto pendingUser = (UserDto) session.getAttribute(PENDING_LOGIN_USER);
            response.putAll(mobileOkService.confirmAuth(
                    session,
                    pendingUser,
                    String.valueOf(request.get("authNumber"))));

            if (Boolean.TRUE.equals(response.get("success"))) {
                String loginIp = String.valueOf(session.getAttribute(PENDING_LOGIN_IP));
                UserDto user = authService.completeMobileLogin(pendingUser, loginIp);

                session.removeAttribute(PENDING_LOGIN_USER);
                session.removeAttribute(PENDING_LOGIN_IP);
                session.removeAttribute(PENDING_AUTH_TOKEN);
                session.removeAttribute(MobileOkService.SESSION_CLIENT_TX_ID);
                session.removeAttribute(MobileOkService.SESSION_PUBLIC_KEY);
                session.removeAttribute(MobileOkService.SESSION_AUTH_TOKEN);
                session.setAttribute(SESSION_USER, user);

                response.put("user", user);
                logger.info("[AuthController] mobile auth login completed - userId: {}", user.getLOGIN_ID());
            }
        } catch (Exception e) {
            logger.error("[AuthController] Mobile-OK confirm failed", e);
            response.put("success", false);
            response.put("message", e.getMessage());
        }
        return ResponseEntity.ok(response);
    }

    private boolean isValidPendingAuthToken(Map<String, Object> request, HttpSession session) {
        // The pending token protects the two-step mobile auth flow from cross-session reuse.
        Object requestToken = request.get("pendingAuthToken");
        Object sessionToken = session.getAttribute(PENDING_AUTH_TOKEN);
        Object pendingUser = session.getAttribute(PENDING_LOGIN_USER);

        if (requestToken == null || sessionToken == null || pendingUser == null) {
            return false;
        }

        return String.valueOf(sessionToken).equals(String.valueOf(requestToken));
    }

    @PostMapping("/company/search")
    public ResponseEntity<Map<String, Object>> searchCompany(@RequestBody Map<String, Object> request) {
        logger.info("[AuthController] company search request - COMPANY_ID: {}", request.get("COMPANY_ID"));
        Map<String, Object> companyInfo = authService.selectCompanyInfo(request);
        return ResponseEntity.ok(ApiResponse.withKey("companyInfo", companyInfo));
    }

    @PostMapping("/company/association-list")
    public ResponseEntity<Map<String, Object>> selectAssociation(@RequestBody Map<String, Object> request) {
        List<Map<String, Object>> list = authService.selectAssociation(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    @PostMapping("/company/branch-list")
    public ResponseEntity<Map<String, Object>> selectBranchID(@RequestBody Map<String, Object> request) {
        List<Map<String, Object>> list = authService.selectBranchID(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    @PostMapping("/member/check-id")
    public ResponseEntity<Map<String, Object>> checkMemberId(@RequestBody Map<String, Object> request) {
        Map<String, Object> result = authService.selectMBCount(request);

        int count = 0;
        Object reccnt = result.get("RECCNT");
        if (reccnt == null) {
            reccnt = result.get("reccnt");
        }

        if (reccnt instanceof Number) {
            count = ((Number) reccnt).intValue();
        } else if (reccnt != null) {
            count = Integer.parseInt(String.valueOf(reccnt));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("available", count == 0);
        response.put("count", count);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/member/signup")
    public ResponseEntity<Map<String, Object>> signupMember(@RequestBody Map<String, Object> request) throws Exception {
        authService.setMember(request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "휴대폰 본인인증 대기 정보가 유효하지 않습니다.");
            return ResponseEntity.ok(response);
    }

    @PostMapping("/member/verify-password")
    public ResponseEntity<Map<String, Object>> verifyPassword(
            @RequestBody Map<String, Object> request,
            HttpSession session) {

        UserDto user = (UserDto) session.getAttribute(SESSION_USER);
        Map<String, Object> response = new HashMap<>();

        if (user == null) {
            response.put("success", false);
            response.put("message", "휴대폰 본인인증 대기 정보가 유효하지 않습니다.");
            return ResponseEntity.ok(response);
        }

        boolean verified = authService.verifyPassword(user.getLOGIN_ID(), String.valueOf(request.get("PASS_WD")));

        if (verified) {
            session.setAttribute("MEMBER_EDIT_VERIFIED", true);
            response.put("success", true);
            response.put("message", "鍮꾨?踰덊샇 ?뺤씤???꾨즺?섏뿀?듬땲??");
        } else {
            response.put("success", false);
            response.put("message", "鍮꾨?踰덊샇媛 ?쇱튂?섏? ?딆뒿?덈떎.");
        }

        return ResponseEntity.ok(response);
    }

    @PostMapping("/member/my-info")
    public ResponseEntity<Map<String, Object>> myInfo(HttpSession session) {
        UserDto user = (UserDto) session.getAttribute(SESSION_USER);
        Map<String, Object> response = new HashMap<>();

        if (user == null) {
            response.put("success", false);
            response.put("message", "휴대폰 본인인증 대기 정보가 유효하지 않습니다.");
            return ResponseEntity.ok(response);
        }

        Map<String, Object> memberInfo = authService.selectMemberInfo2(user.getLOGIN_ID());

        response.put("success", true);
        response.put("memberInfo", memberInfo);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/member/update-basic")
    public ResponseEntity<Map<String, Object>> updateMemberBasic(
            @RequestBody Map<String, Object> request,
            HttpSession session) throws Exception {

        UserDto user = (UserDto) session.getAttribute(SESSION_USER);
        Map<String, Object> response = new HashMap<>();

        if (user == null) {
            response.put("success", false);
            response.put("message", "휴대폰 본인인증 대기 정보가 유효하지 않습니다.");
            return ResponseEntity.ok(response);
        }

        Object verified = session.getAttribute("MEMBER_EDIT_VERIFIED");
        if (!(verified instanceof Boolean) || !((Boolean) verified)) {
            response.put("success", false);
            response.put("message", "휴대폰 본인인증 대기 정보가 유효하지 않습니다.");
            return ResponseEntity.ok(response);
        }

        request.put("LOGIN_ID", user.getLOGIN_ID());
        authService.updateMemberBasic(request);
        session.removeAttribute("MEMBER_EDIT_VERIFIED");

        response.put("success", true);
        response.put("message", "휴대폰 본인인증 대기 정보가 유효하지 않습니다.");
            return ResponseEntity.ok(response);
    }

    @PostMapping("/member/change-password")
    public ResponseEntity<Map<String, Object>> changePassword(
            @RequestBody Map<String, Object> request,
            HttpSession session) throws Exception {

        UserDto user = (UserDto) session.getAttribute(SESSION_USER);
        Map<String, Object> response = new HashMap<>();

        if (user == null) {
            response.put("success", false);
            response.put("message", "휴대폰 본인인증 대기 정보가 유효하지 않습니다.");
            return ResponseEntity.ok(response);
        }

        String currentPassword = String.valueOf(request.get("CURRENT_PASS_WD"));
        String newPassword = String.valueOf(request.get("NEW_PASS_WD"));
        boolean changed = authService.changePassword(user.getLOGIN_ID(), currentPassword, newPassword);

        if (changed) {
            response.put("success", true);
            response.put("message", "鍮꾨?踰덊샇媛 蹂寃쎈릺?덉뒿?덈떎.");
        } else {
            response.put("success", false);
            response.put("message", "?꾩옱 鍮꾨?踰덊샇媛 ?쇱튂?섏? ?딆뒿?덈떎.");
        }

        return ResponseEntity.ok(response);
    }
}
