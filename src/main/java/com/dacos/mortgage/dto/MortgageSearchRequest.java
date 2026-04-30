package com.dacos.mortgage.dto;

import lombok.Data;

/**
 * 저당설정 목록 검색 요청 DTO
 */
@Data
public class MortgageSearchRequest {
    /** 조회 시작일 (YYYYMMDD) */
    private String START_DT;
    /** 조회 종료일 (YYYYMMDD) */
    private String END_DT;
    /** 업무 구분 코드 */
    private String WORK_CD;
    /** 대리점 ID */
    private String COMPANY_ID;
    /** 지점 ID */
    private String BRANCH_ID;
    /** 영업사원 ID */
    private String SANGSA_ID;
    /** 처리 상태 */
    private String PROC_ST;
    /** 차량 번호 */
    private String CAR_NO;
    /** 납입 상태 */
    private String PAY_ST;
    /** 관청 ID */
    private String GOVT_ID;
    /** 고객명 */
    private String CUSTOMER_NM;
    /** 시간 구분 */
    private String TIME_DVSN;
}
