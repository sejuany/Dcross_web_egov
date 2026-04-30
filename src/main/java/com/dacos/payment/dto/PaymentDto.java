package com.dacos.payment.dto;

import lombok.Data;

/**
 * 납부관리 항목 DTO
 * - Payment: 납부현황(PayInfo), 통합가상계좌(TvbankManage), 매출현황(SellingInfo),
 *   선납금관리(PointManage), 미납내역관리(NotPayInfo), 환불관리(PayReturnInfo),
 *   인지세관리(InjiseManage), 지방세납부현황(EPayInfo), 종합신청현황(TotalList)
 */
@Data
public class PaymentDto {
    private String SERVICE_ID;
    private String COMPANY_ID;
    private String COMPANY_NM;
    private String WORK_CD;
    private String REQUEST_DT;
    private String PAY_ST;
    private String VBANK_NO;
    private Object TOTAL_AMT;
    private Object PAY_AMT;
    private String PAY_DT;
    private String CAR_NO;
    private String CARID_NO;
}
