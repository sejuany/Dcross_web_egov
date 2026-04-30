package com.dacos.trnsname.dto;

import lombok.Data;

/**
 * 이전등록 항목 DTO
 * - TrnsName: 이전등록(TrnsNameRequestV52), 이전등록현황(TrnsNameList),
 *   통합업로드(TotalGroupRequest), 등록증발송현황(CarpRequestList),
 *   탈부착요청현황(TrnsNumChangeList), 오프라인(OfflineList)
 */
@Data
public class TrnsNameDto {
    private String SERVICE_ID;
    private String WORK_CD;
    private String CARID_NO;
    private String CAR_NO;
    private String COMPANY_ID;
    private String COMPANY_NM;
    private String MEMBER_ID;
    private String REQUEST_DT;
    private String PROC_DT;
    private String PROC_ST;
    private String PAY_ST;
    private String GOVT_ID;
    private String OWNER_NM;
    private String MEMBER_NM;
    private String CUSTOMER_NM;
    private String DELIVERY_GB;
    private String NUM_PROC_ST;
    private Object TOTAL_AMT;
    private String VBANK_NO;
}
