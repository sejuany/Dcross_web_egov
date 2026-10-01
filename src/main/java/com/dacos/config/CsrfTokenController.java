package com.dacos.config;

import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpSession;

/** 로그인한 React 화면에 세션 전용 CSRF 토큰을 발급한다. */
@RestController
@RequestMapping("/api")
public class CsrfTokenController {

    private final CsrfTokenService csrfTokenService;

    public CsrfTokenController(CsrfTokenService csrfTokenService) {
        this.csrfTokenService = csrfTokenService;
    }

    @GetMapping("/csrf-token")
    public ResponseEntity<Map<String, Object>> token(HttpSession session) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(Map.of(
                        "success", true,
                        "token", csrfTokenService.getOrCreate(session)));
    }
}
