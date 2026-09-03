package com.dacos.common;

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
import com.dacos.common.util.AuthUtil;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/common")
public class CommonController {

    private static final Logger logger = LoggerFactory.getLogger(CompanyController.class);

    private final CommonService commonService;
    private final CommonRepository comm;

    public CommonController(CommonService commonService, CommonRepository comm) {
        this.commonService = commonService;
        this.comm = comm;
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
    	
    	// 고객 페이지에선 세션 대신 토큰으로 접속해서 세션 체크를 하지 않는다. 
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
    
    /**
     * 화면에서 바로 쿼리 조회 (단건 조회)
     * POST /api/common/query
     */
    @PostMapping("/query")
    public ResponseEntity<Map<String, Object>> query(
            @RequestBody Map<String, Object> request) {
    	
    	String gubun = request.get("GUBUN") == null
    			// 구분 지정 안 하면 자동으로 SELECT
    			? "SELECT"
    	        : request.remove("GUBUN").toString().toUpperCase();
    	
        String queryId = (String) request.remove("QUERY_ID");
        logger.info("queryId >>" + queryId + " 조회 시작");
        
        // 기본값 = SELECT
        if ("SELECT".equalsIgnoreCase(gubun)) {

            logger.info("queryId >> {} 조회 시작", queryId);

            return ResponseEntity.ok(
                ApiResponse.withKey("data", comm.select(request, queryId))
            );
        }
        
        // UPDATE
        if ("UPDATE".equalsIgnoreCase(gubun)) {

            logger.info("queryId >> {} 수정 시작", queryId);

            return ResponseEntity.ok(
                ApiResponse.withKey("count", comm.update(request, queryId))
            );
        }
        
        throw new IllegalArgumentException("지원하지 않는 GUBUN : " + gubun);
    }
    
	
	/**
	 * 화면에서 바로 쿼리 조회 (목록 조회)
	 * POST /api/common/query-list
	 */
	@PostMapping("/query-list")
	public ResponseEntity<Map<String, Object>> queryList(
	        @RequestBody Map<String, Object> request) {
	
	    String queryId = (String) request.remove("QUERY_ID");
	
	    logger.info("queryId >> {} 목록 조회 시작", queryId);
	
	    return ResponseEntity.ok(
	        ApiResponse.withKey("list", comm.selectList(request, queryId))
	    );
	}
    
    @PostMapping("/procedure/board")
    public void procedureTmBoard(
            @RequestBody Map<String, Object> param, HttpSession session) {
    	// 세션 체크
 		AuthUtil.getLoginUser(session);

 		commonService.procedureTmBoard(param);
    }
}
