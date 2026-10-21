package com.dacos.newcar;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;

/** Tests the public type-selection API without Spring, a database, or external calls. */
class NumplateSelectionServiceTest {
    @Test
    void typeSelectionUsesLesseeForLeaseAndRegistrationForOtherVehicles() {
        assertTypeSelection("NORML", "I", "B", "R", 80000000, true);
        assertTypeSelection("NORML", "I", "R", "B", 80000000, false);
        assertTypeSelection("LEASE", "I", "R", "B", 80000000, true);
        assertTypeSelection("LEASE", "I", "B", "R", 80000000, false);
        assertTypeSelection("LEASE", "I", "B", null, 80000000, false);
        assertTypeSelection("LEASE", "C", "R", "B", 80000000, true);
        assertTypeSelection("LEASE", "C", "B", "R", 80000000, false);
        assertTypeSelection("LEASE", "C", "B", null, 80000000, false);
        assertTypeSelection("NORML", "I", "B", "B", 79999999, false);
        assertTypeSelection("LEASE", "I", "B", "B", 79999999, false);
        assertTypeSelection("LEASE", "C", "B", "B", 79999999, false);
        assertTypeSelection("LEASE", "C", "R", "B", 80000001, true);
        assertTypeSelection("LEASE", "T", "B", "R", 80000000, true);
    }

    private void assertTypeSelection(
            String taskCd, String procCd, String regGb, String debtorGb, long buyAmt, boolean allowed) {
        String token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        Map<String, Object> assignment = new HashMap<>(Map.of(
                "TASK_CD", taskCd, "PROC_CD", procCd, "REG_GB", regGb, "BUY_AMT", buyAmt));
        if (debtorGb != null) assignment.put("DEBTOR_GB", debtorGb);
        int[] updates = {0};
        CommonRepository common = new CommonRepository(null) {
            @Override
            @SuppressWarnings("unchecked")
            public <T> T select(Object param, String queryId) {
                assertEquals("selectCustomerNumplateAccess", queryId);
                assertEquals(token, ((Map<?, ?>) param).get("TOKEN"));
                return (T) assignment;
            }

            @Override
            public int update(Map<String, Object> param, String queryId) {
                assertEquals("updateCustomerNumplateType", queryId);
                assertEquals(token, param.get("TOKEN"));
                assertEquals("FG", param.get("NUMPLATE_GB"));
                assignment.put("SAVED_NUMPLATE_GB", param.get("NUMPLATE_GB"));
                updates[0]++;
                return 1;
            }

            @Override
            public <T> List<T> selectList(Object param, String queryId) {
                assertEquals("selectNumplateMessageList", queryId);
                return List.of();
            }
        };
        NumplateSelectionService service = new NumplateSelectionService(common, null, null, null, null, null);
        Map<String, Object> request = Map.of("TOKEN", token, "NUMPLATE_GB", "FG");
        if (allowed) {
            assertEquals("FG", service.selectCustomerNumplateType(request).get("numplateGb"));
            assertEquals(1, updates[0]);
        } else {
            assertEquals("번호판 종류 선택 대상이 아닙니다.", assertThrows(BusinessException.class,
                    () -> service.selectCustomerNumplateType(request)).getMessage());
            assertEquals(0, updates[0]);
        }
    }
}
