package com.dacos.newcar.dto;

import lombok.Data;

/**
 * 신차 등록 목록 검색 요청 DTO
 */
@Data
public class NewcarSearchRequest {
    /** 조회 시작일 (YYYYMMDD) */
    private String START_DT;
    /** 조회 종료일 (YYYYMMDD) */
    private String END_DT;
    /** 업무 구분 코드 */
    private String WORK_CD;
    /** 대리점 ID */
    private String COMPANY_ID;
    /** 포함할 대리점 ID 목록 (콤마 구분) */
    private String IN_COMPANY_ID;
    /** 제외할 대리점 ID 목록 (콤마 구분) */
    private String NOT_IN_COMPANY_ID;
    /** 지점 ID */
    private String BRANCH_ID;
    /** 영업사원 ID */
    private String SANGSA_ID;
    /** 처리 상태 */
    private String PROC_ST;
    /** 심사 상태 */
    private String JUDGE_ST;
    /** 차량 번호 */
    private String CAR_NO;
    /** 납입 상태 */
    private String PAY_ST;
    /** 관청 ID */
    private String GOVT_ID;
    /** 번호판 처리 상태 */
    private String NUM_PROC_ST;
    /** 탁송 구분 (콤마 구분) */
    private String DELIVERY_GB;
    /** 시간 구분 (콤마 구분) */
    private String TIME_DVSN;
    /** 고객명 */
    private String CUSTOMER_NM;
    /** 담당자명 */
    private String USER_NM;
    /** 가상계좌 번호 */
    private String VBANK_NO;
    /** 기타 구분 */
    private String ETC_GB_GU;
    /** 열람 여부 */
    private String READ_YN;
}
