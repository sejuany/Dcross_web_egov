package com.dacos.config;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.handler.MappedInterceptor;
import org.springframework.web.util.ServletRequestPathUtils;

import com.dacos.auth.AuthController;
import com.dacos.auth.dto.UserDto;

/** DB와 서버를 시작하지 않고 공개 로그인 경로와 보호 경로를 검사한다. */
class NumplateLoginAccessTest {
    @Test
    void onlyLoginEndpointsBypassSessionAuthentication() {
        SessionAuthInterceptor authentication = new SessionAuthInterceptor();
        InterceptorRegistry registry = new InterceptorRegistry();
        new WebConfig(authentication, new CsrfProtectionInterceptor(null)).addInterceptors(registry);
        List<?> interceptors = ReflectionTestUtils.invokeMethod(registry, "getInterceptors");
        MappedInterceptor mapped = (MappedInterceptor) interceptors.get(0);
        for (String path : List.of("/api/numplateapp/login",
                "/api/numplateapp/passkeys/login/options", "/api/numplateapp/passkeys/login/verify",
                "/api/numplateapp/id-card")) {
            assertFalse(mapped.matches(request(path)), path);
        }
        for (String path : List.of("/api/numplateapp/passkeys/register/options",
                "/api/numplateapp/push/token", "/api/numplateapp/notifications",
                "/api/numplateapp/process/list", "/api/numplateapp/returns/list",
                "/api/numplateapp/offline/list", "/api/numplateapp/password")) {
            assertTrue(mapped.matches(request(path)), path);
        }
    }

    @Test
    void loginDoesNotRequirePreviousSessionsCsrfToken() throws Exception {
        CsrfProtectionInterceptor csrf = new CsrfProtectionInterceptor(null);
        for (String path : List.of("/api/numplateapp/login",
                "/api/numplateapp/passkeys/login/options", "/api/numplateapp/passkeys/login/verify",
                "/api/numplateapp/id-card")) {
            MockHttpServletRequest request = request(path);
            request.getSession().setAttribute(AuthController.SESSION_USER, new UserDto());
            assertTrue(csrf.preHandle(request, new MockHttpServletResponse(), new Object()), path);
        }
    }

    private MockHttpServletRequest request(String path) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        ServletRequestPathUtils.parseAndCache(request);
        return request;
    }
}
