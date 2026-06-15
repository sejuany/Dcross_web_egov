package com.dacos.common;

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

import com.dacos.company.CompanyController;
import com.dacos.common.util.AuthUtil;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/common")
public class CommonController {

    private static final Logger logger = LoggerFactory.getLogger(CompanyController.class);

    @Autowired
    private CommonService commonService;
    @Autowired
    private CommonRepository comm;
    
    /**
     * 주소 조회
     * POST /api/common/search/address
     */
    @PostMapping("/search/address")
    public ResponseEntity<Map<String, Object>> searchAddress(@RequestBody Map<String, Object> param) {
        logger.info("[CommonController] 주소 조회 시작 >> param : {}", param);
        
        // 1. 도로명 조회
        List<Map<String, Object>> list = comm.selectList(param, "selectAddress");
        
        logger.info("list : {}", list);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * SMS send
     * POST /api/common/sms/send
     */
    @PostMapping("/sms/send")
    public ResponseEntity<Map<String, Object>> sendSms(
            @RequestBody Map<String, Object> param,
            HttpSession session) {

        AuthUtil.getLoginUser(session);

        int result = commonService.sendSms(param);

        return ResponseEntity.ok(ApiResponse.withKey("result", result));
    }
    
    /**
     * 화면에서 바로 쿼리 조회 (단건 조회)
     * POST /api/common/query
     */
    @PostMapping("/query")
    public ResponseEntity<Map<String, Object>> query(
            @RequestBody Map<String, Object> request) {
    	
        String queryId = (String) request.remove("QUERY_ID");
        logger.info("queryId >>" + queryId + " 조회 시작");
        
        return ResponseEntity.ok(
            ApiResponse.withKey("data", comm.select(request, queryId))
        );
    }

}
