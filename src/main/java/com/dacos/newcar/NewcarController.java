package com.dacos.newcar;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.dacos.attach.AttachService;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.ApiResponse;
import com.dacos.common.BusinessException;
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

    private final NewcarService newcarService;
    private final CommonService commonService;
    private final NewcarPdfExtractService newcarPdfExtractService;
    private final AttachService attachService;

    public NewcarController(NewcarService newcarService, CommonService commonService, NewcarPdfExtractService newcarPdfExtractService, AttachService attachService) {
        this.newcarService = newcarService;
        this.commonService = commonService;
        this.newcarPdfExtractService = newcarPdfExtractService;
        this.attachService = attachService;
    }
    
    /**
     * 신차 목록 조회
     * POST /api/newcar/list
     */
    @PostMapping("/list")
    public ResponseEntity<Map<String, Object>> getNewCarList(@RequestBody NewcarSearchRequest request, HttpSession session) {
        logger.info("[NewcarController] 신차 목록 조회 요청");
        UserDto user = AuthUtil.getLoginUser(session);
        List<Map<String, Object>> list = newcarService.getNewCarList(request, user);
        // 프론트엔드 호환: { "success": true, "list": [...] }
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * WA 전용 신규신청현황 목록 조회
     * POST /api/newcar/wa-list
     */
    @PostMapping("/wa-list")
    public ResponseEntity<Map<String, Object>> getWaNewCarList(@RequestBody NewcarSearchRequest request, HttpSession session) {
        logger.info("[NewcarController] WA 신규신청현황 조회 요청");
        UserDto user = AuthUtil.getLoginUser(session);
        List<Map<String, Object>> list = newcarService.getWaNewCarList(request, user);
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
        List<String> serviceIds = toStringList(request.get("SERVICE_IDS"), "SERVICE_IDS");
        String procSt = String.valueOf(request.getOrDefault("PROC_ST", "")).trim();
        int result = newcarService.changeProcSt(serviceIds, procSt);
        return ResponseEntity.ok(ApiResponse.withKey("result", result));
    }
    
    /**
     * 엑셀 업로드
     * POST /api/newcar/excel-upload
     */
    @PostMapping("/excel-upload")
    public ResponseEntity<Map<String, Object>> uploadExcel(@RequestParam("file") MultipartFile file, HttpSession session) {
        try {
            UserDto user = AuthUtil.getLoginUser(session);
            Map<String, Object> result = newcarService.uploadExcel(file, user);
            return ResponseEntity.ok(ApiResponse.withKey("data", result));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", e.getMessage()
            ));
        }
    }

    @PostMapping("/pdf-extract")
    public ResponseEntity<Map<String, Object>> extractPdf(@RequestParam("file") MultipartFile file, HttpSession session) {
        try {
            UserDto user = AuthUtil.getLoginUser(session);
            validatePdfUploadCompany(user);
            Map<String, Object> result = newcarPdfExtractService.extractProductionCertificate(file);
            return ResponseEntity.ok(ApiResponse.withKey("data", result));
        } catch (Exception e) {
            logger.error("[NewcarController] PDF 제작증 추출 실패", e);
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", e.getMessage()
            ));
        }
    }

    @PostMapping("/pdf-upload")
    public ResponseEntity<Map<String, Object>> uploadPdf(
            @RequestParam("files") MultipartFile[] files,
            @RequestParam(value = "registrationType", defaultValue = "PERSONAL") String registrationType,
            HttpSession session) {
        try {
            UserDto user = AuthUtil.getLoginUser(session);
            validatePdfUploadCompany(user);
            List<Map<String, Object>> extractedRows = newcarPdfExtractService.extractAndSaveProductionCertificates(files, user);
            Map<String, Object> result = newcarService.uploadPdf(extractedRows, user, registrationType);
            return ResponseEntity.ok(ApiResponse.withKey("data", result));
        } catch (Exception e) {
            logger.error("[NewcarController] PDF 제작증 업로드 신청 실패", e);
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", e.getMessage()
            ));
        }
    }
    
    /**
     * 차량비용 납부
     * POST /api/newcar/payment-process
     */
    @PostMapping("/payment-process")
    public ResponseEntity<Map<String, Object>> paymentProcess(
            @RequestBody List<Map<String, Object>> request,
            HttpSession session) {

        UserDto user = AuthUtil.getLoginUser(session);

        int result = newcarService.paymentProcess(request, user);

        return ResponseEntity.ok(
                ApiResponse.withKey("result", result)
        );
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
     * 로그인 회사별 Maker와 차명 기준 차량제원 조회
     * GET /api/newcar/car-spec?carName=...
     */
    @GetMapping("/car-spec")
    public ResponseEntity<Map<String, Object>> getCarSpec(
            @RequestParam("carName") String carName,
            HttpSession session) {

        // 로그인 회사코드로 조회 Maker를 결정해 다른 회사 Maker를 임의 조회하지 못하게 처리함.
        UserDto user = AuthUtil.getLoginUser(session);
        Map<String, Object> carSpec = newcarService.getCarSpec(user.getCOMPANY_ID(), carName);
        return ResponseEntity.ok(ApiResponse.withKey("data", carSpec));
    }

    /**
     * 사용본거지와 지역별 차량구분/비교값 기준 공채 매입률 조회함.
     * GET /api/newcar/bond-rate?baseAddress=...&carGb=...&baseValue=...
     */
    @GetMapping("/bond-rate")
    public ResponseEntity<Map<String, Object>> getBondRate(
            @RequestParam("baseAddress") String baseAddress,
            @RequestParam(value = "carGb", defaultValue = "e") String carGb,
            @RequestParam(value = "baseValue", defaultValue = "0") double baseValue,
            HttpSession session) {

        // 로그인 세션 확인 후 TM_BOND의 현재 사용 가능한 매입률만 가져옴.
        AuthUtil.getLoginUser(session);
        Map<String, Object> bondRate = newcarService.getNewcarBondRate(baseAddress, carGb, baseValue);
        return ResponseEntity.ok(ApiResponse.withKey("data", bondRate));
    }
    /**
     * 신규등록 WORK_CD=010 기준 현재 세율정보 조회함.
     * GET /api/newcar/tax-info
     */
    @GetMapping("/tax-info")
    public ResponseEntity<Map<String, Object>> getTaxInfo(HttpSession session) {
        AuthUtil.getLoginUser(session);
        Map<String, Object> taxInfo = newcarService.getNewcarTaxInfo();
        return ResponseEntity.ok(ApiResponse.withKey("data", taxInfo));
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
 		AuthUtil.getLoginUser(session);
	
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
	
	/**
	 * 신규현황 다건 신청
	 * POST /api/newcar/request-process
	 */
	@PostMapping("/request-process")
	public ResponseEntity<Map<String, Object>> requestProcess(
	        @RequestBody List<Map<String, Object>> request,
	        HttpSession session) {

	    UserDto user = AuthUtil.getLoginUser(session);

	    newcarService.requestProcess(request, user);

	    return ResponseEntity.ok(ApiResponse.withKey("result", "OK"));
	}
	
	/**
	 * 채권 및 영수증 조회
	 * GET /api/newcar/bond-info/{serviceId}
	 */
	@GetMapping("/bond-info/{serviceId}")
	public ResponseEntity<Map<String, Object>> selectBondInfo(
	        @PathVariable("serviceId") String serviceId) {

	    return ResponseEntity.ok(
	            newcarService.selectBondInfo(serviceId)
	    );
	}

    private void validatePdfUploadCompany(UserDto user) {
        String companyId = Objects.toString(user.getCOMPANY_ID(), "").trim().toUpperCase();
        if (!companyId.contains("WB")) {
            throw new BusinessException("제작증 업로드는 WB 기업만 사용할 수 있습니다.", 403);
        }
    }
    private List<String> toStringList(Object value, String fieldName) {
        if (!(value instanceof List<?>)) {
            throw new BusinessException(fieldName + " 값이 올바르지 않습니다.", 400);
        }

        List<?> rawList = (List<?>) value;
        List<String> result = new ArrayList<>();
        for (Object item : rawList) {
            if (item == null || String.valueOf(item).isBlank()) {
                throw new BusinessException(fieldName + "에 빈 값이 포함되어 있습니다.", 400);
            }
            result.add(String.valueOf(item).trim());
        }

        if (result.isEmpty()) {
            throw new BusinessException(fieldName + " 값이 없습니다.", 400);
        }

        return result;
    }
    
	/**
	 *  첨부파일 목록 조회
	 * GET /api/newcar/wa-attach-files?serviceId=...
	 */
	@GetMapping("/wa-attach-files")
	public ResponseEntity<Map<String, Object>> getWaNewcarAttachFiles(
	        @RequestParam("serviceId") String serviceId,
	        HttpSession session) {
	
	    logger.info("[NewcarController] WA 신규등록 첨부파일 조회 - serviceId: {}", serviceId);
	
	    UserDto user = AuthUtil.getLoginUser(session);
	
	    List<Map<String, Object>> list =
	    		attachService.getAttachFiles(serviceId, null, user);
	
	    return ResponseEntity.ok(ApiResponse.withKey("list", list));
	}
	
	
    /**
     * WA 신규등록 첨부파일 업로드
     * POST /api/newcar/wa-attach-upload
     */
    @PostMapping("/wa-attach-upload")
    public ResponseEntity<Map<String, Object>> uploadWaNewcarAttachFile(
            @RequestParam("serviceId") String serviceId,
            @RequestParam("code") String code,
            @RequestParam("gubun") String gubun,
            @RequestParam("file") MultipartFile file,
            HttpSession session
    ) {
    	
    	logger.info("[NewcarController] WA 신규등록 첨부파일 업로드 - serviceId: {}, code: {}, gubun: {}", serviceId, code, gubun);

        UserDto user = AuthUtil.getLoginUser(session);

        List<Map<String, Object>> list 
        	= attachService.uploadAttachFile(serviceId, code, gubun, file, user, null);

        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
	
	
    /**
     * WA 신규등록 첨부파일 보기(실제 사진 불러오는 용도)
     * GET /api/newcar/wa-attach-view?fileName=...
     */
    @GetMapping("/wa-attach-view")
    public ResponseEntity<Resource> viewAttachFile(
            @RequestParam("fileName") String fileName,
            HttpSession session
    ) throws Exception {

        // 로그인 체크
        AuthUtil.getLoginUser(session);

        String cleanFileName = String.valueOf(fileName).trim();

        if (cleanFileName.contains("..")
                || cleanFileName.contains("/")
                || cleanFileName.contains("\\")) {
            throw new BusinessException("잘못된 파일명입니다.", 400);
        }

        Path filePath = attachService.getAttachFilePath(cleanFileName);

        if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
            throw new BusinessException("첨부파일을 찾을 수 없습니다.", 404);
        }

        Resource resource = new UrlResource(filePath.toUri());

        String contentType = Files.probeContentType(filePath);

        if (contentType == null || contentType.isBlank()) {
            contentType = "application/octet-stream";
        }

        String encodedFileName = URLEncoder
                .encode(cleanFileName, StandardCharsets.UTF_8)
                .replace("+", "%20");

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename*=UTF-8''" + encodedFileName)
                .body(resource);
    }
    
    @GetMapping("/carpaper/download")
    public ResponseEntity<Resource> download(
    		@RequestParam("date") String date,
    	    @RequestParam("carNo") String carNo) throws IOException {
    	
    	String serverIp = attachService.getServerAddress("IP");
    	
    	String sPath = "D:/pdf/Carpaper";
    	
		if ("10.109.111.40".equals(serverIp)) {
			sPath = "/web/updownfiles/pdf/Carpaper";
		}
		
        Path path = Paths.get(
        		sPath,
                date,
                carNo + ".pdf"
        );
        
        if (!Files.exists(path)) {
            return ResponseEntity.notFound().build();
        }

        Resource resource = new UrlResource(path.toUri());

        return ResponseEntity.ok()
                .header(
                    HttpHeaders.CONTENT_DISPOSITION,
                    ContentDisposition.attachment()
                            .filename(carNo + ".pdf", StandardCharsets.UTF_8)
                            .build()
                            .toString()
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(resource);
    }
}


