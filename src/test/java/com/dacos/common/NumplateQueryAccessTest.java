package com.dacos.common;

import static org.junit.jupiter.api.Assertions.*;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;

import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.mapping.SqlCommandType;
import org.apache.ibatis.builder.StaticSqlSource;
import org.apache.ibatis.plugin.Invocation;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.ResultHandler;
import org.apache.ibatis.session.RowBounds;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.dacos.auth.AuthController;
import com.dacos.auth.dto.UserDto;
import com.dacos.numplateApp.dto.NumPlateSearchRequest;

/** DB 없이 실제 MyBatis 인터셉터의 허용/차단 경계를 검사한다. */
class NumplateQueryAccessTest {
    private final String prefix = "com.dacos.numplateApp.mapper.NumPlateMapper.";
    private boolean executed;

    @AfterEach
    void clearRequest() { RequestContextHolder.resetRequestAttributes(); }

    private Object query(String queryId, String phone, String loginGb, String path) throws Throwable {
        return query(queryId, Map.of("TEL_NO", phone), loginGb, path);
    }

    private Object query(String queryId, Object parameter, String loginGb, String path) throws Throwable {
        UserDto user = new UserDto();
        user.setLOGIN_GB(loginGb);
        user.setMPHONE_NO("010-1234-5678");
        user.setCOMPANY_ID("TESTCO");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        if (loginGb != null) request.getSession().setAttribute(AuthController.SESSION_USER, user);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        Configuration config = new Configuration();
        MappedStatement statement = new MappedStatement.Builder(config, queryId,
                new StaticSqlSource(config, "SELECT SERVICE_ID FROM TR_SERVICE"), SqlCommandType.SELECT).build();
        Executor executor = (Executor) Proxy.newProxyInstance(Executor.class.getClassLoader(),
                new Class<?>[] { Executor.class }, (proxy, method, args) -> {
                    executed = true;
                    return List.of(Map.of("SERVICE_ID", "NTEST"));
                });
        Invocation invocation = new Invocation(executor,
                Executor.class.getMethod("query", MappedStatement.class, Object.class,
                        RowBounds.class, ResultHandler.class),
                new Object[] { statement, parameter, RowBounds.DEFAULT, null });
        return new TrServiceQueryAccessInterceptor(null).intercept(invocation);
    }

    @Test
    void appQueriesUseTheirExistingManagerScope() throws Throwable {
        for (String query : List.of("getProcessList", "getReturnList", "getOfflineList",
                "getProcessDetail", "lockSubPanelService", "getSubPanelInfo")) {
            assertEquals(List.of(Map.of("SERVICE_ID", "NTEST")), query(prefix + query,
                    "01012345678", "NUMPLATE_APP", "/api/numplateapp/process"));
        }
        assertTrue(executed);
    }

    @Test
    void cannotSubstituteAnotherManagersPhone() {
        assertThrows(BusinessException.class, () -> query(prefix + "getProcessList",
                "01099999999", "NUMPLATE_APP", "/api/numplateapp/process"));
        assertFalse(executed);
    }

    @Test
    void appSessionDoesNotGrantGeneralBusinessAccess() {
        assertThrows(BusinessException.class, () -> query(prefix + "getNumPlateList",
                "01012345678", "NUMPLATE_APP", "/api/numplateapp/process"));
        assertThrows(BusinessException.class, () -> query(prefix + "getProcessList",
                "01012345678", "NUMPLATE_APP", "/api/other"));
        assertThrows(BusinessException.class, () -> query(prefix + "getProcessList",
                "01012345678", "OTHER", "/api/numplateapp/process"));
        assertFalse(executed);
    }

    @Test
    void compatibleImageStillRequiresManagersPhone() throws Throwable {
        query(prefix + "getProcessDetail", "01012345678", "NUMPLATE_APP", "/image.do");
        assertThrows(BusinessException.class, () -> query(prefix + "getProcessDetail",
                "01099999999", "NUMPLATE_APP", "/image.do"));
        assertThrows(BusinessException.class, () -> query(prefix + "getProcessList",
                "01012345678", "NUMPLATE_APP", "/image.do"));
    }

    @Test
    void tokenUploadOnlyAllowsItsSpecificQuery() throws Throwable {
        query(prefix + "getIdCardUploadTarget", "", null, "/api/numplateapp/id-card");
        assertThrows(BusinessException.class, () -> query(prefix + "getProcessDetail",
                "01012345678", null, "/api/numplateapp/id-card"));
        assertThrows(BusinessException.class, () -> query(prefix + "getIdCardUploadTarget",
                "", null, "/api/numplateapp/other"));
    }

    @Test
    void inventoryRequiresExactSessionCompany() throws Throwable {
        NumPlateSearchRequest search = new NumPlateSearchRequest();
        search.setCOMPANY_ID("TESTCO");
        query(prefix + "getNumPlateList", search, "NUMPLATE_APP", "/api/numplate/list");
        search.setCOMPANY_ID("OTHERCO");
        assertThrows(BusinessException.class, () -> query(prefix + "getNumPlateList",
                search, "NUMPLATE_APP", "/api/numplate/list"));
        search.setCOMPANY_ID("");
        assertThrows(BusinessException.class, () -> query(prefix + "getNumPlateList",
                search, "NUMPLATE_APP", "/api/numplate/list"));
    }
}
