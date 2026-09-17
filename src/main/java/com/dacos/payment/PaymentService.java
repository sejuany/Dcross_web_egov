package com.dacos.payment;

import java.util.List;
import java.util.Map;
import java.util.Set;

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

    /** 롯데캐피탈 등 KB 계열 회사 코드 - 일반직원이어도 본인 신청 건 제한(MEMBER_ID)을 걸지 않음 (레거시 PayInfo.js 그리드 포맷 분기 187행) */
    private static final Set<String> PAYINFO_MEMBER_ID_EXEMPT_COMPANY_IDS =
            Set.of("CB007", "CB107", "CB907", "CB207");

    public List<Map<String, Object>> getPayInfoList(PaymentSearchRequest request, UserDto user) {
        logger.info("[PaymentService] 납부현황 조회");
        applyPayInfoAccessScope(request, user);
        return paymentMapper.getPayInfoList(request);
    }

    /**
     * 레거시 PayInfo.js(100~172행)의 조회조건 분기를 그대로 이식.
     * 최고관리자(U*)/관청(GU)는 화면에서 선택한 회사 조건을 그대로 신뢰하고,
     * 회사관리자(CA/CU/MA)와 오복사(R*)는 자기 회사 전체를, 일반직원은 본인 신청 건(MEMBER_ID)만 보도록 제한한다.
     * RC001(스타오토)의 업무구분별 동적 회사 필터(IN_xxx_COMPANY_ID)는 별도 후속 작업 필요 - 우선 전체 회사 조건 없이 처리.
     */
    private void applyPayInfoAccessScope(PaymentSearchRequest request, UserDto user) {
        String memberGb = upper(user.getMEMBER_GB());
        String companyId = trim(user.getCOMPANY_ID());
        boolean dacosUser = memberGb.startsWith("U") || "GU".equals(memberGb);
        boolean companyAdmin = "CA".equals(memberGb) || "CU".equals(memberGb) || "MA".equals(memberGb);

        if (dacosUser) {
            request.setMEMBER_ID("");
            request.setBRANCH_ID("");
            request.setSANGSA_ID("");
        } else if (companyAdmin) {
            request.setCOMPANY_ID(companyId);
            request.setMEMBER_ID("");
        } else if ("RC001".equals(companyId)) {
            request.setCOMPANY_ID("");
            request.setMEMBER_ID("");
        } else if (companyId.startsWith("R")) {
            request.setCOMPANY_ID(companyId);
            request.setMEMBER_ID("");
        } else {
            request.setCOMPANY_ID(companyId);
            request.setBRANCH_ID(trim(user.getBRANCH_ID()));
            request.setSANGSA_ID(trim(user.getSANGSA_ID()));
            request.setMEMBER_ID(PAYINFO_MEMBER_ID_EXEMPT_COMPANY_IDS.contains(companyId) ? "" : trim(user.getLOGIN_ID()));
        }
    }

    private String upper(String value) {
        return trim(value).toUpperCase();
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    public List<Map<String, Object>> getEPayInfoList(PaymentSearchRequest request) {
        return paymentMapper.getEPayInfoList(request);
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
