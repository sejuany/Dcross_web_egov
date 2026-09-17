package com.dacos.telegram;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import com.dacos.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;

class TelegramServiceTest {

    private final TelegramService service = new TelegramService(
            "123456:test_token", "-100123456", "-100999999", "-100888888", null, null);
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(
            (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate")).build();

    @Test
    void sendsJsonAndReturnsMessageId() {
        server.expect(request -> {
                    assertEquals("https://api.telegram.org/bot123456:test_token/sendMessage", request.getURI().toString());
                    assertEquals(HttpMethod.POST, request.getMethod());
                    assertEquals(MediaType.APPLICATION_JSON, request.getHeaders().getContentType());
                    assertEquals(Map.of("chat_id", "-100123456", "text", "안녕하세요\n테스트 & +"),
                            new ObjectMapper().readValue(((MockClientHttpRequest) request).getBodyAsString(), Map.class));
                })
                .andRespond(withSuccess("{\"ok\":true,\"result\":{\"message_id\":42}}", MediaType.APPLICATION_JSON));

        assertEquals(Map.of("success", true, "messageId", 42L),
                new TelegramController(service, "test_api_key").sendMessage(
                        Map.of("message", "안녕하세요\n테스트 & +"), "test_api_key").getBody());
        server.verify();
    }

    @Test
    void rejectsInvalidInputAndMissingConfigurationWithoutSending() {
        assertEquals(401, assertThrows(BusinessException.class,
                () -> new TelegramController(service, "test_api_key").sendMessage(
                        Map.of("message", "테스트"), null)).getStatusCode());
        assertEquals(401, assertThrows(BusinessException.class,
                () -> new TelegramController(service, "test_api_key").sendMessage(
                        Map.of("message", "테스트"), "wrong_key")).getStatusCode());
        assertEquals(401, assertThrows(BusinessException.class,
                () -> new TelegramController(service, "").sendMessage(
                        Map.of("message", "테스트"), "test_api_key")).getStatusCode());
        assertEquals(400, assertThrows(BusinessException.class,
                () -> new TelegramController(service, "test_api_key").sendMessage(
                        Map.of("message", 123), "test_api_key")).getStatusCode());
        for (String message : new String[] { "", " \n", "가".repeat(4097) }) {
            assertEquals(400, assertThrows(BusinessException.class,
                    () -> service.sendMessage(message, null, null, null)).getStatusCode());
        }
        assertEquals(503, assertThrows(BusinessException.class,
                () -> new TelegramService("", "", "", "", null, null)
                        .sendMessage("테스트", null, null, null)).getStatusCode());
        server.verify();
    }

    @Test
    void hidesHttpErrorsAndRejectsUnsuccessfulResponses() {
        server.expect(request -> assertEquals(HttpMethod.POST, request.getMethod()))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED).body("private upstream details"));
        server.expect(request -> assertEquals(HttpMethod.POST, request.getMethod()))
                .andRespond(withSuccess("{\"ok\":false}", MediaType.APPLICATION_JSON));

        for (int i = 0; i < 2; i++) {
            BusinessException error = assertThrows(BusinessException.class,
                    () -> service.sendMessage("테스트", null, null, null));
            assertEquals(502, error.getStatusCode());
            assertFalse(error.getMessage().contains("test_token"));
            assertFalse(error.getMessage().contains("private upstream details"));
        }
        server.verify();
    }

    @Test
    void forwardsHtmlAndMarkdownFormatting() {
        for (String mode : new String[] { "HTML", "MarkdownV2" }) {
            String message = "HTML".equals(mode) ? "<b>접수 완료</b>" : "*접수 완료*";
            server.expect(request -> {
                        assertEquals("https://api.telegram.org/bot123456:test_token/sendMessage", request.getURI().toString());
                        assertEquals(Map.of("chat_id", "-100123456", "text", message, "parse_mode", mode),
                                new ObjectMapper().readValue(((MockClientHttpRequest) request).getBodyAsString(), Map.class));
                    })
                    .andRespond(withSuccess("{\"ok\":true,\"result\":{\"message_id\":43}}", MediaType.APPLICATION_JSON));
        }
        TelegramController controller = new TelegramController(service, "test_api_key");
        assertEquals(43L, controller.sendMessage(
                Map.of("message", "<b>접수 완료</b>", "parse_mode", "HTML"), "test_api_key").getBody().get("messageId"));
        assertEquals(43L, controller.sendMessage(
                Map.of("message", "*접수 완료*", "parse_mode", "MarkdownV2"), "test_api_key").getBody().get("messageId"));
        server.verify();
    }

    @Test
    void sendsPhotoWithOptionalFormattedCaption() {
        String photo = "https://example.com/car.jpg";
        server.expect(request -> {
                    assertEquals("https://api.telegram.org/bot123456:test_token/sendPhoto", request.getURI().toString());
                    assertEquals(Map.of("chat_id", "-100123456", "photo", photo,
                            "caption", "<b>차량 사진</b>", "parse_mode", "HTML"),
                            new ObjectMapper().readValue(((MockClientHttpRequest) request).getBodyAsString(), Map.class));
                })
                .andRespond(withSuccess("{\"ok\":true,\"result\":{\"message_id\":44}}", MediaType.APPLICATION_JSON));
        server.expect(request -> assertEquals(Map.of("chat_id", "-100123456", "photo", photo),
                        new ObjectMapper().readValue(((MockClientHttpRequest) request).getBodyAsString(), Map.class)))
                .andRespond(withSuccess("{\"ok\":true,\"result\":{\"message_id\":45}}", MediaType.APPLICATION_JSON));
        TelegramController controller = new TelegramController(service, "test_api_key");
        assertEquals(44L, controller.sendMessage(Map.of("message", "<b>차량 사진</b>",
                "parse_mode", "HTML", "photo", photo), "test_api_key").getBody().get("messageId"));
        assertEquals(45L, controller.sendMessage(Map.of("photo", photo), "test_api_key").getBody().get("messageId"));
        server.verify();
    }

    @Test
    void rejectsInvalidOptionsWithoutSending() {
        assertEquals(400, assertThrows(BusinessException.class,
                () -> service.sendMessage("테스트", "invalid", null, null)).getStatusCode());
        for (String photo : new String[] { "", "file:///C:/car.jpg", "https://", "not a url" }) {
            assertEquals(400, assertThrows(BusinessException.class,
                    () -> service.sendMessage("테스트", null, photo, null)).getStatusCode());
        }
        assertEquals(400, assertThrows(BusinessException.class,
                () -> service.sendMessage(
                        "가".repeat(1025), null, "https://example.com/car.jpg", null)).getStatusCode());
        assertEquals(400, assertThrows(BusinessException.class,
                () -> new TelegramController(service, "test_api_key").sendMessage(
                        Map.of("message", "테스트", "photo", 123), "test_api_key")).getStatusCode());
        server.verify();
    }

    @Test
    void routesNewcarMessagesToNewcarChat() {
        server.expect(request -> assertEquals(Map.of(
                        "chat_id", "-100999999", "text", "신규등록 완료"),
                        new ObjectMapper().readValue(
                                ((MockClientHttpRequest) request).getBodyAsString(), Map.class)))
                .andRespond(withSuccess(
                        "{\"ok\":true,\"result\":{\"message_id\":46}}", MediaType.APPLICATION_JSON));

        TelegramController controller = new TelegramController(service, "test_api_key");
        assertEquals(46L, controller.sendMessage(Map.of(
                "channel", "newcar", "message", "신규등록 완료"),
                "test_api_key").getBody().get("messageId"));
        server.verify();
    }

    @Test
    void rejectsUnknownOrUnconfiguredChannelWithoutSending() {
        assertEquals(400, assertThrows(BusinessException.class,
                () -> service.sendMessage("테스트", null, null, "Unknown")).getStatusCode());
        assertEquals(503, assertThrows(BusinessException.class,
                () -> new TelegramService("123456:test_token", "-100123456", "", "", null, null)
                        .sendMessage("테스트", null, null, "newcar")).getStatusCode());
        server.verify();
    }
}
