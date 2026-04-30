package com.dacos.mortgage.dto;

import lombok.Data;

/**
 * 저당설정 항목 DTO
 * - MortgageRegist: 설정등록(MortRegRequest), 설정신청현황(MortRegList),
 *   사전전자서명(BeforehandDsign), 대사작업(MortRegConfirmList),
 *   공동저당(RegistConfirm), 저당권변경(MortChangeV2),
 *   저당권변경현황(MortChangeListV2), 경정관리(CorrectionInfo), 처리지연현황(DelayList)
 */
@Data
public class MortgageDto {
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
