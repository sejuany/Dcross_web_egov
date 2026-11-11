package com.dacos.mortgage;

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

import com.dacos.common.ApiResponse;
import com.dacos.mortgage.dto.MortgageSearchRequest;
import com.dacos.common.util.AuthUtil;
import jakarta.servlet.http.HttpSession;

/**
 * 저당설정 컨트롤러
 * - 저당설정, 설정등록, 설정신청현황, 사전전자서명, 대사작업, 공동저당, 저당권변경, 저당권변경현황, 경정관리, 처리지연현황
 * - 예외 처리는 GlobalExceptionHandler가 담당합니다.
 */
@RestController
@RequestMapping("/api")
public class MortgageController {

    private static final Logger logger = LoggerFactory.getLogger(MortgageController.class);

    private final MortgageService mortgageService;
    private final MortgageRequestService mortgageRequestService;

    public MortgageController(MortgageService mortgageService, MortgageRequestService mortgageRequestService) {
        this.mortgageService = mortgageService;
        this.mortgageRequestService = mortgageRequestService;
    }

    /** 설정등록 화면의 회사정보·업무권한·공통코드 초기조회 */
    @GetMapping("/mortgage/request/init")
    public ResponseEntity<Map<String, Object>> initRequest(HttpSession session) {
        return ResponseEntity.ok(ApiResponse.withKey("data", mortgageRequestService.init(AuthUtil.getLoginUser(session))));
    }

    /** 기존 단건 API와 구분한 설정등록 전체 상세조회 */
    @GetMapping("/mortgage/request/detail/{serviceId}")
    public ResponseEntity<Map<String, Object>> requestDetail(@PathVariable("serviceId") String serviceId, HttpSession session) {
        return ResponseEntity.ok(ApiResponse.withKey("data", mortgageRequestService.detail(serviceId, AuthUtil.getLoginUser(session))));
    }

    /** 원부연계 결과는 서버 세션에 보관해 저장 시 클라이언트의 임의 차량정보를 신뢰하지 않는다. */
    @PostMapping("/mortgage/request/car-info")
    public ResponseEntity<Map<String, Object>> requestCarInfo(@RequestBody Map<String, Object> request, HttpSession session) {
        Map<String, Object> result = mortgageRequestService.carInfo(request, AuthUtil.getLoginUser(session));
        String token = java.util.UUID.randomUUID().toString();
        session.setAttribute("mortgageRequest.link." + token, new java.util.HashMap<>(result));
        result.put("linkToken", token);
        return ResponseEntity.ok(ApiResponse.withKey("data", result));
    }

    /** 설정등록 SAV 저장만 처리한다. 신청·결제·전자서명 요청은 실행하지 않는다. */
    @PostMapping("/mortgage/request/save")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> saveRequest(@RequestBody Map<String, Object> request, HttpSession session) {
        String token = java.util.Objects.toString(request.get("linkToken"), "");
        Map<String, Object> linked = (Map<String, Object>) session.getAttribute("mortgageRequest.link." + token);
        return ResponseEntity.ok(ApiResponse.withKey("data", mortgageRequestService.save(request, AuthUtil.getLoginUser(session), linked)));
    }

    /**
     * 저당설정 목록 조회 (설정신청현황)
     * POST /api/mortgage/list
     */
    @PostMapping("/mortgage/list")
    public ResponseEntity<Map<String, Object>> getMortgageList(@RequestBody MortgageSearchRequest request, HttpSession session) {
        logger.info("[MortgageController] 저당설정 목록 조회 요청");
        List<Map<String, Object>> list = mortgageService.getMortgageList(request, AuthUtil.getLoginUser(session));
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 저당설정 상세 조회
     * GET /api/mortgage/detail/{serviceId}
     */
    @GetMapping("/mortgage/detail/{serviceId}")
    public ResponseEntity<Map<String, Object>> getMortgageDetail(
            @PathVariable("serviceId") String serviceId) {
        logger.info("[MortgageController] 저당설정 상세 조회 요청 - serviceId: {}", serviceId);
        Map<String, Object> detail = mortgageService.getMortgageDetail(serviceId);
        return ResponseEntity.ok(ApiResponse.withKey("data", detail));
    }

    /**
     * 저당권변경 목록 조회
     * POST /api/mortgage/change/list
     */
    @PostMapping("/mortgage/change/list")
    public ResponseEntity<Map<String, Object>> getMortgageChangeList(@RequestBody MortgageSearchRequest request) {
        logger.info("[MortgageController] 저당권변경 목록 조회 요청");
        List<Map<String, Object>> list = mortgageService.getMortgageChangeList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 경정관리 목록 조회
     * POST /api/mortgage/correction/list
     */
    @PostMapping("/mortgage/correction/list")
    public ResponseEntity<Map<String, Object>> getCorrectionList(@RequestBody MortgageSearchRequest request) {
        logger.info("[MortgageController] 경정관리 목록 조회 요청");
        List<Map<String, Object>> list = mortgageService.getCorrectionList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 처리지연현황 목록 조회
     * POST /api/mortgage/delay/list
     */
    @PostMapping("/mortgage/delay/list")
    public ResponseEntity<Map<String, Object>> getDelayList(@RequestBody MortgageSearchRequest request) {
        logger.info("[MortgageController] 처리지연현황 목록 조회 요청");
        List<Map<String, Object>> list = mortgageService.getDelayList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
}
