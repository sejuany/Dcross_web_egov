package com.dacos.constructequip;

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
import com.dacos.constructequip.dto.ConstructEquipSearchRequest;

/**
 * 건설기계 컨트롤러
 * - 건설기계설정(CeMortRegRequestV33), 건설기계설정현황(CeMortRegList),
 *   건설기계말소(CeMortErsRequestV21), 건설기계말소현황(CeMortErsList),
 *   건기다건말소등록(CeMortErsGroupRequest)
 */
@RestController
@RequestMapping("/api")
public class ConstructEquipController {

    private static final Logger logger = LoggerFactory.getLogger(ConstructEquipController.class);

    @Autowired
    private ConstructEquipService constructEquipService;

    /**
     * 건설기계설정 목록 조회
     * POST /api/constructequip/mort/list
     */
    @PostMapping("/constructequip/mort/list")
    public ResponseEntity<Map<String, Object>> getCeMortRegList(@RequestBody ConstructEquipSearchRequest request) {
        logger.info("[ConstructEquipController] 건설기계설정 목록 조회 요청");
        List<Map<String, Object>> list = constructEquipService.getCeMortRegList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 건설기계설정 상세 조회
     * GET /api/constructequip/mort/detail/{serviceId}
     */
    @GetMapping("/constructequip/mort/detail/{serviceId}")
    public ResponseEntity<Map<String, Object>> getCeMortRegDetail(
            @PathVariable("serviceId") String serviceId) {
        logger.info("[ConstructEquipController] 건설기계설정 상세 조회 요청 - serviceId: {}", serviceId);
        Map<String, Object> detail = constructEquipService.getCeMortRegDetail(serviceId);
        return ResponseEntity.ok(ApiResponse.withKey("data", detail));
    }

    /**
     * 건설기계말소 목록 조회
     * POST /api/constructequip/ers/list
     */
    @PostMapping("/constructequip/ers/list")
    public ResponseEntity<Map<String, Object>> getCeMortErsList(@RequestBody ConstructEquipSearchRequest request) {
        logger.info("[ConstructEquipController] 건설기계말소 목록 조회 요청");
        List<Map<String, Object>> list = constructEquipService.getCeMortErsList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 건기다건말소 목록 조회
     * POST /api/constructequip/ers/group/list
     */
    @PostMapping("/constructequip/ers/group/list")
    public ResponseEntity<Map<String, Object>> getCeMortErsGroupList(@RequestBody ConstructEquipSearchRequest request) {
        logger.info("[ConstructEquipController] 건기다건말소 목록 조회 요청");
        List<Map<String, Object>> list = constructEquipService.getCeMortErsGroupList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
}
