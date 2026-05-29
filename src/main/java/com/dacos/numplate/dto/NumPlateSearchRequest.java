package com.dacos.numplate.dto;

import lombok.Data;

/**
 * 번호판관리 검색 요청 DTO
 */
@Data
public class NumPlateSearchRequest {
    private String START_DT;
    private String END_DT;
    private String COMPANY_ID;
    private String BRANCH_ID;
    private String NUM_ST;
    private String CAR_NO;
    private String TIME_DVSN;
    private String DATE_CD;
    private String SERVICE_ID;
    private String GOVT_ID;
    private String END_CAR_NO;
    private String USE_YN;
    private String PROC_ST;
    private String NUM_KIND;
    private String WORK_CD;
    private String DELIVERY_GB;
    private String DELIVERY_ADDR;
    private String HOLE_YN;
    private String SEAL_YN;
    private String SPECIAL_YN;
    private String ASSIGN_CD;
}
