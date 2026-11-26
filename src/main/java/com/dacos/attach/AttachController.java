package com.dacos.attach;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.common.ApiResponse;
import com.dacos.common.ServiceAccessGuard;
import com.dacos.common.ServiceAccessGuard.ServiceAction;
import com.dacos.common.util.AuthUtil;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/attach")
public class AttachController {

    private static final Logger logger = LoggerFactory.getLogger(AttachController.class);

    private final AttachService attachService;
    private final ServiceAccessGuard serviceAccessGuard;

    public AttachController(AttachService attachService, ServiceAccessGuard serviceAccessGuard) {
        this.attachService = attachService;
        this.serviceAccessGuard = serviceAccessGuard;
    }

    /**
     * PDF 생성 및 사진 병합
     * POST /api/attach/merge-pdf
     */
    @PostMapping("/merge-pdf")
    public ResponseEntity<?> mergePdf(@RequestBody Map<String, Object> param, HttpSession session) {

        String serviceId = (String) param.get("SERVICE_ID");
        serviceAccessGuard.requireAccess(AuthUtil.getLoginUser(session), serviceId, ServiceAction.WRITE_ATTACHMENT);

        Map<String, Object> exemption =
                (Map<String, Object>) param.get("EXEMPTION");
        
        attachService.mergePdf(serviceId, exemption);

        return ResponseEntity.ok(ApiResponse.withKey("result", true));
    }
    
    /**
     * 사진 병합
     * POST /api/attach/minor-merge-pdf
     */
    @PostMapping("/minor-merge-pdf")
    public ResponseEntity<?> minorMergePdf(@RequestBody Map<String, Object> param, HttpSession session) {

        String serviceId = (String) param.get("SERVICE_ID");
        serviceAccessGuard.requireAccess(AuthUtil.getLoginUser(session), serviceId, ServiceAction.WRITE_ATTACHMENT);

        attachService.mergeMinorPdf(serviceId);

        return ResponseEntity.ok(ApiResponse.withKey("result", true));
    }
	
    /**
     * 첨부파일 양식 다운로드
     * POST /api/attach/form
     */
    @PostMapping("/form")
    public ResponseEntity<Resource> downloadForm(
            @RequestBody Map<String, Object> param) {

        Resource resource = attachService.getFormFile(param);
        
        return ResponseEntity.ok().body(resource);

    }
}





