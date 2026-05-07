package com.dacos.auth.dto.mok;

import lombok.Data;

/**
 * 인증번호 검증 요청 DTO
 */
@Data
public class MokConfirmRequest {
    private String token;      // 거래 토큰
    private String authNum;    // 사용자가 입력한 인증번호 (6자리)
}
