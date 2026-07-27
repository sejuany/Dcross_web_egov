package com.dacos.common;

import java.sql.SQLException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger =
            LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * 비즈니스 예외
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(
            BusinessException e) {

        logger.warn("[비즈니스 예외] {}", e.getMessage());

        return ResponseEntity
                .status(e.getStatusCode())
                .body(ApiResponse.fail(e.getMessage()));
    }

    /**
     * DB 관련 예외 공통 처리
     *
     * UncategorizedSQLException,
     * DataIntegrityViolationException,
     * DuplicateKeyException 등 DataAccessException 계열을 포괄적으로 처리
     */
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataAccessException(
            DataAccessException e) {

        // 상세 SQL과 스택 트레이스는 서버 로그에만 기록
        logger.error("[데이터베이스 처리 오류]", e);

        SQLException sqlException = findSQLException(e);

        String message = "데이터 처리 중 오류가 발생했습니다.";
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;

        if (sqlException != null) {
            int errorCode = sqlException.getErrorCode();

            switch (errorCode) {

                // ORA-12899: 컬럼 허용 길이 초과
                case 12899:
                    message = "입력값이 허용된 길이를 초과했습니다.";
                    status = HttpStatus.BAD_REQUEST;
                    break;

                // ORA-00001: UNIQUE 제약조건 위반
                case 1:
                    message = "이미 등록된 데이터가 존재합니다.";
                    status = HttpStatus.CONFLICT;
                    break;

                // ORA-01400: NOT NULL 컬럼에 NULL 입력
                case 1400:
                    message = "필수 입력값이 누락되었습니다.";
                    status = HttpStatus.BAD_REQUEST;
                    break;

                // ORA-02291: 부모 키 없음
                case 2291:
                    message = "연결된 기준 정보를 찾을 수 없습니다.";
                    status = HttpStatus.BAD_REQUEST;
                    break;

                // ORA-02292: 자식 데이터가 있어 삭제 불가
                case 2292:
                    message = "사용 중인 데이터가 있어 삭제할 수 없습니다.";
                    status = HttpStatus.CONFLICT;
                    break;

                // ORA-01722: 숫자가 아닌 값을 숫자 컬럼에 입력
                case 1722:
                    message = "숫자 입력값의 형식이 올바르지 않습니다.";
                    status = HttpStatus.BAD_REQUEST;
                    break;

                // ORA-01840, ORA-01841, ORA-01843, ORA-01861 등 날짜 오류
                case 1840:
                case 1841:
                case 1843:
                case 1861:
                    message = "날짜 입력값의 형식이 올바르지 않습니다.";
                    status = HttpStatus.BAD_REQUEST;
                    break;

                default:
                    // 사용자에게 Oracle 오류나 SQL을 노출하지 않음
                    message = "데이터 처리 중 오류가 발생했습니다.";
                    status = HttpStatus.INTERNAL_SERVER_ERROR;
                    break;
            }
        }

        return ResponseEntity
                .status(status)
                .body(ApiResponse.fail(message));
    }

    /**
     * 예외 체인 안에서 실제 SQLException 탐색
     */
    private SQLException findSQLException(Throwable throwable) {

        Throwable current = throwable;

        while (current != null) {
            if (current instanceof SQLException) {
                return (SQLException) current;
            }

            current = current.getCause();
        }

        return null;
    }

    /**
     * 정적 리소스 404
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFound(
            NoResourceFoundException e) {

        logger.debug("[404] 리소스 없음: {}", e.getResourcePath());

        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.fail(
                        "요청한 리소스를 찾을 수 없습니다."
                ));
    }

    /**
     * 그 외 예상하지 못한 서버 오류
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {

        logger.error("[서버 내부 오류]", e);

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.fail(
                        "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
                ));
    }
}