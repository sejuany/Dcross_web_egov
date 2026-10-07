package com.dacos.scheduler;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

class PaymentReminderTest {
    @Test
    void paymentTextKeepsAmountAccountAndCardGuidance() {
        SchedulerService service = new SchedulerService(null, null, null, null, null);
        Map<String, Object> target = new HashMap<>();
        target.put("COMPANY_NM", "폴스타오토모티브코리아");
        target.put("LINK_ID", "ORDER-1");
        target.put("CARID_NO", "VIN-1");
        target.put("REQ_CAR_NO", "123가4567");
        target.put("PAY_DEADLINE", "26/10/10");
        target.put("INSURANCE_DEADLINE", "2026-10-10");
        target.put("INSURANCE_START_DATE", "2026-10-13");
        target.put("TOTAL_AMT", "3,722,130");
        target.put("VBANK_NO", "TEST-ACCOUNT");
        target.put("SPECIALIST_HP_NO", "01012345678");

        String normal = service.buildNewcarPaymentReminderText(target);
        assertTrue(normal.contains("납부비용 : 3,722,130원"));
        assertTrue(normal.contains("예금주명 : 4567주식회사다코"));
        assertTrue(normal.contains("담당 스페셜리스트 : 010-1234-5678"));
        assertTrue(normal.contains("가입 필수 기한 : 2026-10-10 까지"));
        assertTrue(normal.contains("보험 시작일 : 2026-10-13 부터 ~"));
        assertFalse(normal.contains("■ 취득세 카드납부 안내"));

        target.put("CARD_YN", "Y");
        String card = service.buildNewcarPaymentReminderText(target);
        assertTrue(card.contains("취득세 : 등록 후 안내 (카드납부)"));
        assertTrue(card.contains("■ 취득세 카드납부 안내"));
        assertTrue(card.contains("납부시한 : 등록 당일 15시까지"));
    }
}
