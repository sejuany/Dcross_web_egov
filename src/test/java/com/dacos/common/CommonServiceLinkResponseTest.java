package com.dacos.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** 관청 연계 성공 JSON과 통신 오류 문자열의 응답 형식을 확인한다. */
public class CommonServiceLinkResponseTest {

    @Test
    void keepsDecryptedJsonAsObject() {
        CommonService service = new CommonService(null, null, new ObjectMapper());

        JsonNode success = service.createLinkResponse(
                "0", "{\"code\":\"0\",\"message\":\"처리성공\",\"RETURN_DATA\":[{}]}");
        JsonNode failure = service.createLinkResponse("-1", "연계 시스템 점검중");

        assertEquals("처리성공", success.path("returnMSG").path("message").asText());
        assertTrue(success.path("returnMSG").isObject());
        assertEquals("연계 시스템 점검중", failure.path("returnMSG").asText());
    }
}
