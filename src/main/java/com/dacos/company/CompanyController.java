package com.dacos.company;

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
import com.dacos.company.dto.CompanySearchRequest;

/**
 * 기업관리 컨트롤러
 * - 기업관리(CompanyManageV4), 사용자관리(CompanyUserManage),
 *   탈부착업체관리(NumplateDeliveryManage), 회원사관리(CompanyNew)
 */
@RestController
@RequestMapping("/api")
public class CompanyController {

    private static final Logger logger = LoggerFactory.getLogger(CompanyController.class);

    @Autowired
    private CompanyService companyService;

    /** 기업 목록 조회 - POST /api/company/list */
    @PostMapping("/company/list")
    public ResponseEntity<Map<String, Object>> getCompanyList(@RequestBody CompanySearchRequest request) {
        logger.info("[CompanyController] 기업 목록 조회 요청");
        List<Map<String, Object>> list = companyService.getCompanyList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 기업 상세 조회 - GET /api/company/detail/{companyId} */
    @GetMapping("/company/detail/{companyId}")
    public ResponseEntity<Map<String, Object>> getCompanyDetail(
            @PathVariable("companyId") String companyId) {
        logger.info("[CompanyController] 기업 상세 조회 요청 - companyId: {}", companyId);
        Map<String, Object> detail = companyService.getCompanyDetail(companyId);
        return ResponseEntity.ok(ApiResponse.withKey("data", detail));
    }

    /** 사용자 목록 조회 - POST /api/company/user/list */
    @PostMapping("/company/user/list")
    public ResponseEntity<Map<String, Object>> getCompanyUserList(@RequestBody CompanySearchRequest request) {
        logger.info("[CompanyController] 사용자 목록 조회 요청");
        List<Map<String, Object>> list = companyService.getCompanyUserList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 탈부착업체 목록 조회 - POST /api/company/numplate/list */
    @PostMapping("/company/numplate/list")
    public ResponseEntity<Map<String, Object>> getNumplateDeliveryList(@RequestBody CompanySearchRequest request) {
        logger.info("[CompanyController] 탈부착업체 목록 조회 요청");
        List<Map<String, Object>> list = companyService.getNumplateDeliveryList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
}
