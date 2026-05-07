package com.dacos.newcar;

import java.util.ArrayList;
import java.util.HashMap;
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

import com.dacos.auth.dto.UserDto;
import com.dacos.common.ApiResponse;
import com.dacos.common.BusinessException;
import com.dacos.common.util.AuthUtil;
import com.dacos.common.util.CommonUtil;
import com.dacos.newcar.dto.NewcarSearchRequest;

import jakarta.servlet.http.HttpSession;

/**
 * 신차 등록 컨트롤러
 * - 예외 처리는 GlobalExceptionHandler가 담당합니다.
 */
@RestController
@RequestMapping("/api")
public class NewcarController {

    private static final Logger logger = LoggerFactory.getLogger(NewcarController.class);

    @Autowired
    private NewcarService newcarService;
    
    /**
     * 신차 목록 조회
     * POST /api/newcar/list
     */
    @PostMapping("/newcar/list")
    public ResponseEntity<Map<String, Object>> getNewCarList(@RequestBody NewcarSearchRequest request) {
        logger.info("[NewcarController] 신차 목록 조회 요청");
        List<Map<String, Object>> list = newcarService.getNewCarList(request);
        // 프론트엔드 호환: { "success": true, "list": [...] }
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 신차 상세 조회
     * GET /api/newcar/detail/{serviceId}
     */
    @GetMapping("/newcar/detail/{serviceId}")
    public ResponseEntity<Map<String, Object>> getNewCarDetail(
            @PathVariable("serviceId") String serviceId) {
        logger.info("[NewcarController] 신차 상세 조회 요청 - serviceId: {}", serviceId);
        Map<String, Object> detail = newcarService.getNewCarDetail(serviceId);
        // 프론트엔드 호환: { "success": true, "data": {...} }
        return ResponseEntity.ok(ApiResponse.withKey("data", detail));
    }
    
    /**
     * 신규등록 기본정보 초기화
     * 접수번호 없는 경우 이쪽으로 들어온다.
     */
    @GetMapping("/newcar/init")
    public ResponseEntity<Map<String, Object>> initNewCar(HttpSession session) {
    	// 세션 체크
	 	UserDto user = AuthUtil.getLoginUser(session);
	 	
	 	logger.info("[NewcarController] 신규등록 기본정보 초기화 - user: {}", user);
	 	
	 	// 화면으로 넘길 값
	 	Map<String, Object> result = new HashMap<>();

        // 회원정보 초기값 넣기
        Map<String, Object> mService = new HashMap<>();
        mService.put("WORK_CD", "010");
        mService.put("LOGIN_ID", user.getLOGIN_ID());
        mService.put("COMPANY_ID", user.getCOMPANY_ID());
        mService.put("MEMBER_ID", user.getLOGIN_ID());
        mService.put("UPD_USER", user.getLOGIN_ID());
        result.put("dsService", mService);
        
        // 결제정보 초기값
        List<Map<String, Object>> payment = newcarService.getPaymentList(user);
        result.put("dsPaymentList", payment);

        return ResponseEntity.ok(ApiResponse.withKey("data", result));
    }
    
    
    /**
     * 번호판 목록 조회
     */
    @PostMapping("/newcar/numplateList")
    public ResponseEntity<Map<String, Object>> getNumplateList(
            @RequestBody Map<String, Object> param,
            HttpSession session) {

    	// 세션 체크
 		UserDto user = AuthUtil.getLoginUser(session);

        List<String> list = newcarService.getNumplateList(param, user);

        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
    

	/**
	 * 번호판 선택
	 */
	@PostMapping("/newcar/numplateSelect")
	public ResponseEntity<Map<String, Object>> selectNumplate(
	        @RequestBody Map<String, Object> param,
	        HttpSession session) {
	
		// 세션 체크
 		UserDto user = AuthUtil.getLoginUser(session);
	
	    newcarService.selectNumplate(param, user);
	
	    return ResponseEntity.ok(ApiResponse.withKey("result", "OK"));
	}
	
	
	/**
	 * 문자 전송
	 */
	@PostMapping("/newcar/numplateSms")
	public ResponseEntity<Map<String, Object>> sendSms(
	        @RequestBody Map<String, Object> param,
	        HttpSession session) {
	
	    // 세션 체크
 		UserDto user = AuthUtil.getLoginUser(session);
	
	    newcarService.sendSms(param, user);
	
	    return ResponseEntity.ok(ApiResponse.withKey("result", "OK"));
	}
	
	/**
	 * 신규등록 저장 (신규, 수정 통합)
	 */
	@PostMapping("/newcar/save")
	public ResponseEntity<Object> processNewCar(@RequestBody Map<String, Object> request, HttpSession session) {
		logger.info("[NewcarController] 신규등록 저장, 수정 통합");
		
	    // 세션 체크
		UserDto user = AuthUtil.getLoginUser(session);
 
	    // 데이터 파싱
		Map<String, Object> mService = CommonUtil.getMap(request, "dsService");
		Map<String, Object> mNewCar = CommonUtil.getMap(request, "dsNewCar");
		Map<String, Object> mCarNoDetach = CommonUtil.getMap(request, "dsCarNoDetach");
		List<Map<String, Object>> lPaymentList = CommonUtil.getList(request, "dsPaymentList");
		List<Map<String, Object>> lOwnerInfoList = CommonUtil.getList(request, "dsOwnerInfo");

	    
	    logger.debug("mService : {}", mService);
	    logger.debug("mNewCar : {}", mNewCar);
	    logger.debug("mCarNoDetach : {}", mCarNoDetach);
	    logger.debug("lOwnerInfoList : {}", lOwnerInfoList);
	    logger.debug("lPaymentList : {}", lPaymentList);
	    
	    Map<String, String> mReturn;

	    try {
	        // 서비스 호출
	        mReturn = newcarService.processNewCar(
	                mNewCar, mService, mCarNoDetach, lOwnerInfoList, lPaymentList
	        );

	        logger.debug("mReturn: {}", mReturn);

	        // 실패 처리
	        if ("FAIL".equals(mReturn.get("SERVICE_ID")) ||
	            (mReturn.get("MESSAGE") != null && !mReturn.get("MESSAGE").isEmpty())) {

	            String msg = "FAIL".equals(mReturn.get("SERVICE_ID")) ? "ERROR! " + mReturn.get("MESSAGE") : mReturn.get("MESSAGE");

	            return ResponseEntity.ok(ApiResponse.fail(msg));
	        }

	        // ===== 성공 =====
	        Map<String, Object> result = new HashMap<>();
	        result.put("SERVICE_ID", mReturn.get("SERVICE_ID"));
	        result.put("ReturnPage", "/NC/NewCarRequest.do?SERVICE_ID=" + mReturn.get("SERVICE_ID"));

	        return ResponseEntity.ok(ApiResponse.withKey("data", result));

	    } catch (Exception e) {
	        logger.error("신규등록 저장 중 오류", e);
	        return ResponseEntity.ok(ApiResponse.fail("ERROR! " + e.getMessage()));
	    }
	}


}
