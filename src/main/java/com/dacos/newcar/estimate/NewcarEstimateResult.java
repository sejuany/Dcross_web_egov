package com.dacos.newcar.estimate;

import java.math.BigDecimal;

import lombok.Builder;
import lombok.Getter;

/**
 * 운영 프로시저와 동일한 기준으로 계산한 세금/공채 결과.
 */
@Getter
@Builder(toBuilder = true)
public class NewcarEstimateResult {

    private final BigDecimal acqAmount;
    private final BigDecimal grossAcqAmount;
    private final BigDecimal acqSubtractAmount;
    private final BigDecimal uregAmount;
    private final BigDecimal bondPurchaseAmount;
    private final BigDecimal bondGrossAmount;
    private final BigDecimal bondSubtractAmount;
    private final BigDecimal acqRate;
    private final BigDecimal uregRate;
    private final String bondValue;
    private final String bondValueType;
    private final String bondArea;
    private final String bondCarGb;
    private final BigDecimal bondCompare;
    private final String ntaxApplicationCode;
    private final String acqReason;
    private final String bondReason;
}
