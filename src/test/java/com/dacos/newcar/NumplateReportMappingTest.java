package com.dacos.newcar;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.Test;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.common.ServiceAccessGuard;

/** DB 연결 없이 실제 매퍼 파싱과 이미지 조회의 입력/권한 경계를 검사한다. */
class NumplateReportMappingTest {
    @Test
    void mapperAllowsSixActionsAndExplicitReportsWithoutAutomaticDiagnostics() throws Exception {
        Configuration config = new Configuration();
        String resource = "mapper/NumPlateMapper.xml";
        try (var input = getClass().getClassLoader().getResourceAsStream(resource)) {
            assertNotNull(input);
            new XMLMapperBuilder(input, config, resource, config.getSqlFragments()).parse();
        }
        String prefix = "com.dacos.numplateApp.mapper.NumPlateMapper.";
        var lock = config.getMappedStatement(prefix + "selectNumplateMessageForUpdate")
                .getBoundSql(Map.of("TOKEN", "test-only", "LOCK_YN", "Y"));
        assertTrue(lock.getSql().contains("FOR UPDATE OF D.NUMPLATE_MSG_TOKEN"));
        assertEquals(List.of("TOKEN"), lock.getParameterMappings().stream().map(p -> p.getProperty()).toList());
        var action = config.getMappedStatement(prefix + "insertNumplateAction").getBoundSql(Map.of());
        assertTrue(action.getSql().contains("AND ? IN ('NUMBER_CLICK', 'CONFIRM_OPEN', 'CONFIRM_CANCEL',"));
        assertTrue(action.getSql().contains("'CONFIRM_REQUEST', 'CONFIRM_SUCCESS', 'CONFIRM_FAILURE', 'ERROR_REPORT')"));
        assertFalse(action.getSql().contains("DOM_STATE"));
        assertEquals(List.of("EVENT_CD", "CAR_NO", "REQUEST_ID", "DETAIL_TX", "TOKEN", "EVENT_CD"),
                action.getParameterMappings().stream().map(p -> p.getProperty()).toList());
        assertFalse(config.hasStatement(prefix + "insertNumplateDiagnostic"));
        var count = config.getMappedStatement(prefix + "countNumplateErrorReport").getBoundSql(Map.of());
        assertEquals(List.of("SERVICE_ID"), count.getParameterMappings().stream().map(p -> p.getProperty()).toList());
        var history = config.getMappedStatement(prefix + "selectNumplateActionHistory").getBoundSql(Map.of());
        assertEquals(List.of("SERVICE_ID"), history.getParameterMappings().stream().map(p -> p.getProperty()).toList());
    }

    @Test
    void imageLookupRejectsBadSequencesAndEnforcesServiceAccess() {
        ServiceAccessGuard guard = new ServiceAccessGuard(null) {
            @Override
            public Map<String, Object> requireAccess(UserDto user, String serviceId, ServiceAction action) {
                assertEquals(ServiceAction.READ_DETAIL, action);
                if (!"ALLOWED".equals(serviceId)) throw new BusinessException("denied", 403);
                return Map.of();
            }
        };
        NumplateSelectionService service = new NumplateSelectionService(null, null, null, null, null, guard, null);
        UserDto user = new UserDto();
        for (String seq : List.of("0", "-1", "invalid", "2147483648")) {
            assertEquals(400, assertThrows(BusinessException.class,
                    () -> service.getNumplateErrorReportImage("ALLOWED", seq, user)).getStatusCode());
        }
        assertTrue(service.getNumplateErrorReportImage("ALLOWED", "100", user).endsWith("ALLOWED_100.png"));
        assertEquals(403, assertThrows(BusinessException.class,
                () -> service.getNumplateErrorReportImage("DENIED", "01", user)).getStatusCode());
    }
}
