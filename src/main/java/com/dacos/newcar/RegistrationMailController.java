package com.dacos.newcar;

import java.util.Map;
import java.util.concurrent.RejectedExecutionException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RegistrationMailController {
    private static final Logger log = LoggerFactory.getLogger(RegistrationMailController.class);
    private final RegistrationMailService mailService;

    public RegistrationMailController(RegistrationMailService mailService) {
        this.mailService = mailService;
    }

    @PostMapping("/api/internal/registration-mail/{serviceId}")
    public ResponseEntity<Map<String, String>> accept(@PathVariable("serviceId") String serviceId) {
        if (!serviceId.matches("[A-Za-z0-9-]{1,50}")) {
            return failure(serviceId, 400, "SERVICE_ID_형식오류");
        }
        try {
            mailService.submit(serviceId);
            // 202는 발송 완료가 아니라 작업 접수 완료이다.
            return ResponseEntity.accepted().body(Map.of("result", "ACCEPTED"));
        } catch (RejectedExecutionException e) {
            return failure(serviceId, 503, "메일_작업대기열_접수불가");
        }
    }

    private ResponseEntity<Map<String, String>> failure(String serviceId, int status, String reason) {
        log.warn("[등록메일실패] SERVICE_ID={} 단계=접수 원인={}",
                serviceId.replaceAll("[^A-Za-z0-9-]", "_"), reason);
        return ResponseEntity.status(status).body(Map.of("reason", reason));
    }
}
