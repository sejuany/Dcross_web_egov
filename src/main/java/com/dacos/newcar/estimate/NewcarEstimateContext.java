package com.dacos.newcar.estimate;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 운영 프로시저의 입력값과 DB 설정을 정규화한 순수 계산 컨텍스트.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NewcarEstimateContext {

    private String serviceId;
    private String procCd;
    private String taskCd;
    private String area;
    private BigDecimal buyAmt;
    private String carCd;
    private BigDecimal carCc;
    private BigDecimal getinNo;
    private String fuelCd;
    private BigDecimal length;
    private BigDecimal width;
    private BigDecimal height;
    private BigDecimal maxCap;
    private BigDecimal totalCap;
    private String tyCd;
    private String fmNm;
    private String fomNm;
    private String carNm;
    private String ntaxTargetCd;
    private String ntaxTargetGradeCd;
    private String bubyn;
    private String hybridFmExclusions;
    private String hybridOkPatterns;
}
