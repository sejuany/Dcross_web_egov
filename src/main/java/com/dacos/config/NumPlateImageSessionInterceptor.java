package com.dacos.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.dacos.attach.AttachImageAccess;
import com.dacos.auth.AuthController;
import com.dacos.auth.dto.UserDto;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/** 비밀번호로 시작한 이미지 전용 세션을 일반 ERP 권한으로 사용할 수 없게 한다. */
@Component
public class NumPlateImageSessionInterceptor implements HandlerInterceptor {
    private final LoginSessionPolicy sessionPolicy;

    public NumPlateImageSessionInterceptor(LoginSessionPolicy sessionPolicy) {
        this.sessionPolicy = sessionPolicy;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        HttpSession session = request.getSession(false);
        if ("OPTIONS".equalsIgnoreCase(request.getMethod()) || session == null
                || !(session.getAttribute(AuthController.SESSION_USER) instanceof UserDto user)
                || !AttachImageAccess.isAppUser(user)) return true;
        if (sessionPolicy.isExpired(session)) {
            sessionPolicy.invalidate(request, response, session);
            return reject(response, 401);
        }
        String path = request.getRequestURI().substring(request.getContextPath().length());
        boolean read = "GET".equals(request.getMethod()) && (
                path.equals("/api/numplateapp/session") || path.equals("/api/csrf-token")
                || path.equals("/api/attach/images")
                || path.matches("/api/attach/images/[A-Za-z0-9-]{1,40}/([1-6]|samsong)"));
        boolean write = "POST".equals(request.getMethod()) && (
                path.equals("/api/logout")
                || path.matches("/api/attach/images/[A-Za-z0-9-]{1,40}/[1-6]"));
        if (read || write) return true;
        return reject(response, 403);
    }

    private boolean reject(HttpServletResponse response, int status) throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write("{\"success\":false,\"message\":\"이미지 관리 전용 계정입니다.\"}");
        return false;
    }
}
