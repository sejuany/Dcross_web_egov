package com.dacos.customer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.TransactionDefinition;

import com.dacos.newcar.NumplateActionService;
import com.dacos.newcar.NumplateSelectionService;

/** 서버/DB/외부 API 없이 명시적 오류제출은 허용하고 자동 진단 경로는 없는지 검사한다. */
class CustomerNumplateLoggingTest {
    @Test
    void selectionAndExplicitReportWorkWithoutAutomaticDiagnosticRoutes() throws Exception {
        Map<String, Object> selectionResult = Map.of("serviceId", "TEST-SERVICE");
        NumplateSelectionService selection = new NumplateSelectionService(null, null, null, null, null, null, null) {
            @Override
            public Map<String, Object> getCustomerNumplateSelection(String token) {
                return selectionResult;
            }
        };
        int[] reports = {0};
        NumplateActionService actions = new NumplateActionService(null, null, new AbstractPlatformTransactionManager() {
            protected Object doGetTransaction() { return new Object(); }
            protected void doBegin(Object transaction, TransactionDefinition definition) { }
            protected void doCommit(DefaultTransactionStatus status) { }
            protected void doRollback(DefaultTransactionStatus status) { }
        }) {
            @Override
            public void reportError(Map<String, Object> param) { reports[0]++; }
        };
        CustomerController controller = new CustomerController(null, null, null, selection, actions);
        assertEquals(selectionResult, controller.getNumplateSelection("test-only").getBody().get("result"));
        var mvc = MockMvcBuilders.standaloneSetup(controller).build();
        mvc.perform(post("/api/customer/numplate-selection/diagnostics")).andExpect(status().isNotFound());
        mvc.perform(post("/api/customer/numplate-selection/report")
                .contentType("application/json").content("{}")) .andExpect(status().isOk());
        assertEquals(1, reports[0]);
    }
}
