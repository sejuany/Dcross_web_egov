package com.dacos.attach;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import com.dacos.common.ApiResponse;

@RequestMapping("/api/attach")
public class AttachController {

    private static final Logger logger = LoggerFactory.getLogger(AttachController.class);

    private final AttachService attachService;

    public AttachController(AttachService attachService) {
        this.attachService = attachService;
    }

    /**
     * 사진 병합
     * POST /api/attach/merge-pdf
     */
    @PostMapping("/merge-pdf")
    public ResponseEntity<?> mergePdf(@RequestParam String serviceId) {

        attachService.mergePdf(serviceId);

        return ResponseEntity.ok(ApiResponse.withKey("result", true));
    }
}





