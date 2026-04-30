package com.dacos.mortgageerase.dto;

import lombok.Data;

/**
 * 저당말소 항목 DTO
 * - MortgageErase: 말소등록(MortErsRequestV21), 말소신청현황(MortErsList),
 *   다건말소등록(MortErsGroupRequest), 말소수동신청(MortErsRequestV22)
 */
@Data
public class MortgageEraseDto {
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
    private String PROC_CD;
    private String TASK_CD;
    private String GOVT_ID;
    private String OWNER_NM;
    private String MEMBER_NM;
    private String CUSTOMER_NM;
    private Object BOND_AMT;
    private Object TOTAL_AMT;
    private String VBANK_NO;
    private String JUDGE_ST;
    private String JUDGE_DT;
}
