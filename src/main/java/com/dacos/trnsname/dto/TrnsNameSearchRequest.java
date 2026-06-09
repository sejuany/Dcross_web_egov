package com.dacos.trnsname.dto;

import lombok.Data;

/**
 * 이전등록 검색 요청 DTO
 */
@Data
public class TrnsNameSearchRequest {
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
    private String DELIVERY_GB;
    private String NUM_PROC_ST;
}
