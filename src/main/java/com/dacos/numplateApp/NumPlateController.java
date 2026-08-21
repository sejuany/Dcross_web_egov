package com.dacos.numplateApp;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.ApiResponse;
import com.dacos.common.util.AuthUtil;
import com.dacos.numplateApp.dto.NumPlateSearchRequest;

import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/**
 * 번호판 관리 웹 화면과 모바일 번호판 앱의 REST API 진입점.
 *
 * <p>모바일 처리 흐름:
 * 휴대폰 로그인 → 처리목록 조회 → 처리건 상세 조회 → 배송처리 또는 심사요청 → 결과조회.
 * 모바일 API는 세션의 {@code LOGIN_GB=NUMPLATE_APP} 사용자만 서비스 계층에서 허용한다.</p>
 */
@RestController
@RequestMapping("/api")
public class NumPlateController {

    private static final Logger logger = LoggerFactory.getLogger(NumPlateController.class);

    private final NumPlateService numPlateService;

    public NumPlateController(NumPlateService numPlateService) {
        this.numPlateService = numPlateService;
    }

    /** 담당자 휴대폰 번호와 비밀번호를 확인하고 번호판 앱 전용 세션을 생성한다. */
    @PostMapping("/numplateapp/login")
    public ResponseEntity<Map<String, Object>> loginManager(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest,
            HttpSession session) {
        UserDto user = numPlateService.loginManager(request);
        // 로그인 직후 세션 ID를 교체해 세션 고정 공격을 방지한다.
        httpRequest.changeSessionId();
        session.setMaxInactiveInterval(30 * 60);
        session.setAttribute("user", user);
        return ResponseEntity.ok(ApiResponse.withKey("user", user));
    }

    /** 번호판 목록 조회 - POST /api/numplate/list */
    @PostMapping("/numplate/list")
    public ResponseEntity<Map<String, Object>> getNumPlateList(
            @Valid @RequestBody NumPlateSearchRequest request, HttpSession session) {
        applyCompanyScope(request, session);
        logger.info("[NumPlateController] 번호판 목록 조회 요청");
        List<Map<String, Object>> list = numPlateService.getNumPlateList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    @PostMapping("/numplate/car-paper/list")
    public ResponseEntity<Map<String, Object>> getCarPaperList(
            @Valid @RequestBody NumPlateSearchRequest request, HttpSession session) {
        applyCompanyScope(request, session);
        return ResponseEntity.ok(ApiResponse.withKey("list", numPlateService.getCarPaperList(request)));
    }

    @PostMapping("/numplate/temporary/list")
    public ResponseEntity<Map<String, Object>> getTemporaryNumPlateList(
            @Valid @RequestBody NumPlateSearchRequest request, HttpSession session) {
        applyCompanyScope(request, session);
        return ResponseEntity.ok(ApiResponse.withKey("list", numPlateService.getTemporaryNumPlateList(request)));
    }

    @PostMapping("/numplate/supply/list")
    public ResponseEntity<Map<String, Object>> getSupplyList(
            @Valid @RequestBody NumPlateSearchRequest request, HttpSession session) {
        applyCompanyScope(request, session);
        return ResponseEntity.ok(ApiResponse.withKey("list", numPlateService.getSupplyList(request)));
    }

    @PostMapping("/numplateapp/process/list")
    public ResponseEntity<Map<String, Object>> getProcessList(
            @RequestBody(required = false) Map<String, Object> request, HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        Map<String, Object> body = request == null ? Map.of() : request;
        return ResponseEntity.ok(ApiResponse.withKey("list", numPlateService.getProcessList(body, user)));
    }

    /** 목록에서 선택한 접수번호의 상세 또는 처리결과를 조회한다. */
    @GetMapping("/numplateapp/process/{serviceId}")
    public ResponseEntity<Map<String, Object>> getProcessDetail(
            @PathVariable String serviceId, HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok(ApiResponse.withKey("data", numPlateService.getProcessDetail(serviceId, user)));
    }

    /** 확인된 입력값을 저장한 뒤 건 유형에 따라 배송 완료 또는 심사요청으로 상태를 변경한다. */
    @PostMapping("/numplateapp/process/{serviceId}/request")
    public ResponseEntity<Map<String, Object>> requestProcess(
            @PathVariable String serviceId,
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok(ApiResponse.withKey(
                "data", numPlateService.requestProcess(serviceId, request, user)));
    }

    private void applyCompanyScope(NumPlateSearchRequest request, HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        // 일반 회사 사용자가 요청 본문의 회사코드를 바꿔 타사 데이터를 조회하지 못하게 한다.
        if (!"dacos".equalsIgnoreCase(user.getCOMPANY_ID())) {
            request.setCOMPANY_ID(user.getCOMPANY_ID());
        }
    }

}
