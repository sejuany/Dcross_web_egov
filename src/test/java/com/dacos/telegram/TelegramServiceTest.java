package com.dacos.telegram;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import com.dacos.code.CodeService;
import com.dacos.code.mapper.CodeMapper;
import com.dacos.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Spring 서버·DB·텔레그램에 연결하지 않는 채팅방 선택 검사. */
class TelegramServiceTest {
    @Test
    void resolvesCodeNameOnEachRequestAndRejectsInvalidChannels() {
        Map<String, Object> code = new HashMap<>(Map.of("CODE_ID", "momo", "CODE_NM", "-10001"));
        CodeMapper mapper = (CodeMapper) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[] { CodeMapper.class }, (proxy, method, args) -> {
                    assertEquals("findCodesByGroupId", method.getName());
                    assertEquals("TELEM", args[0]);
                    return List.of(code);
                });
        TelegramService service = new TelegramService("123:test-only", new CodeService(mapper));
        MockRestServiceServer server = MockRestServiceServer.bindTo(
                (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate")).build();
        for (String chatId : List.of("-10001", "-10002")) {
            server.expect(request -> assertEquals(Map.of("chat_id", chatId, "text", "test"),
                    new ObjectMapper().readValue(((MockClientHttpRequest) request).getBodyAsString(), Map.class)))
                    .andRespond(withSuccess("{\"ok\":true,\"result\":{\"message_id\":7}}", MediaType.APPLICATION_JSON));
        }
        assertEquals(7L, service.sendMessage("test", null, null, "momo"));
        code.put("CODE_NM", "-10002");
        assertEquals(7L, service.sendMessage("test", null, null, "momo"));

        assertThrows(BusinessException.class, () -> service.sendMessage("test", null, null, null));
        for (String channel : List.of("", " ", "newcarself", "absent")) {
            assertThrows(BusinessException.class, () -> service.sendMessage("test", null, null, channel));
        }
        for (String chatId : List.of("", " ")) {
            code.put("CODE_NM", chatId);
            assertThrows(BusinessException.class, () -> service.sendMessage("test", null, null, "momo"));
        }
        code.remove("CODE_NM");
        assertThrows(BusinessException.class, () -> service.sendMessage("test", null, null, "momo"));
        server.verify();
    }
}
