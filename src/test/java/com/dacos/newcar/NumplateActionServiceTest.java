package com.dacos.newcar;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;

/** Spring 컨텍스트/DB/외부 API를 사용하지 않는다. */
class NumplateActionServiceTest {
    private final List<Map<String, Object>> records = new ArrayList<>();
    private final Map<String, Object> request = Map.of("TOKEN", "abcdefghijklmnopqrstuv", "CAR_NO", "18버7363");
    private RuntimeException selectionFailure;
    private boolean auditFailure;
    private boolean unknownToken;
    private int commits;
    private int confirmations;

    private NumplateActionService service() {
        CommonRepository common = new CommonRepository(null) {
            @Override
            public int insert(Map<String, Object> param, String queryId) {
                assertEquals("insertNumplateAction", queryId);
                if (auditFailure) throw new IllegalStateException();
                if (unknownToken) return 0;
                records.add(Map.copyOf(param));
                return 1;
            }
        };
        NumplateSelectionService selection = new NumplateSelectionService(null, null, null, null, null, null) {
            @Override
            public Map<String, Object> confirmCustomerNumplateSelection(Map<String, Object> param) {
                confirmations++;
                if (!auditFailure) {
                    assertEquals(1, commits);
                    assertEquals("CONFIRM_REQUEST", records.get(0).get("EVENT_CD"));
                    assertEquals(1, records.size());
                }
                if (selectionFailure != null) throw selectionFailure;
                return Map.of("carNo", "18버7363", "alreadySelected", false);
            }
        };
        PlatformTransactionManager manager = new PlatformTransactionManager() {
            public TransactionStatus getTransaction(TransactionDefinition definition) {
                assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW, definition.getPropagationBehavior());
                return new SimpleTransactionStatus();
            }
            public void commit(TransactionStatus status) { commits++; }
            public void rollback(TransactionStatus status) { }
        };
        return new NumplateActionService(common, selection, manager);
    }

    @Test
    void recordsRequestThenResultWithSameId() {
        assertEquals("18버7363", service().confirm(request).get("carNo"));
        assertEquals("CONFIRM_SUCCESS", records.get(1).get("EVENT_CD"));
        assertEquals(records.get(0).get("REQUEST_ID"), records.get(1).get("REQUEST_ID"));
        assertEquals(2, commits);
    }

    @Test
    void recordsFailureAndPreservesOriginalException() {
        selectionFailure = new BusinessException("번호판 선택 시간이 만료되었습니다.");
        NumplateActionService service = service();
        assertSame(selectionFailure, assertThrows(BusinessException.class, () -> service.confirm(request)));
        assertEquals("CONFIRM_FAILURE", records.get(1).get("EVENT_CD"));
        assertEquals(selectionFailure.getMessage(), records.get(1).get("DETAIL_TX"));
        assertEquals(records.get(0).get("REQUEST_ID"), records.get(1).get("REQUEST_ID"));
    }

    @Test
    void clientCannotForgeSuccessAndBadInputDoesNotReachDatabase() {
        NumplateActionService service = service();
        assertThrows(BusinessException.class, () -> service.recordClientAction(Map.of(
                "TOKEN", request.get("TOKEN"), "CAR_NO", "18버7363", "EVENT_CD", "CONFIRM_SUCCESS")));
        assertThrows(BusinessException.class, () -> service.recordClientAction(Map.of(
                "TOKEN", "invalid", "CAR_NO", "18버7363", "EVENT_CD", "NUMBER_CLICK")));
        assertTrue(records.isEmpty());
    }

    @Test
    void auditFailureDoesNotPreventSelection() {
        auditFailure = true;
        assertEquals("18버7363", service().confirm(request).get("carNo"));
        assertEquals(1, confirmations);
    }

    @Test
    void clientActionRequiresExistingLinkAndReportsStorageFailure() {
        NumplateActionService service = service();
        Map<String, Object> action = Map.of("TOKEN", request.get("TOKEN"),
                "CAR_NO", "18버7363", "EVENT_CD", "NUMBER_CLICK");
        service.recordClientAction(action);
        assertEquals("NUMBER_CLICK", records.get(0).get("EVENT_CD"));
        unknownToken = true;
        assertThrows(BusinessException.class, () -> service.recordClientAction(action));
        auditFailure = true;
        BusinessException failure = assertThrows(BusinessException.class, () -> service.recordClientAction(action));
        assertEquals(503, failure.getStatusCode());
    }
}
