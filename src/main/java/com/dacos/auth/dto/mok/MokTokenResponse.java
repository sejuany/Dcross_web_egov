package com.dacos.auth.dto.mok;

import lombok.Data;

/**
 * MOK 본인인증 토큰 요청 응답 DTO
 */
@Data
public class MokTokenResponse {
    private String result;     // 결과 코드 (0000: 성공)
    private String message;    // 결과 메시지
    private String token;      // 거래 토큰
    private String publicKey;  // MOK 서버 공개키 (암호화용)
}
