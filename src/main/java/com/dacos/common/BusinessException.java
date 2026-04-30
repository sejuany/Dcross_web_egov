package com.dacos.common;

import lombok.Getter;

/**
 * 비즈니스 로직에서 발생하는 예외를 표현하는 커스텀 예외
 * HTTP 상태코드와 메시지를 함께 가집니다.
 */
@Getter
public class BusinessException extends RuntimeException {

    private final int statusCode;

    public BusinessException(String message) {
        super(message);
        this.statusCode = 400;
    }

    public BusinessException(String message, int statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}
