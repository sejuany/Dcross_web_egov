package com.dacos.newcar;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
    private final java.util.concurrent.locks.ReentrantLock rowLock = new java.util.concurrent.locks.ReentrantLock();
    @TempDir
    java.nio.file.Path reportDirectory;

    private NumplateActionService service() {
        return service(null);
    }

    private NumplateActionService service(com.dacos.telegram.TelegramService telegram) {
        CommonRepository common = new CommonRepository(null) {
            @Override
            @SuppressWarnings("unchecked")
            public <T> T select(Object param, String queryId) {
                assertTrue(TransactionSynchronizationManager.isActualTransactionActive());
                if ("countNumplateErrorReport".equals(queryId)) {
                    return (T) Integer.valueOf((int) records.stream().filter(row -> "ERROR_REPORT".equals(row.get("EVENT_CD"))).count());
                }
                assertEquals("selectNumplateMessageForUpdate", queryId);
                assertEquals("Y", ((Map<?, ?>) param).get("LOCK_YN"));
                rowLock.lock();
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCompletion(int status) { rowLock.unlock(); }
                });
                return unknownToken ? null : (T) Map.of("SERVICE_ID", "TEST-SERVICE", "CUSTOMER_NM", "TEST-CUSTOMER", "CAR_NM", "TEST-CAR");
            }
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
        return new NumplateActionService(common, selection, transactionManager(), telegram);
    }

    private PlatformTransactionManager transactionManager() {
        return new AbstractPlatformTransactionManager() {
            protected Object doGetTransaction() { return new Object(); }
            protected void doBegin(Object transaction, TransactionDefinition definition) {
                assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW, definition.getPropagationBehavior());
            }
            protected void doCommit(DefaultTransactionStatus status) { commits++; }
            protected void doRollback(DefaultTransactionStatus status) { }
        };
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
        for (String event : List.of("CONFIRM_SUCCESS", "PAGE_STATE", "DOM_STATE", "API_ERROR", "SERVER_API_BEGIN", "ERROR_REPORT")) {
            assertThrows(BusinessException.class, () -> service.recordClientAction(Map.of(
                    "TOKEN", request.get("TOKEN"), "CAR_NO", "18버7363", "EVENT_CD", event)));
        }
        assertThrows(BusinessException.class, () -> service.recordClientAction(Map.of(
                "TOKEN", "invalid", "CAR_NO", "18버7363", "EVENT_CD", "NUMBER_CLICK")));
        assertTrue(records.isEmpty());
    }

    @Test
    void clientRecordsOnlyTheThreeAllowedBrowserActions() {
        NumplateActionService service = service();
        List<String> events = List.of("NUMBER_CLICK", "CONFIRM_OPEN", "CONFIRM_CANCEL");
        for (String event : events) {
            service.recordClientAction(Map.of("TOKEN", request.get("TOKEN"), "CAR_NO", "18버7363", "EVENT_CD", event));
        }
        assertEquals(events, records.stream().map(row -> row.get("EVENT_CD")).toList());
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

    private Map<String, Object> reportRequest() {
        return Map.of("TOKEN", request.get("TOKEN"), "CAR_NO", "18버7363", "SYMPTOM", "TEST-SYMPTOM", "FEATURE", "TEST-FEATURE",
                "IMAGE", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
    }

    @Test
    void reportsSaveSeparateImagesAndTelegramFailureDoesNotUndoStorage() {
        List<String> messages = new ArrayList<>();
        var telegram = new com.dacos.telegram.TelegramService("123:test-only", null) {
            @Override
            public long sendMessage(String message, String parseMode, String photo, String channel) {
                assertEquals("newds", channel);
                assertEquals(records.size(), commits);
                messages.add(message);
                throw new IllegalStateException("test-only");
            }
        };
        NumplateActionService service = service(telegram);
        service.setReportDir(reportDirectory);
        assertDoesNotThrow(() -> service.reportError(reportRequest()));
        assertDoesNotThrow(() -> service.reportError(reportRequest()));
        assertEquals(2, records.size());
        assertEquals(List.of("ERROR_REPORT", "ERROR_REPORT"), records.stream().map(row -> row.get("EVENT_CD")).toList());
        assertEquals("[현상] TEST-SYMPTOM\n[동작 안 하는 기능] TEST-FEATURE\n[선택하려던 번호] 18버7363", records.get(0).get("DETAIL_TX"));
        assertTrue(messages.get(0).contains("TEST-CUSTOMER"));
        assertTrue(messages.get(1).contains("(2차)"));
        assertTrue(java.nio.file.Files.isRegularFile(reportDirectory.resolve("TEST-SERVICE_01.png")));
        assertTrue(java.nio.file.Files.isRegularFile(reportDirectory.resolve("TEST-SERVICE_02.png")));
    }

    @Test
    void reportRollbackRemovesImageAndRetryUsesFirstSequence() {
        NumplateActionService service = service();
        service.setReportDir(reportDirectory);
        auditFailure = true;
        assertThrows(BusinessException.class, () -> service.reportError(reportRequest()));
        assertFalse(java.nio.file.Files.exists(reportDirectory.resolve("TEST-SERVICE_01.png")));
        assertTrue(records.isEmpty());
        auditFailure = false;
        service.reportError(reportRequest());
        assertTrue(java.nio.file.Files.isRegularFile(reportDirectory.resolve("TEST-SERVICE_01.png")));
        assertEquals(1, records.size());
    }

    @Test
    void existingImageIsNotOverwrittenOrSkipped() throws Exception {
        NumplateActionService service = service();
        service.setReportDir(reportDirectory);
        var existing = reportDirectory.resolve("TEST-SERVICE_01.png");
        java.nio.file.Files.writeString(existing, "existing-image");
        assertThrows(BusinessException.class, () -> service.reportError(reportRequest()));
        assertEquals("existing-image", java.nio.file.Files.readString(existing));
        assertFalse(java.nio.file.Files.exists(reportDirectory.resolve("TEST-SERVICE_02.png")));
        assertTrue(records.isEmpty());
    }

    @Test
    void simultaneousReportsUseSeparateSequencesAcrossInstances() throws Exception {
        NumplateActionService first = service();
        NumplateActionService second = service();
        first.setReportDir(reportDirectory);
        second.setReportDir(reportDirectory);
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var one = executor.submit(() -> { start.await(); first.reportError(reportRequest()); return null; });
            var two = executor.submit(() -> { start.await(); second.reportError(reportRequest()); return null; });
            start.countDown();
            one.get(5, java.util.concurrent.TimeUnit.SECONDS);
            two.get(5, java.util.concurrent.TimeUnit.SECONDS);
        }
        assertEquals(2, records.size());
        assertTrue(java.nio.file.Files.isRegularFile(reportDirectory.resolve("TEST-SERVICE_01.png")));
        assertTrue(java.nio.file.Files.isRegularFile(reportDirectory.resolve("TEST-SERVICE_02.png")));
    }

    @Test
    void invalidReportsAreRejectedBeforeWritingImages() {
        NumplateActionService service = service();
        service.setReportDir(reportDirectory);
        Map<String, Object> invalid = new java.util.HashMap<>(reportRequest());
        invalid.put("IMAGE", "data:image/png;base64,invalid");
        assertThrows(BusinessException.class, () -> service.reportError(invalid));
        unknownToken = true;
        assertThrows(BusinessException.class, () -> service.reportError(reportRequest()));
        assertTrue(records.isEmpty());
        assertFalse(java.nio.file.Files.exists(reportDirectory.resolve("TEST-SERVICE_01.png")));
        assertThrows(BusinessException.class, () -> NumplateActionService.resolveReportImagePath(reportDirectory, "../other", 1));
    }
}
