package com.dacos.auth;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.auth.dto.LoginRequest;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.ApiResponse;
import jakarta.servlet.http.HttpSession; 

import java.util.HashMap;
import java.util.List;

/**
 * 인증 컨트롤러
 * - 예외 처리는 GlobalExceptionHandler가 담당하므로 try-catch 코드가 없습니다.
 */
@RestController
@RequestMapping("/api")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private AuthService authService;

    /**
     * 로그인 처리
     * POST /api/login
     */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody LoginRequest request, HttpSession session) {
        logger.info("[AuthController] 로그인 요청 - userId: {}", request.getUserId());
        UserDto user = authService.authenticate(request);
        session.setAttribute("user", user); // 세션 추가
        logger.info("[AuthController] 로그인 성공 - userId: {}", request.getUserId());
        // 프론트엔드 호환: { "success": true, "user": {...} }
        return ResponseEntity.ok(ApiResponse.withKey("user", user));
    }
    
    @PostMapping("/company/search")
    public ResponseEntity<Map<String, Object>> searchCompany(@RequestBody Map<String, Object> request) {
        logger.info("[AuthController] 회원사 조회 요청 - COMPANY_ID: {}", request.get("COMPANY_ID"));

        Map<String, Object> companyInfo = authService.selectCompanyInfo(request);

        if (companyInfo == null) {
            //return ResponseEntity.ok(ApiResponse.error("회원사 정보를 찾을 수 없습니다."));
        }

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
        response.put("message", "회원가입 신청이 완료되었습니다.");

        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/member/verify-password")
    public ResponseEntity<Map<String, Object>> verifyPassword(
            @RequestBody Map<String, Object> request,
            HttpSession session) {

        UserDto user = (UserDto) session.getAttribute("user");

        Map<String, Object> response = new HashMap<>();

        if (user == null) {
            response.put("success", false);
            response.put("message", "로그인 정보가 없습니다.");
            return ResponseEntity.ok(response);
        }

        boolean verified = authService.verifyPassword(user.getLOGIN_ID(), String.valueOf(request.get("PASS_WD")));

        if (verified) {
            session.setAttribute("MEMBER_EDIT_VERIFIED", true);
            response.put("success", true);
            response.put("message", "비밀번호 확인이 완료되었습니다.");
        } else {
            response.put("success", false);
            response.put("message", "비밀번호가 일치하지 않습니다.");
        }

        return ResponseEntity.ok(response);
    }

    @PostMapping("/member/my-info")
    public ResponseEntity<Map<String, Object>> myInfo(HttpSession session) {
        UserDto user = (UserDto) session.getAttribute("user");

        Map<String, Object> response = new HashMap<>();

        if (user == null) {
            response.put("success", false);
            response.put("message", "로그인 정보가 없습니다.");
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

        UserDto user = (UserDto) session.getAttribute("user");

        Map<String, Object> response = new HashMap<>();

        if (user == null) {
            response.put("success", false);
            response.put("message", "로그인 정보가 없습니다.");
            return ResponseEntity.ok(response);
        }

        Object verified = session.getAttribute("MEMBER_EDIT_VERIFIED");
        if (!(verified instanceof Boolean) || !((Boolean) verified)) {
            response.put("success", false);
            response.put("message", "비밀번호 확인 후 수정할 수 있습니다.");
            return ResponseEntity.ok(response);
        }

        request.put("LOGIN_ID", user.getLOGIN_ID());

        authService.updateMemberBasic(request);

        session.removeAttribute("MEMBER_EDIT_VERIFIED");

        response.put("success", true);
        response.put("message", "회원정보가 수정되었습니다.");
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/member/change-password")
    public ResponseEntity<Map<String, Object>> changePassword(
            @RequestBody Map<String, Object> request,
            HttpSession session) throws Exception {

        UserDto user = (UserDto) session.getAttribute("user");

        Map<String, Object> response = new HashMap<>();

        if (user == null) {
            response.put("success", false);
            response.put("message", "로그인 정보가 없습니다.");
            return ResponseEntity.ok(response);
        }

        String currentPassword = String.valueOf(request.get("CURRENT_PASS_WD"));
        String newPassword = String.valueOf(request.get("NEW_PASS_WD"));

        boolean changed = authService.changePassword(user.getLOGIN_ID(), currentPassword, newPassword);

        if (changed) {
            response.put("success", true);
            response.put("message", "비밀번호가 변경되었습니다.");
        } else {
            response.put("success", false);
            response.put("message", "현재 비밀번호가 일치하지 않습니다.");
        }

        return ResponseEntity.ok(response);
    }
}
