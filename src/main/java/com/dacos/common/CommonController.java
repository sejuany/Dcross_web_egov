package com.dacos.common;

import java.util.Objects;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.company.CompanyController;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.util.AuthUtil;
import com.dacos.common.ServiceAccessGuard.ServiceAction;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/common")
public class CommonController {

    private static final Logger logger = LoggerFactory.getLogger(CompanyController.class);

    private final CommonService commonService;
    private final CommonRepository comm;
    private final ServiceAccessGuard serviceAccessGuard;

    public CommonController(
            CommonService commonService,
            CommonRepository comm,
            ServiceAccessGuard serviceAccessGuard) {
        this.commonService = commonService;
        this.comm = comm;
        this.serviceAccessGuard = serviceAccessGuard;
    }
    
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
     * 전자서명 이력 생성 
     * POST /api/common/insertDsign
     */
    @PostMapping("/insertDsign")
    public ResponseEntity<Map<String, Object>> insertDsign(
            @RequestBody Map<String, Object> param,
            HttpSession session) {
    	
    	logger.info("[CommonController] 전자서명 이력 생성 >> param : {}", param);
	    UserDto user = AuthUtil.getLoginUser(session);
	    String serviceId = Objects.toString(param.get("SERVICE_ID"), "").trim();
	    serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.UPDATE_SERVICE);
        int result = commonService.insertDsign(param);

        return ResponseEntity.ok(ApiResponse.withKey("result", result));
    }
    
    /**
     * 토큰 중복 조회
     * POST /api/common/tokenCheck
     */
    @PostMapping("/token/check")
    public ResponseEntity<Map<String, Object>> tokenCheck(
            @RequestBody Map<String, Object> param,
            HttpSession session) {

        AuthUtil.getLoginUser(session);

        int result = comm.select(param, "selectTokenCnt");

        return ResponseEntity.ok(ApiResponse.withKey("result", result));
    }
    @PostMapping("/procedure/board")
    public void procedureTmBoard(
            @RequestBody Map<String, Object> param, HttpSession session) {
    	// 세션 체크
 		AuthUtil.getLoginUser(session);

 		commonService.procedureTmBoard(param);
    }
}
