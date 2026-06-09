package com.dacos.addservice.dto;

import lombok.Data;

/**
 * 부가서비스 검색 요청 DTO
 */
@Data
public class AddServiceSearchRequest {
    private String START_DT;
    private String END_DT;
    private String COMPANY_ID;
    private String CAR_NO;
    private String CARID_NO;
    private String TIME_DVSN;
}
