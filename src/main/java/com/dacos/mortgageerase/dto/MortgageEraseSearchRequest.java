package com.dacos.mortgageerase.dto;

import lombok.Data;

/**
 * 저당말소 검색 요청 DTO
 */
@Data
public class MortgageEraseSearchRequest {
    private String START_DT;
    private String END_DT;
    private String WORK_CD;
    private String COMPANY_ID;
    private String BRANCH_ID;
    private String SANGSA_ID;
    private String PROC_ST;
    private String CAR_NO;
    private String PAY_ST;
    private String GOVT_ID;
    private String CUSTOMER_NM;
    private String TIME_DVSN;
}
