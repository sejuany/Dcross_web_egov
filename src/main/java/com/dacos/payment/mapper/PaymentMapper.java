package com.dacos.payment.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.payment.dto.PaymentSearchRequest;

/**
 * 납부관리 관련 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface PaymentMapper {

    List<Map<String, Object>> getPayInfoList(PaymentSearchRequest request);

    List<Map<String, Object>> getTvbankList(PaymentSearchRequest request);

    List<Map<String, Object>> getSellingInfoList(PaymentSearchRequest request);

    List<Map<String, Object>> getPointList(PaymentSearchRequest request);

    List<Map<String, Object>> getNotPayInfoList(PaymentSearchRequest request);

    List<Map<String, Object>> getPayReturnList(PaymentSearchRequest request);

    List<Map<String, Object>> getInjiseList(PaymentSearchRequest request);

    List<Map<String, Object>> getTotalList(PaymentSearchRequest request);
    
    /**
     * 결제정보 조회
     * @param serviceId 서비스 ID
     */
    List<Map<String, Object>> getPaymentList(String request);
}
