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
}
