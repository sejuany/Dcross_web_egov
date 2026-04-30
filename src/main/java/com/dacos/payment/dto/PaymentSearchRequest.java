package com.dacos.payment.dto;

import lombok.Data;

/**
 * 납부관리 검색 요청 DTO
 */
@Data
public class PaymentSearchRequest {
    private String START_DT;
    private String END_DT;
    private String COMPANY_ID;
    private String BRANCH_ID;
    private String PAY_ST;
    private String WORK_CD;
    private String TASK_CD;
    private String CAR_NO;
    private String USER_NM;
    private String GOVT_ID;    
    private String PAY_TP;
    private String LOCAL_ID;
    private String BASE_GUBUN;
    private String PROC_ST;
}
