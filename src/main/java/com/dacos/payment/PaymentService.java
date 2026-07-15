package com.dacos.payment;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.dacos.auth.dto.UserDto;
import com.dacos.payment.dto.PaymentSearchRequest;
import com.dacos.payment.mapper.PaymentMapper;

/**
 * 납부관리 서비스
 */
@Service
public class PaymentService {

    private static final Logger logger = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentMapper paymentMapper;

    public PaymentService(PaymentMapper paymentMapper) {
        this.paymentMapper = paymentMapper;
    }

    public List<Map<String, Object>> getPayInfoList(PaymentSearchRequest request) {
        logger.info("[PaymentService] 납부현황 조회");
        return paymentMapper.getPayInfoList(request);
    }

    public List<Map<String, Object>> getWaPayInfoList(PaymentSearchRequest request, UserDto user) {
        logger.info("[PaymentService] WA 납부현황 조회");
        applyWaAccessScope(request, user);
        return paymentMapper.getWaPayInfoList(request);
    }

    public List<Map<String, Object>> getWaPayMemberList(PaymentSearchRequest request, UserDto user) {
        logger.info("[PaymentService] WA 납부현황 담당SP 조회");
        applyWaAccessScope(request, user);
        return paymentMapper.getWaPayMemberList(request);
    }
    private void applyWaAccessScope(PaymentSearchRequest request, UserDto user) {
        String companyId = normalize(user.getCOMPANY_ID());
        String memberGb = normalize(user.getMEMBER_GB());

        request.setCOMPANY_ID(companyId);
        request.setMEMBER_GB(memberGb);

        if ("WA001".equals(companyId) && ("BA".equals(memberGb) || "SU".equals(memberGb))) {
            request.setBRANCH_ID(normalize(user.getBRANCH_ID()));
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase();
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
