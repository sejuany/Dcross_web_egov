package com.dacos.company.dto;

import lombok.Data;

/**
 * 기업관리 항목 DTO
 * - Company: 기업관리(CompanyManageV4), 사용자관리(CompanyUserManage),
 *   탈부착업체관리(NumplateDeliveryManage), 회원사관리(CompanyNew)
 */
@Data
public class CompanyDto {
    private String COMPANY_ID;
    private String COMPANY_NM;
    private String COMPANY_TYPE;
    private String CEO_NM;
    private String TEL_NO;
    private String ADDRESS;
    private String USE_YN;
    private String REG_DT;
    private String BRANCH_ID;
}
