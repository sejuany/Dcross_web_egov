package com.dacos.numplateApp;

import static org.junit.jupiter.api.Assertions.*;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.numplateApp.dto.NumPlateSearchRequest;
import com.dacos.numplateApp.mapper.NumPlateMapper;

/** DB/외부 API 없이 세션 범위와 오프라인 관할 권한을 검사한다. */
class NumplateSessionScopeTest {
    private UserDto user() {
        UserDto user = new UserDto();
        user.setLOGIN_GB("NUMPLATE_APP");
        user.setMPHONE_NO("010-1234-5678");
        user.setCOMPANY_ID("dacos");
        return user;
    }

    @Test
    void offlineUsesServerGovernmentAndSessionPhone() {
        NumPlateMapper mapper = (NumPlateMapper) Proxy.newProxyInstance(NumPlateMapper.class.getClassLoader(),
                new Class<?>[] { NumPlateMapper.class }, (proxy, method, args) -> {
                    Map<?, ?> params = (Map<?, ?>) args[0];
                    assertEquals("01012345678", params.get("TEL_NO"));
                    if (method.getName().equals("getOfflineGovernment")) return "TESTGOV";
                    assertEquals("getOfflineList", method.getName());
                    assertEquals("TESTGOV", params.get("OFF_GOVT"));
                    return List.of();
                });
        assertTrue(new NumPlateService(mapper, null).getOfflineList(
                Map.of("TEL_NO", "01099999999", "OFF_GOVT", "OTHERGOV"), user()).isEmpty());
    }

    @Test
    void missingOfflinePermissionDoesNotRunListQuery() {
        NumPlateMapper mapper = (NumPlateMapper) Proxy.newProxyInstance(NumPlateMapper.class.getClassLoader(),
                new Class<?>[] { NumPlateMapper.class }, (proxy, method, args) -> {
                    assertEquals("getOfflineGovernment", method.getName());
                    return null;
                });
        BusinessException failure = assertThrows(BusinessException.class,
                () -> new NumPlateService(mapper, null).getOfflineList(Map.of(), user()));
        assertEquals(403, failure.getStatusCode());
        assertTrue(failure.getMessage().contains("ETC../NUMOFF"));
    }

    @Test
    void appInventoryCannotUseAllCompaniesEvenForDacos() {
        NumPlateService service = new NumPlateService(null, null) {
            @Override
            public List<Map<String, Object>> getNumPlateList(NumPlateSearchRequest request) {
                assertEquals("dacos", request.getCOMPANY_ID());
                return List.of();
            }
        };
        NumPlateController controller = new NumPlateController(service, null, null);
        MockHttpSession session = new MockHttpSession();
        UserDto user = user();
        session.setAttribute("user", user);
        NumPlateSearchRequest request = new NumPlateSearchRequest();
        request.setCOMPANY_ID("OTHERCO");
        controller.getNumPlateList(request, session);
        user.setCOMPANY_ID("");
        assertThrows(BusinessException.class, () -> controller.getNumPlateList(request, session));
    }

    @Test
    void wrongCurrentPasswordDoesNotPretendSessionExpired() {
        NumPlateMapper mapper = (NumPlateMapper) Proxy.newProxyInstance(NumPlateMapper.class.getClassLoader(),
                new Class<?>[] { NumPlateMapper.class }, (proxy, method, args) -> {
                    assertEquals("loginManager", method.getName());
                    return List.of(Map.of("ETC6", "1111"));
                });
        BusinessException failure = assertThrows(BusinessException.class,
                () -> new NumPlateService(mapper, null).changeManagerPassword(Map.of(
                        "currentPassword", "0000", "newPassword", "2222", "confirmPassword", "2222"), user()));
        assertEquals(400, failure.getStatusCode());
    }

    @Test
    void unauthorizedImageDoesNotRedirectToLegacyServer() {
        NumPlateService service = new NumPlateService(null, null) {
            @Override
            public Map<String, Object> getProcessDetail(String serviceId, UserDto user) {
                throw new BusinessException("처리 건을 찾을 수 없습니다.", 404);
            }
            @Override
            public java.net.URI legacyImageUri(String serviceId, int slot) {
                fail("권한 확인 실패 시 기존 서버로 우회하지 않는다.");
                return null;
            }
        };
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("user", user());
        BusinessException failure = assertThrows(BusinessException.class,
                () -> new NumPlateController(service, null, null).getProcessImage("NTEST", 1, session));
        assertEquals(404, failure.getStatusCode());
    }

    @Test
    void publicIdCardLinkStillRequiresValidReadyToken() {
        NumPlateMapper mapper = (NumPlateMapper) Proxy.newProxyInstance(NumPlateMapper.class.getClassLoader(),
                new Class<?>[] { NumPlateMapper.class }, (proxy, method, args) -> {
                    assertEquals("getIdCardUploadTarget", method.getName());
                    assertTrue(List.of("TEST0001", "TEST0002").contains(args[0]));
                    return Map.of("READY_YN", "TEST0001".equals(args[0]) ? "N" : "Y", "CAR_NO", "TEST");
                });
        NumPlateService service = new NumPlateService(mapper, null);
        assertThrows(BusinessException.class, () -> service.getIdCardUpload("invalid-token"));
        assertThrows(BusinessException.class, () -> service.getIdCardUpload("TEST0001"));
        assertEquals("TEST", service.getIdCardUpload("TEST0002").get("CAR_NO"));
    }
}
