package com.dacos.addservice.dto;

import lombok.Data;

/**
 * 부가서비스 항목 DTO
 * - 원부스크래핑(CarMileageListV1), 소유자정보확인(WonbuScrapRequest),
 *   시세(CarSise), 365시세현황(Car365priceList),
 *   카젠매핑(CarZenMapping), 보험가입여부(InsuranceManage)
 */
@Data
public class AddServiceDto {
    private String SERVICE_ID;
    private String CARID_NO;
    private String CAR_NO;
    private String WORK_CD;
    private String COMPANY_ID;
    private String COMPANY_NM;
    private String REQUEST_DT;
    private String PROC_ST;
    private String OWNER_NM;
    private String CAR_NM;
}
