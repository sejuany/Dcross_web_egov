package com.dacos.scheduler.dto;

import java.util.Date;

import lombok.Data;

@Data
public class SchedulerDto {

    private String SERVICE_ID;
    private String WORK_CD;
    private String COMPANY_ID;
    private String BRANCH_ID;
    private String MEMBER_ID;
    private String GOVT_ID;
    private String PROC_ST;
    private String JUDGE_ST;
    private String CARID_NO;
    private String CAR_NO;
    private String OWNER_NM;
    private String MPHONE_NO;
    private String TEL_NO;
    private String EMAIL;
    private String CUSTOMER_NM;
    private Date REGIST_DATE;
    private String SPECIALIST_NM;
    private String SPECIALIST_HP_NO;
    private String ACQ_VBANK_NO;
    private String ACQ_PAY_AMT;
    private String REQ_CAR_NO;
    private String LINK_ID;
    private String NTAX_TRGET_CD;
}
