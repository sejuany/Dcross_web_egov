package com.dacos.constructequip.dto;

import lombok.Data;

/**
 * 건설기계 항목 DTO
 * - ConstructEquip: 건설기계설정(CeMortRegRequestV33), 건설기계설정현황(CeMortRegList),
 *   건설기계말소(CeMortErsRequestV21), 건설기계말소현황(CeMortErsList),
 *   건기다건말소등록(CeMortErsGroupRequest)
 */
@Data
public class ConstructEquipDto {
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
    private Object BOND_AMT;
    private Object TOTAL_AMT;
    private String VBANK_NO;
    private String JUDGE_ST;
}
