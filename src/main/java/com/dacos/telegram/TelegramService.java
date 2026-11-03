package com.dacos.telegram;

import java.io.IOException;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import com.dacos.code.CodeService;
import com.dacos.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class TelegramService {

    private static final Logger logger = LoggerFactory.getLogger(TelegramService.class);

    private final String botToken;
    private final CodeService codeService;
    private final RestTemplate restTemplate;

    public TelegramService(@Value("${BOT_TOKEN:}") String botToken,
            CodeService codeService) {
        this.botToken = botToken;
        this.codeService = codeService;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(20_000);
        this.restTemplate = new RestTemplate(factory);
    }

    public long sendMessage(String message, String parseMode, String photo, String channel) {
        if (parseMode != null && !"HTML".equals(parseMode) && !"MarkdownV2".equals(parseMode)) {
            throw new BusinessException("parse_mode는 HTML 또는 MarkdownV2를 사용해 주세요.");
        }
        if (photo != null) {
            try {
                URI photoUri = URI.create(photo);
                if (photoUri.getHost() == null
                        || !("https".equalsIgnoreCase(photoUri.getScheme())
                                || "http".equalsIgnoreCase(photoUri.getScheme()))) {
                    throw new IllegalArgumentException();
                }
            } catch (IllegalArgumentException e) {
                throw new BusinessException("photo는 외부에서 접근 가능한 HTTP/HTTPS 이미지 URL이어야 합니다.");
            }
        }
        int maxLength = photo == null ? 4096 : 1024;
        // ponytail: 서식 태그도 요청 길이에 포함한다. 파싱 후 길이 허용이 필요하면 서식별 파서를 적용한다.
        if ((photo == null && (message == null || message.isBlank()))
                || (message != null && message.codePointCount(0, message.length()) > maxLength)) {
            throw new BusinessException("message 길이를 확인해 주세요. 텍스트는 1~4096자, 이미지 설명은 0~1024자입니다.");
        }
        String targetChatId = resolveChatId(channel);
        logger.info("[Telegram] 발송 설정 확인 - channel: {}, 토큰형식정상: {}, 채팅방설정있음: {}",
                channel, botToken.matches("[0-9]+:[A-Za-z0-9_-]+"), !targetChatId.isBlank());
        if (!botToken.matches("[0-9]+:[A-Za-z0-9_-]+") || targetChatId.isBlank()) {
            throw new BusinessException("텔레그램 BOT_TOKEN 또는 TM_CODE의 채팅방 ID 설정을 확인해 주세요.", 503);
        }

        try {
            Map<String, Object> body = new HashMap<>();
            body.put("chat_id", targetChatId);
            if (photo != null) {
                body.put("photo", photo);
            }
            if (message != null) {
                body.put(photo == null ? "text" : "caption", message);
            }
            if (parseMode != null) {
                body.put("parse_mode", parseMode);
            }
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            logger.info("[Telegram] 외부 API 호출 시작 - 유형: {}", photo == null ? "text" : "photo");
            JsonNode response = restTemplate.postForObject(
                    "https://api.telegram.org/bot" + botToken + (photo == null ? "/sendMessage" : "/sendPhoto"),
                    new HttpEntity<>(body, headers), JsonNode.class);
            if (response == null || !response.path("ok").asBoolean(false)
                    || !response.path("result").path("message_id").isIntegralNumber()) {
                throw new BusinessException("텔레그램 메시지 전송에 실패했습니다.", 502);
            }
            logger.info("[Telegram] 외부 API 전송 성공 - 메시지ID: {}", response.path("result").path("message_id").asLong());
            return response.path("result").path("message_id").asLong();
        } catch (RestClientResponseException e) {
            String reason = "OTHER";
            // 응답 본문에는 요청 값이 포함될 수 있어 알려진 오류의 고정 진단 코드만 기록한다.
            try {
                JsonNode error = new ObjectMapper().readTree(e.getResponseBodyAsByteArray());
                String description = error == null ? "" : error.path("description").asText("");
                if (error != null && error.path("parameters").has("migrate_to_chat_id")) {
                    reason = "CHAT_MIGRATED";
                } else if (description.contains("chat not found")) {
                    reason = "CHAT_NOT_FOUND";
                } else if (description.contains("not enough rights") || description.contains("CHAT_WRITE_FORBIDDEN")) {
                    reason = "CHAT_PERMISSION";
                } else if (description.contains("can't parse entities")) {
                    reason = "MESSAGE_FORMAT";
                }
            } catch (IOException ignored) {
                reason = "UNREADABLE_ERROR_BODY";
            }
            logger.warn("텔레그램 외부 API 전송 실패 - HTTP 상태: {}, 진단: {}", e.getStatusCode().value(), reason);
            throw new BusinessException("텔레그램 메시지 전송에 실패했습니다.", 502);
        } catch (RestClientException e) {
            // 통신 예외에는 BOT_TOKEN이 포함된 URL이 들어갈 수 있어 전달하거나 기록하지 않는다.
            logger.warn("텔레그램 외부 API 통신 실패 - 오류 유형: {}", e.getMostSpecificCause().getClass().getSimpleName());
            throw new BusinessException("텔레그램 메시지 전송에 실패했습니다.", 502);
        }
    }

    private String resolveChatId(String channel) {
        if (channel == null || channel.isBlank() || channel.length() > 6) {
            throw new BusinessException("channel은 TM_CODE의 TELEM 그룹 CODE_ID(1~6자)를 입력해 주세요.");
        }
        for (Map<String, Object> code : codeService.getCodesByGroupId("TELEM")) {
            if (channel.equals(code.get("CODE_ID"))) {
                Object chatId = code.get("CODE_NM");
                return chatId == null ? "" : chatId.toString();
            }
        }
        throw new BusinessException("TM_CODE의 TELEM 그룹에 등록되지 않았거나 사용 중이 아닌 channel입니다.");
    }
}
