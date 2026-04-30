package com.dacos.company.dto;

import lombok.Data;

/**
 * 기업관리 검색 요청 DTO
 */
@Data
public class CompanySearchRequest {
    private String COMPANY_ID;
    private String COMPANY_NM;
    private String COMPANY_TYPE;
    private String USE_YN;
    private String MEMBER_ID;
}
