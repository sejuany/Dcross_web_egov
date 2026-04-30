package com.dacos.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 모든 컨트롤러의 예외를 중앙에서 처리하는 글로벌 핸들러
 * 각 컨트롤러에서 try-catch를 없애고 여기서 일괄 처리합니다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * 비즈니스 예외 처리 (인증 실패, 데이터 없음 등)
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        logger.warn("[비즈니스 예외] {}", e.getMessage());
        return ResponseEntity
                .status(e.getStatusCode())
                .body(ApiResponse.fail(e.getMessage()));
    }

    /**
     * 정적 리소스를 찾지 못한 경우 (404)
     * - Chrome DevTools 자동 요청 등 무해한 404 포함
     * - WARN 레벨로 조용히 처리 (스택트레이스 없음)
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFound(NoResourceFoundException e) {
        logger.debug("[404] 리소스 없음: {}", e.getResourcePath());
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.fail("요청한 리소스를 찾을 수 없습니다."));
    }

    /**
     * 그 외 예상치 못한 서버 에러 처리
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        logger.error("[서버 내부 오류]", e);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.fail("내부 서버 오류가 발생했습니다: " + e.getMessage()));
    }
}
