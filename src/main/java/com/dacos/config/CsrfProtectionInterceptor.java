package com.dacos.config;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.dacos.auth.AuthController;
import com.dacos.auth.dto.UserDto;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/** 로그인 쿠키를 사용하는 변경 요청을 CSRF 토큰과 요청 출처로 검증한다. */
@Component
public class CsrfProtectionInterceptor implements HandlerInterceptor {

    public static final String HEADER_NAME = "X-CSRF-TOKEN";

    private static final Logger logger =
            LoggerFactory.getLogger(CsrfProtectionInterceptor.class);
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS", "TRACE");
    private static final Set<String> TRUSTED_FRONTEND_ORIGINS = Set.of(
            "http://localhost:3000",
            "http://localhost:8080",
            "https://web.dcross.kr",
            "http://w.dcross.kr");
    private static final Set<String> PRE_AUTH_PATHS = Set.of(
            "/api/login",
            "/api/auth/withauth/token",
            "/api/auth/withauth/verify",
            "/api/auth/mobile/request",
            "/api/auth/mobile/verify",
            "/api/company/search",
            "/api/company/association-list",
            "/api/company/branch-list",
            "/api/member/check-id",
            "/api/member/signup",
            "/api/log/login-enter");

    private final CsrfTokenService csrfTokenService;

    public CsrfProtectionInterceptor(CsrfTokenService csrfTokenService) {
        this.csrfTokenService = csrfTokenService;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler) throws IOException {

        if (SAFE_METHODS.contains(request.getMethod().toUpperCase(Locale.ROOT))) {
            return true;
        }

        String requestUri = request.getRequestURI();
        if (PRE_AUTH_PATHS.contains(requestUri)
                || requestUri.startsWith("/api/customer/")
                || requestUri.startsWith("/api/internal/")) {
            // 이 경로들은 로그인 전 흐름 또는 별도 업무 토큰으로 검증한다.
            return true;
        }

        HttpSession session = request.getSession(false);
        Object user = session == null ? null : session.getAttribute(AuthController.SESSION_USER);
        if (!(user instanceof UserDto loginUser)) {
            // 로그인 전 공개 API와 별도 토큰 방식의 서버 간 API는 기존 인증을 사용한다.
            return true;
        }

        if (!isTrustedRequestOrigin(request)) {
            logger.warn(
                    "[CSRF] 허용되지 않은 출처 차단 - userId: {}, uri: {}, origin: {}",
                    loginUser.getLOGIN_ID(),
                    request.getRequestURI(),
                    safeOriginForLog(request.getHeader("Origin")));
            return reject(response);
        }

        if (!csrfTokenService.matches(session, request.getHeader(HEADER_NAME))) {
            logger.warn(
                    "[CSRF] 토큰 누락 또는 불일치 - userId: {}, uri: {}",
                    loginUser.getLOGIN_ID(),
                    request.getRequestURI());
            return reject(response);
        }

        return true;
    }

    private boolean isTrustedRequestOrigin(HttpServletRequest request) {
        String fetchSite = request.getHeader("Sec-Fetch-Site");
        if ("cross-site".equalsIgnoreCase(fetchSite)) {
            return false;
        }

        String origin = request.getHeader("Origin");
        if (origin == null || origin.isBlank()) {
            // 비브라우저 관리 도구도 토큰이 일치하면 사용할 수 있다.
            return true;
        }
        if (TRUSTED_FRONTEND_ORIGINS.contains(origin)) {
            return true;
        }

        try {
            URI uri = URI.create(origin);
            return uri.getScheme() != null
                    && uri.getHost() != null
                    && uri.getScheme().equalsIgnoreCase(request.getScheme())
                    && uri.getHost().equalsIgnoreCase(request.getServerName())
                    && effectivePort(uri.getScheme(), uri.getPort())
                            == effectivePort(request.getScheme(), request.getServerPort());
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private int effectivePort(String scheme, int port) {
        if (port >= 0) {
            return port;
        }
        return "https".equalsIgnoreCase(scheme) ? 443 : 80;
    }

    private String safeOriginForLog(String origin) {
        if (origin == null || origin.isBlank()) {
            return "(없음)";
        }
        return origin.length() > 200 ? origin.substring(0, 200) : origin;
    }

    private boolean reject(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-CSRF-REQUIRED", "true");
        response.getWriter().write(
                "{\"success\":false,\"message\":\"요청 보안 정보가 유효하지 않습니다. 화면을 새로고침한 후 다시 시도해 주세요.\"}");
        return false;
    }
}
