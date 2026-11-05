package com.dacos.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.dacos.auth.AuthController;
import com.dacos.auth.dto.UserDto;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/**
 * Blocks protected API requests before they reach a controller when no
 * authenticated user is stored in the HTTP session.
 */
@Component
public class SessionAuthInterceptor implements HandlerInterceptor {

    private final LoginSessionPolicy sessionPolicy;

    public SessionAuthInterceptor(LoginSessionPolicy sessionPolicy) {
        this.sessionPolicy = sessionPolicy;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler) throws IOException {

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        HttpSession session = request.getSession(false);
        if (sessionPolicy.isExpired(session)) {
            sessionPolicy.invalidate(request, response, session);
            session = null;
        }
        Object loginUser = session == null ? null : session.getAttribute(AuthController.SESSION_USER);

        if (loginUser instanceof UserDto) {
            return true;
        }

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write(
                "{\"success\":false,\"message\":\"로그인 정보 없음\"}");
        return false;
    }
}
