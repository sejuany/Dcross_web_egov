package com.dacos.addservice;

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
import com.dacos.addservice.dto.AddServiceSearchRequest;

/**
 * 부가서비스 컨트롤러
 * - 원부스크래핑(CarMileageListV1), 소유자정보확인(WonbuScrapRequest),
 *   시세(CarSise), 365시세현황(Car365priceList),
 *   카젠매핑(CarZenMapping), 보험가입여부(InsuranceManage)
 */
@RestController
@RequestMapping("/api")
public class AddServiceController {

    private static final Logger logger = LoggerFactory.getLogger(AddServiceController.class);

    @Autowired
    private AddServiceService addServiceService;

    /** 원부스크래핑(차량주행거리) 목록 조회 - POST /api/addservice/mileage/list */
    @PostMapping("/addservice/mileage/list")
    public ResponseEntity<Map<String, Object>> getCarMileageList(@RequestBody AddServiceSearchRequest request) {
        logger.info("[AddServiceController] 원부스크래핑 목록 조회 요청");
        List<Map<String, Object>> list = addServiceService.getCarMileageList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 소유자정보확인 목록 조회 - POST /api/addservice/wonbu/list */
    @PostMapping("/addservice/wonbu/list")
    public ResponseEntity<Map<String, Object>> getWonbuScrapList(@RequestBody AddServiceSearchRequest request) {
        logger.info("[AddServiceController] 소유자정보확인 목록 조회 요청");
        List<Map<String, Object>> list = addServiceService.getWonbuScrapList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 시세 조회 - POST /api/addservice/sise/list */
    @PostMapping("/addservice/sise/list")
    public ResponseEntity<Map<String, Object>> getCarSiseList(@RequestBody AddServiceSearchRequest request) {
        logger.info("[AddServiceController] 시세 조회 요청");
        List<Map<String, Object>> list = addServiceService.getCarSiseList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 365시세현황 조회 - POST /api/addservice/sise365/list */
    @PostMapping("/addservice/sise365/list")
    public ResponseEntity<Map<String, Object>> getCar365PriceList(@RequestBody AddServiceSearchRequest request) {
        logger.info("[AddServiceController] 365시세현황 조회 요청");
        List<Map<String, Object>> list = addServiceService.getCar365PriceList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 카젠매핑 목록 조회 - POST /api/addservice/carzen/list */
    @PostMapping("/addservice/carzen/list")
    public ResponseEntity<Map<String, Object>> getCarZenMappingList(@RequestBody AddServiceSearchRequest request) {
        logger.info("[AddServiceController] 카젠매핑 목록 조회 요청");
        List<Map<String, Object>> list = addServiceService.getCarZenMappingList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 보험가입여부 목록 조회 - POST /api/addservice/insurance/list */
    @PostMapping("/addservice/insurance/list")
    public ResponseEntity<Map<String, Object>> getInsuranceList(@RequestBody AddServiceSearchRequest request) {
        logger.info("[AddServiceController] 보험가입여부 목록 조회 요청");
        List<Map<String, Object>> list = addServiceService.getInsuranceList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
}
