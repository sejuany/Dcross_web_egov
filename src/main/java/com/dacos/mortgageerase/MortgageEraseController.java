package com.dacos.mortgageerase;

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
import com.dacos.mortgageerase.dto.MortgageEraseSearchRequest;

/**
 * 저당말소 컨트롤러
 * - 말소등록(MortErsRequestV21), 말소신청현황(MortErsList),
 *   다건말소등록(MortErsGroupRequest), 말소수동신청(MortErsRequestV22)
 * - 예외 처리는 GlobalExceptionHandler가 담당합니다.
 */
@RestController
@RequestMapping("/api")
public class MortgageEraseController {

    private static final Logger logger = LoggerFactory.getLogger(MortgageEraseController.class);

    @Autowired
    private MortgageEraseService mortgageEraseService;

    /**
     * 저당말소 목록 조회 (말소신청현황)
     * POST /api/mortgageerase/list
     */
    @PostMapping("/mortgageerase/list")
    public ResponseEntity<Map<String, Object>> getMortgageEraseList(@RequestBody MortgageEraseSearchRequest request) {
        logger.info("[MortgageEraseController] 저당말소 목록 조회 요청");
        List<Map<String, Object>> list = mortgageEraseService.getMortgageEraseList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 저당말소 상세 조회
     * GET /api/mortgageerase/detail/{serviceId}
     */
    @GetMapping("/mortgageerase/detail/{serviceId}")
    public ResponseEntity<Map<String, Object>> getMortgageEraseDetail(
            @PathVariable("serviceId") String serviceId) {
        logger.info("[MortgageEraseController] 저당말소 상세 조회 요청 - serviceId: {}", serviceId);
        Map<String, Object> detail = mortgageEraseService.getMortgageEraseDetail(serviceId);
        return ResponseEntity.ok(ApiResponse.withKey("data", detail));
    }

    /**
     * 다건말소 목록 조회
     * POST /api/mortgageerase/group/list
     */
    @PostMapping("/mortgageerase/group/list")
    public ResponseEntity<Map<String, Object>> getMortgageEraseGroupList(@RequestBody MortgageEraseSearchRequest request) {
        logger.info("[MortgageEraseController] 다건말소 목록 조회 요청");
        List<Map<String, Object>> list = mortgageEraseService.getMortgageEraseGroupList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
}
