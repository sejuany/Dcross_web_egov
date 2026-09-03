package com.dacos.numplateApp.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 번호판 관리 공통 목록의 검색 조건.
 * 외부 입력인 날짜·회사·차량·접수번호 길이와 형식을 컨트롤러 진입 시 검증한다.
 */
@Data
public class NumPlateSearchRequest {
    @Pattern(regexp = "^$|\\d{8}", message = "시작일은 yyyyMMdd 형식이어야 합니다.")
    private String START_DT;
    @Pattern(regexp = "^$|\\d{8}", message = "종료일은 yyyyMMdd 형식이어야 합니다.")
    private String END_DT;
    @Size(max = 30)
    private String COMPANY_ID;
    private String BRANCH_ID;
    private String NUM_ST;
    @Size(max = 20)
    private String CAR_NO;
    private String TIME_DVSN;
    private String DATE_CD;
    @Size(max = 40)
    private String SERVICE_ID;
    private String GOVT_ID;
    private String END_CAR_NO;
    private String USE_YN;
    private String PROC_ST;
    private String NUM_KIND;
    private String WORK_CD;
    private String DELIVERY_GB;
    private String DELIVERY_ADDR;
    private String HOLE_YN;
    private String SEAL_YN;
    private String SPECIAL_YN;
    private String ASSIGN_CD;
}
