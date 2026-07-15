package com.dacos.customer;

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

    public CustomerController(CustomerService customerService,
                              AttachService attachService) {
        this.customerService = customerService;
        this.attachService = attachService; 
    }

    /**
     * 토큰으로 고객 정보 조회
     */
    @PostMapping("/getToken")
    public ResponseEntity<?> getToken(@RequestBody Map<String, Object> param) {

        logger.info("[CustomerController] 고객 정보 조회");

        Map<String, Object> info = customerService.getTokenInfo(param);

        return ResponseEntity.ok(ApiResponse.withKey("info", info));
    }

    /**
     * 고객 첨부파일 목록 조회
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
     */
    @PostMapping("/file/upload")
    public ResponseEntity<Map<String, Object>> fileUpload(
            @RequestParam("serviceId") String serviceId,
            @RequestParam("code") String code,
            @RequestParam("gubun") String gubun,
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