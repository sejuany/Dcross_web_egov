package com.dacos.customer;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.dacos.attach.AttachService;
import com.dacos.common.ApiResponse;
import com.dacos.newcar.NewcarService;

import jakarta.servlet.http.HttpSession;

/**
 * 고객 페이지 컨트롤러
 */
@RestController
@RequestMapping("/api/customer")
public class CustomerController {

    private static final Logger logger = LoggerFactory.getLogger(CustomerController.class);

    private final CustomerService customerService;
    private final AttachService attachService;
    private final NewcarService newcarService;

    public CustomerController(CustomerService customerService,
                              AttachService attachService,
                              NewcarService newcarService) {
        this.customerService = customerService;
        this.attachService = attachService;
        this.newcarService = newcarService;
    }

	@GetMapping("/numplate-selection")
	public ResponseEntity<Map<String, Object>> getNumplateSelection(@RequestParam("token") String token) {
		return ResponseEntity.ok(ApiResponse.withKey(
				"result", newcarService.getCustomerNumplateSelection(token)));
	}

	@PostMapping("/numplate-selection/confirm")
	public ResponseEntity<Map<String, Object>> confirmNumplateSelection(
			@RequestBody Map<String, Object> param) {
		return ResponseEntity.ok(ApiResponse.withKey(
				"result", newcarService.confirmCustomerNumplateSelection(param)));
	}

    /**
     * 토큰으로 고객 정보 조회
     * POST /api/customer/getToken
     */
    @PostMapping("/getToken")
    public ResponseEntity<?> getToken(@RequestBody Map<String, Object> param) {

        logger.info("[CustomerController] 고객 정보 조회");

        // 토큰으로 소유자 정보 조회
        Map<String, Object> info = customerService.getTokenInfo(param);
        // 토큰으로 공동소유자 정보 조회
        Map<String, Object> owner = customerService.getTokenOwnerInfo(param);
        // 서명 유무
        Map<String, Object> sign = customerService.getSignYn(info);
		
        Map<String, Object> result = new LinkedHashMap<>();
        
		result.put("success", true);
		result.put("info", info);
		result.put("owner", owner);
		result.put("sign", sign);

        return ResponseEntity.ok(
        	    ApiResponse.withKey("result", result));
    }

    /**
     * 고객 첨부파일 목록 조회
     * POST /api/customer/file/list
     */
    @GetMapping("/file/list")
    public ResponseEntity<Map<String, Object>> getFileSearch(
            @RequestParam("serviceId") String serviceId,
            @RequestParam("token") String token,
            HttpSession session) {

        logger.info("[CustomerController] 고객 첨부파일 조회 - serviceId={}", serviceId);


        List<Map<String, Object>> list =
                attachService.getAttachFiles(serviceId, token, null);

        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 고객 첨부파일 업로드
     * POST /api/customer/file/upload
     */
    @PostMapping("/file/upload")
    public ResponseEntity<Map<String, Object>> fileUpload(
            @RequestParam("serviceId") String serviceId,
            @RequestParam("code") String code,
            @RequestParam("docName") String docName,
            @RequestParam("gubun") String gubun,
            @RequestParam(value = "duplicateMinor", defaultValue = "N") String duplicateMinor,
            @RequestParam("file") MultipartFile file,
            @RequestParam("token") String token,
            HttpSession session) {

        logger.info("[CustomerController] 고객 첨부파일 업로드 - serviceId={}, code={}, gubun={}",
                serviceId, code, gubun);

        List<Map<String, Object>> list =
                attachService.uploadAttachFile(
                        serviceId,
                        code,
                        gubun,
                        duplicateMinor,
                        docName,
                        file,
                        null,
                        token
                );

        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 고객 첨부파일 보기(썸네일용)
     */
    @GetMapping("/file/view")
    public ResponseEntity<Resource> viewFile(
            @RequestParam("token") String token,
            @RequestParam("fileName") String fileName)
            throws Exception {

        return attachService.viewWaAttachFile(
                null,
                token,
                fileName,
                null
        );
    }
}
