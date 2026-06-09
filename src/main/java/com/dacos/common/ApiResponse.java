package com.dacos.common;

import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final boolean success;
    private final T data;
    private final String message;

    private ApiResponse(boolean success, T data, String message) {
        this.success = success;
        this.data = data;
        this.message = message;
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null);
    }

    public static <T> ApiResponse<T> ok() {
        return new ApiResponse<>(true, null, null);
    }

    public static <T> ApiResponse<T> fail(String message) {
        return new ApiResponse<>(false, null, message);
    }

    /**
     * 프론트엔드 기존 응답 형식 호환을 위한 헬퍼 메서드
     * 예: ApiResponse.withKey("list", listData) → { "success": true, "list": [...] }
     */
    public static Map<String, Object> withKey(String key, Object value) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put(key, value);
        return result;
    }
}
