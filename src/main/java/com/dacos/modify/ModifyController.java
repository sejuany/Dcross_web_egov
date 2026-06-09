package com.dacos.modify;

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
import com.dacos.modify.dto.ModifySearchRequest;

/**
 * 변경등록 컨트롤러
 * - 변경등록(ModifyRequest), 변경등록현황(ModifyList),
 *   다건변경등록(ModifyGroupRequest), 등록증재발급(CarpReprintRequest),
 *   다건등록증재발급(CarpReprintRequest), 등록증현황(CarpReprintList)
 */
@RestController
@RequestMapping("/api")
public class ModifyController {

    private static final Logger logger = LoggerFactory.getLogger(ModifyController.class);

    @Autowired
    private ModifyService modifyService;

    /**
     * 변경등록 목록 조회
     * POST /api/modify/list
     */
    @PostMapping("/modify/list")
    public ResponseEntity<Map<String, Object>> getModifyList(@RequestBody ModifySearchRequest request) {
        logger.info("[ModifyController] 변경등록 목록 조회 요청");
        List<Map<String, Object>> list = modifyService.getModifyList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 변경등록 상세 조회
     * GET /api/modify/detail/{serviceId}
     */
    @GetMapping("/modify/detail/{serviceId}")
    public ResponseEntity<Map<String, Object>> getModifyDetail(
            @PathVariable("serviceId") String serviceId) {
        logger.info("[ModifyController] 변경등록 상세 조회 요청 - serviceId: {}", serviceId);
        Map<String, Object> detail = modifyService.getModifyDetail(serviceId);
        return ResponseEntity.ok(ApiResponse.withKey("data", detail));
    }

    /**
     * 등록증재발급(등록증현황) 목록 조회
     * POST /api/modify/carp/list
     */
    @PostMapping("/modify/carp/list")
    public ResponseEntity<Map<String, Object>> getCarpReprintList(@RequestBody ModifySearchRequest request) {
        logger.info("[ModifyController] 등록증재발급 목록 조회 요청");
        List<Map<String, Object>> list = modifyService.getCarpReprintList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
}
