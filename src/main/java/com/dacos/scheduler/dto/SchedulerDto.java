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
    private Date REGIST_DATE;
}
