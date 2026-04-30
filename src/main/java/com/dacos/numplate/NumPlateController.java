package com.dacos.numplate;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.common.ApiResponse;
import com.dacos.numplate.dto.NumPlateSearchRequest;

/**
 * 번호판관리 컨트롤러
 * - 번호판목록(NumberPlateList), 자동차등록증관리(CarPaperManage),
 *   임판회수관리(TemporaryNumPlate), 번호판수불관리(NumPlateSupplyManage),
 *   번호판납품현황(NumPlateSupplyList)
 */
@RestController
@RequestMapping("/api")
public class NumPlateController {

    private static final Logger logger = LoggerFactory.getLogger(NumPlateController.class);

    @Autowired
    private NumPlateService numPlateService;

    /** 번호판 목록 조회 - POST /api/numplate/list */
    @PostMapping("/numplate/list")
    public ResponseEntity<Map<String, Object>> getNumPlateList(@RequestBody NumPlateSearchRequest request) {
        logger.info("[NumPlateController] 번호판 목록 조회 요청");
        List<Map<String, Object>> list = numPlateService.getNumPlateList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 자동차등록증관리 목록 조회 - POST /api/numplate/carpaper/list */
    @PostMapping("/numplate/carpaper/list")
    public ResponseEntity<Map<String, Object>> getCarPaperList(@RequestBody NumPlateSearchRequest request) {
        logger.info("[NumPlateController] 자동차등록증관리 목록 조회 요청");
        List<Map<String, Object>> list = numPlateService.getCarPaperList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 임판회수관리 목록 조회 - POST /api/numplate/temp/list */
    @PostMapping("/numplate/temp/list")
    public ResponseEntity<Map<String, Object>> getTempNumPlateList(@RequestBody NumPlateSearchRequest request) {
        logger.info("[NumPlateController] 임판회수관리 목록 조회 요청");
        List<Map<String, Object>> list = numPlateService.getTempNumPlateList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 번호판수불관리 목록 조회 - POST /api/numplate/supply/list */
    @PostMapping("/numplate/supply/list")
    public ResponseEntity<Map<String, Object>> getNumPlateSupplyList(@RequestBody NumPlateSearchRequest request) {
        logger.info("[NumPlateController] 번호판수불관리 목록 조회 요청");
        List<Map<String, Object>> list = numPlateService.getNumPlateSupplyList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
}
