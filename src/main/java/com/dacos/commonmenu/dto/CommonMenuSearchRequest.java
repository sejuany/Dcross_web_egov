package com.dacos.commonmenu.dto;

import lombok.Data;

/**
 * 관리자메뉴 검색 요청 DTO
 */
@Data
public class CommonMenuSearchRequest {
    private String START_DT;
    private String END_DT;
    private String COMPANY_ID;
    private String MEMBER_ID;
    private String SEARCH_KEYWORD;
    private String TIME_DVSN;
    private String WORK_CD;
    private String GROUP_ID;
    private String CODE_ID;
    private String DETAIL_ID;
    private String ORDER_ID;
}
