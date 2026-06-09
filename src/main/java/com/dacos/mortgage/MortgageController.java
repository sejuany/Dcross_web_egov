package com.dacos.mortgage;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.common.ApiResponse;
import com.dacos.mortgage.dto.MortgageSearchRequest;

/**
 * 저당설정 컨트롤러
 * - 저당설정, 설정등록, 설정신청현황, 사전전자서명, 대사작업, 공동저당, 저당권변경, 저당권변경현황, 경정관리, 처리지연현황
 * - 예외 처리는 GlobalExceptionHandler가 담당합니다.
 */
@RestController
@RequestMapping("/api")
public class MortgageController {

    private static final Logger logger = LoggerFactory.getLogger(MortgageController.class);

    @Autowired
    private MortgageService mortgageService;

    /**
     * 저당설정 목록 조회 (설정신청현황)
     * POST /api/mortgage/list
     */
    @PostMapping("/mortgage/list")
    public ResponseEntity<Map<String, Object>> getMortgageList(@RequestBody MortgageSearchRequest request) {
        logger.info("[MortgageController] 저당설정 목록 조회 요청");
        List<Map<String, Object>> list = mortgageService.getMortgageList(request);
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
