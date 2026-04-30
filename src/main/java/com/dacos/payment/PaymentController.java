package com.dacos.payment;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.common.ApiResponse;
import com.dacos.payment.dto.PaymentSearchRequest;

/**
 * 납부관리 컨트롤러
 * - 납부현황(PayInfo), 통합가상계좌(TvbankManage), 매출현황(SellingInfo),
 *   선납금관리(PointManage), 미납내역관리(NotPayInfo), 환불관리(PayReturnInfo),
 *   인지세관리(InjiseManage), 지방세납부현황(EPayInfo), 종합신청현황(TotalList)
 */
@RestController
@RequestMapping("/api")
public class PaymentController {

    private static final Logger logger = LoggerFactory.getLogger(PaymentController.class);

    @Autowired
    private PaymentService paymentService;

    /** 납부현황 조회 - POST /api/payment/list */
    @PostMapping("/payment/list")
    public ResponseEntity<Map<String, Object>> getPayInfoList(@RequestBody PaymentSearchRequest request) {
        logger.info("[PaymentController] 납부현황 조회 요청");
        List<Map<String, Object>> list = paymentService.getPayInfoList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 통합가상계좌 조회 - POST /api/payment/tvbank/list */
    @PostMapping("/payment/tvbank/list")
    public ResponseEntity<Map<String, Object>> getTvbankList(@RequestBody PaymentSearchRequest request) {
        logger.info("[PaymentController] 통합가상계좌 조회 요청");
        List<Map<String, Object>> list = paymentService.getTvbankList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 매출현황 조회 - POST /api/payment/selling/list */
    @PostMapping("/payment/selling/list")
    public ResponseEntity<Map<String, Object>> getSellingInfoList(@RequestBody PaymentSearchRequest request) {
        logger.info("[PaymentController] 매출현황 조회 요청");
        List<Map<String, Object>> list = paymentService.getSellingInfoList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 선납금관리 조회 - POST /api/payment/point/list */
    @PostMapping("/payment/point/list")
    public ResponseEntity<Map<String, Object>> getPointList(@RequestBody PaymentSearchRequest request) {
        logger.info("[PaymentController] 선납금관리 조회 요청");
        List<Map<String, Object>> list = paymentService.getPointList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 미납내역관리 조회 - POST /api/payment/notpay/list */
    @PostMapping("/payment/notpay/list")
    public ResponseEntity<Map<String, Object>> getNotPayInfoList(@RequestBody PaymentSearchRequest request) {
        logger.info("[PaymentController] 미납내역관리 조회 요청");
        List<Map<String, Object>> list = paymentService.getNotPayInfoList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 환불관리 조회 - POST /api/payment/return/list */
    @PostMapping("/payment/return/list")
    public ResponseEntity<Map<String, Object>> getPayReturnList(@RequestBody PaymentSearchRequest request) {
        logger.info("[PaymentController] 환불관리 조회 요청");
        List<Map<String, Object>> list = paymentService.getPayReturnList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 인지세관리 조회 - POST /api/payment/injise/list */
    @PostMapping("/payment/injise/list")
    public ResponseEntity<Map<String, Object>> getInjiseList(@RequestBody PaymentSearchRequest request) {
        logger.info("[PaymentController] 인지세관리 조회 요청");
        List<Map<String, Object>> list = paymentService.getInjiseList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 종합신청현황 조회 - POST /api/payment/total/list */
    @PostMapping("/payment/total/list")
    public ResponseEntity<Map<String, Object>> getTotalList(@RequestBody PaymentSearchRequest request) {
        logger.info("[PaymentController] 종합신청현황 조회 요청");
        List<Map<String, Object>> list = paymentService.getTotalList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
}
