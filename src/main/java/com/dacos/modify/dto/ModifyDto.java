package com.dacos.modify.dto;

import lombok.Data;

/**
 * 변경등록 항목 DTO
 * - Modify: 변경등록(ModifyRequest), 변경등록현황(ModifyList),
 *   다건변경등록(ModifyGroupRequest), 등록증재발급(CarpReprintRequest),
 *   등록증현황(CarpReprintList)
 */
@Data
public class ModifyDto {
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
    private Object TOTAL_AMT;
    private String VBANK_NO;
}
