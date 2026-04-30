package com.dacos.auth.dto;

import lombok.Data;

/**
 * 사용자 정보 DTO (DB 조회 결과)
 */
@Data
public class UserDto {
    private String LOGIN_ID;
    private String PASS_WD;
    private String LOGIN_GB;
    private String REGIST_NO;
    private String MEMBER_NM;
    private String USE_YN;
    private String COMPANY_ID;
    private String BRANCH_ID;
    private String SANGSA_ID;
    private String MEMBER_GB;
}
