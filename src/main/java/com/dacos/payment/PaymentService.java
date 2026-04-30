package com.dacos.payment;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.payment.dto.PaymentSearchRequest;
import com.dacos.payment.mapper.PaymentMapper;

/**
 * 납부관리 서비스
 */
@Service
public class PaymentService {

    private static final Logger logger = LoggerFactory.getLogger(PaymentService.class);

    @Autowired
    private PaymentMapper paymentMapper;

    public List<Map<String, Object>> getPayInfoList(PaymentSearchRequest request) {
        logger.info("[PaymentService] 납부현황 조회");
        return paymentMapper.getPayInfoList(request);
    }

    public List<Map<String, Object>> getTvbankList(PaymentSearchRequest request) {
        logger.info("[PaymentService] 통합가상계좌 조회");
        return paymentMapper.getTvbankList(request);
    }

    public List<Map<String, Object>> getSellingInfoList(PaymentSearchRequest request) {
        logger.info("[PaymentService] 매출현황 조회");
        return paymentMapper.getSellingInfoList(request);
    }

    public List<Map<String, Object>> getPointList(PaymentSearchRequest request) {
        logger.info("[PaymentService] 선납금관리 조회");
        return paymentMapper.getPointList(request);
    }

    public List<Map<String, Object>> getNotPayInfoList(PaymentSearchRequest request) {
        logger.info("[PaymentService] 미납내역관리 조회");
        return paymentMapper.getNotPayInfoList(request);
    }

    public List<Map<String, Object>> getPayReturnList(PaymentSearchRequest request) {
        logger.info("[PaymentService] 환불관리 조회");
        return paymentMapper.getPayReturnList(request);
    }

    public List<Map<String, Object>> getInjiseList(PaymentSearchRequest request) {
        logger.info("[PaymentService] 인지세관리 조회");
        return paymentMapper.getInjiseList(request);
    }

    public List<Map<String, Object>> getTotalList(PaymentSearchRequest request) {
        logger.info("[PaymentService] 종합신청현황 조회");
        return paymentMapper.getTotalList(request);
    }
    
    public List<Map<String, Object>> getPaymentList(String request) {
        logger.info("[PaymentService] 결제정보 조회");
        return paymentMapper.getPaymentList(request);
    }
}
