package com.dacos.trnsname;

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
import com.dacos.trnsname.dto.TrnsNameSearchRequest;

/**
 * 이전등록 컨트롤러
 * - 이전등록(TrnsNameRequestV52), 이전등록현황(TrnsNameList),
 *   통합업로드(신규,이전)(TotalGroupRequest), 등록증발송현황(CarpRequestList),
 *   탈부착요청현황(TrnsNumChangeList), 오프라인(OfflineList)
 */
@RestController
@RequestMapping("/api")
public class TrnsNameController {

    private static final Logger logger = LoggerFactory.getLogger(TrnsNameController.class);

    @Autowired
    private TrnsNameService trnsNameService;

    /**
     * 이전등록 목록 조회
     * POST /api/trnsname/list
     */
    @PostMapping("/trnsname/list")
    public ResponseEntity<Map<String, Object>> getTrnsNameList(@RequestBody TrnsNameSearchRequest request) {
        logger.info("[TrnsNameController] 이전등록 목록 조회 요청");
        List<Map<String, Object>> list = trnsNameService.getTrnsNameList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 이전등록 상세 조회
     * GET /api/trnsname/detail/{serviceId}
     */
    @GetMapping("/trnsname/detail/{serviceId}")
    public ResponseEntity<Map<String, Object>> getTrnsNameDetail(
            @PathVariable("serviceId") String serviceId) {
        logger.info("[TrnsNameController] 이전등록 상세 조회 요청 - serviceId: {}", serviceId);
        Map<String, Object> detail = trnsNameService.getTrnsNameDetail(serviceId);
        return ResponseEntity.ok(ApiResponse.withKey("data", detail));
    }

    /**
     * 등록증발송현황 목록 조회
     * POST /api/trnsname/carp/list
     */
    @PostMapping("/trnsname/carp/list")
    public ResponseEntity<Map<String, Object>> getCarpRequestList(@RequestBody TrnsNameSearchRequest request) {
        logger.info("[TrnsNameController] 등록증발송현황 목록 조회 요청");
        List<Map<String, Object>> list = trnsNameService.getCarpRequestList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 탈부착요청현황 목록 조회
     * POST /api/trnsname/numchange/list
     */
    @PostMapping("/trnsname/numchange/list")
    public ResponseEntity<Map<String, Object>> getTrnsNumChangeList(@RequestBody TrnsNameSearchRequest request) {
        logger.info("[TrnsNameController] 탈부착요청현황 목록 조회 요청");
        List<Map<String, Object>> list = trnsNameService.getTrnsNumChangeList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 오프라인 목록 조회
     * POST /api/trnsname/offline/list
     */
    @PostMapping("/trnsname/offline/list")
    public ResponseEntity<Map<String, Object>> getOfflineList(@RequestBody TrnsNameSearchRequest request) {
        logger.info("[TrnsNameController] 오프라인 목록 조회 요청");
        List<Map<String, Object>> list = trnsNameService.getOfflineList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
}
