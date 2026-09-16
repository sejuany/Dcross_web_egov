package com.dacos.telegram;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.common.ApiResponse;
import com.dacos.common.BusinessException;

@RestController
@RequestMapping("/api/telegram")
public class TelegramController {

    private final TelegramService telegramService;
    private final String apiKey;

    public TelegramController(TelegramService telegramService,
            @Value("${TELEGRAM_API_KEY:}") String apiKey) {
        this.telegramService = telegramService;
        this.apiKey = apiKey;
    }

    @PostMapping("/send")
    public ResponseEntity<Map<String, Object>> sendMessage(
            @RequestBody Map<String, Object> request,
            @RequestHeader(value = "X-Telegram-Api-Key", required = false) String suppliedKey) {
        if (apiKey.isBlank() || suppliedKey == null || !MessageDigest.isEqual(
                apiKey.getBytes(StandardCharsets.UTF_8), suppliedKey.getBytes(StandardCharsets.UTF_8))) {
            throw new BusinessException("텔레그램 API 인증에 실패했습니다.", 401);
        }
        for (String field : new String[] { "message", "parse_mode", "photo", "channel" }) {
            if (request.get(field) != null && !(request.get(field) instanceof String)) {
                throw new BusinessException(field + "는 텍스트로 입력해 주세요.");
            }
        }
        long messageId = telegramService.sendMessage((String) request.get("message"),
                (String) request.get("parse_mode"), (String) request.get("photo"),
                (String) request.get("channel"));
        return ResponseEntity.ok(ApiResponse.withKey("messageId", messageId));
    }
}
