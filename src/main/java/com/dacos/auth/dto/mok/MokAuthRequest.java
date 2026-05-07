package com.dacos.auth.dto.mok;

import lombok.Data;

/**
 * 휴대폰 본인확인 인증번호 발송 요청 DTO
 */
@Data
public class MokAuthRequest {
    private String userName;   // 이름
    private String birthDate;  // 생년월일 (8자리)
    private String gender;     // 성별 (0: 여성, 1: 남성)
    private String ntvFrnr;    // 내외국인 (L: 내국인, F: 외국인)
    private String carrier;    // 통신사 (SKT, KT, LGU, SKM, KTM, LGM)
    private String phoneNum;   // 휴대폰번호
}
