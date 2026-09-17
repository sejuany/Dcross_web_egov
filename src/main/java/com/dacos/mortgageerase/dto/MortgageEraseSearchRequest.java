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
    private String MEMBER_ID;
    private String MEMBER_IDS;
    private String PROC_ST;
    private String JUDGE_ST;
    private String CAR_NO;
    private String USER_NM;
    private String PAY_NM;
    private String MORT_NM;
    private String PAY_ST;
    private String GOVT_ID;
    private String AUTO_YN;
    private String READ_YN;
    private String IMPO_YN;
    private String ORDERBY;
    private String INCLUDE_CAR_INFO;
    private String CUSTOMER_NM;
    private String TIME_DVSN;
}
