package com.dacos.newcar;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.ApiResponse;
import com.dacos.common.CommonService;
import com.dacos.common.util.AuthUtil;
import com.dacos.newcar.dto.NewcarSearchRequest;

import jakarta.servlet.http.HttpSession;

/**
 * 신차 등록 컨트롤러
 * - 예외 처리는 GlobalExceptionHandler가 담당합니다.
 */
@RestController
@RequestMapping("/api/newcar")
public class NewcarController {

    private static final Logger logger = LoggerFactory.getLogger(NewcarController.class);

    @Autowired
    private NewcarService newcarService;
    @Autowired
    private CommonService commonService;
    
    /**
     * 신차 목록 조회
     * POST /api/newcar/list
     */
    @PostMapping("/list")
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
    @GetMapping("/detail/{serviceId}")
    public ResponseEntity<Map<String, Object>> getNewCarDetail(HttpSession session, 
    		@PathVariable("serviceId") String serviceId) {
        logger.info("[NewcarController] 신차 상세 조회 요청 - serviceId: {}", serviceId);
        
        UserDto user = AuthUtil.getLoginUser(session);
        
        Map<String, Object> detail = newcarService.getNewCarDetail(user, serviceId);
        // 프론트엔드 호환: { "success": true, "data": {...} }
        return ResponseEntity.ok(ApiResponse.withKey("data", detail));
    }
    
    /**
     * 다건 상태 변경
     * POST /api/newcar/change-proc-st
     */
    @PostMapping("/change-proc-st")
    public ResponseEntity<Map<String, Object>> changeProcSt(
            @RequestBody Map<String, Object> request) {
        logger.info("[NewcarController] 상태 변경 요청");
        List<String> serviceIds = (List<String>) request.get("SERVICE_IDS");
        String procSt = (String) request.get("PROC_ST");
        int result = newcarService.changeProcSt(serviceIds, procSt);
        return ResponseEntity.ok(ApiResponse.withKey("result", result));
    }
    
    /**
     * 엑셀 업로드
     * POST /api/newcar/excel-upload
     */
    @PostMapping("/excel-upload")
    public ResponseEntity<?> uploadExcel(@RequestParam("file") MultipartFile file, HttpSession session) {

        try {
        	 // 세션 체크
    	    UserDto user = AuthUtil.getLoginUser(session);
    	    
            int insertCount = newcarService.uploadExcel(file, user);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "insertCount", insertCount
            ));

        } catch (Exception e) {

            e.printStackTrace();

            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", e.getMessage()
            ));
        }
    }
    
    /**
     * 신규등록 기본정보 초기화
     * 접수번호 없는 경우 이쪽으로 들어온다.
     * GET /api/newcar/init
     */
    @GetMapping("/init")
    public ResponseEntity<Map<String, Object>> initNewCar(HttpSession session) {

        UserDto user = AuthUtil.getLoginUser(session);

        logger.info("[NewcarController] 신규등록 기본정보 초기화 - user: {}", user);

        Map<String, Object> result = newcarService.initNewCar(user);
        
        return ResponseEntity.ok(ApiResponse.withKey("data", result));
    }
    
    
    /**
     * 선택 가능한 번호판 목록 조회
     *  POST /api/newcar/numplateList
     */
    @PostMapping("/numplateList")
    public List<String> getNumplateList(
            @RequestBody Map<String, Object> param, HttpSession session) {
    	// 세션 체크
 		UserDto user = AuthUtil.getLoginUser(session);

 		return newcarService.getNumplateList(param, user);
    }
    
    /**
     *  미사용 번호판 상태복구
     *  POST /api/newcar/numplateRelease
     */
    @PostMapping("/numplateRelease")
    public boolean numplateRelease(
            @RequestBody Map<String, Object> param, HttpSession session) {
    	// 세션 체크
 		AuthUtil.getLoginUser(session);
 		// 미사용 번호판 상태복구
 		return newcarService.getNumPlateRelease(param);
    }
    

	/**
	 * 번호판 선택
	 * POST /api/newcar/numplateSelect
	 */
	@PostMapping("/numplateSelect")
	public ApiResponse<Object> selectNumplate(
	        @RequestBody Map<String, Object> param, HttpSession session) {
	
		// 세션 체크
 		UserDto user = AuthUtil.getLoginUser(session);
 		
 		return newcarService.selectNumplate(param, user);
	}
	
    /**
     * 번호판 미사용 처리 
     * POST /api/newcar/updateNumplateUseYn
     */
    @PostMapping("/updateNumplateUseYn")
    public ResponseEntity<Map<String, Object>> updateNumplateUseYn(
            @RequestBody Map<String, Object> param,
            HttpSession session) {

    	// 세션 체크
    	UserDto user = AuthUtil.getLoginUser(session);

    	// 번호판 미사용 처리
    	newcarService.updateNumplateUseYn(param, user);
    	
        return ResponseEntity.ok(ApiResponse.withKey("result", "OK"));
    }
	
	/**
	 * 문자 전송
	 * POST /api/newcar/numplateSms
	 */
	@PostMapping("/numplateSms")
	public ResponseEntity<Map<String, Object>> sendSms(
	        @RequestBody Map<String, Object> param,
	        HttpSession session) {
	
	    // 세션 체크
 		UserDto user = AuthUtil.getLoginUser(session);
	
	    int result = commonService.sendSms(param);
	
	    return ResponseEntity.ok(ApiResponse.withKey("result", result));
	}

	/**
	 * 신규등록 저장 및 신청
	 * POST /api/newcar/process
	 */
	@PostMapping("/process")
	public Map<String, Object> processNewCar(
	        @RequestBody Map<String, Object> request,
	        HttpSession session) {

		logger.info("[NewcarController] 신규등록 저장 및 신청 요청 - request: {}", request);
	    // 세션 체크
	    UserDto user = AuthUtil.getLoginUser(session);

	    return newcarService.processNewCar(request, user);
	}

	
}
