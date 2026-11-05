package com.dacos.config;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import com.dacos.auth.AuthController;
import com.dacos.auth.dto.UserDto;

import jakarta.servlet.SessionCookieConfig;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/** 번호판 로그인 유지 기간은 ERP 세션 정책과 분리해서 적용한다. */
@Component
public class LoginSessionPolicy {

    private static final String REMEMBER_ME = LoginSessionPolicy.class.getName() + ".rememberMe";
    private static final String EXPIRES_AT = LoginSessionPolicy.class.getName() + ".expiresAt";
    private static final int REMEMBER_SECONDS = (int) Duration.ofDays(30).toSeconds();
    private static final DateTimeFormatter COOKIE_DATE =
            DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss 'GMT'", Locale.US).withZone(ZoneOffset.UTC);

    private final Clock clock;

    public LoginSessionPolicy() {
        this(Clock.systemUTC());
    }

    LoginSessionPolicy(Clock clock) {
        this.clock = clock;
    }

    public void establishNumPlate(UserDto user, boolean rememberMe,
            HttpServletRequest request, HttpServletResponse response, HttpSession session) {
        request.changeSessionId();
        session.setAttribute(AuthController.SESSION_USER, user);
        session.setMaxInactiveInterval(rememberMe ? REMEMBER_SECONDS : 30 * 60);
        session.setAttribute(REMEMBER_ME, rememberMe);
        if (rememberMe) {
            session.setAttribute(EXPIRES_AT, clock.millis() + REMEMBER_SECONDS * 1000L);
        } else {
            session.removeAttribute(EXPIRES_AT);
        }
        writeSessionCookie(request, response, session.getId(), rememberMe ? REMEMBER_SECONDS : -1);
    }

    public Map<String, Object> describe(HttpSession session) {
        boolean rememberMe = isNumPlate(session) && Boolean.TRUE.equals(session.getAttribute(REMEMBER_ME));
        Object expiresAt = rememberMe ? session.getAttribute(EXPIRES_AT) : null;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("rememberMe", rememberMe);
        result.put("expiresAt", expiresAt instanceof Long deadline ? Instant.ofEpochMilli(deadline).toString() : null);
        return result;
    }

    public boolean isExpired(HttpSession session) {
        if (!isNumPlate(session) || !Boolean.TRUE.equals(session.getAttribute(REMEMBER_ME))) return false;
        Object expiresAt = session.getAttribute(EXPIRES_AT);
        return !(expiresAt instanceof Long deadline) || clock.millis() >= deadline;
    }

    public void resetForErp(HttpServletRequest request, HttpServletResponse response, HttpSession session) {
        request.changeSessionId();
        session.removeAttribute(REMEMBER_ME);
        session.removeAttribute(EXPIRES_AT);
        session.setMaxInactiveInterval(request.getServletContext().getSessionTimeout() * 60);
        writeSessionCookie(request, response, session.getId(), -1);
    }

    public void invalidate(HttpServletRequest request, HttpServletResponse response, HttpSession session) {
        try {
            if (session != null) session.invalidate();
        } finally {
            writeSessionCookie(request, response, "", 0);
        }
    }

    private boolean isNumPlate(HttpSession session) {
        return session != null && session.getAttribute(AuthController.SESSION_USER) instanceof UserDto user
                && "NUMPLATE_APP".equals(user.getLOGIN_GB());
    }

    private void writeSessionCookie(HttpServletRequest request, HttpServletResponse response, String id, int maxAge) {
        SessionCookieConfig config = request.getServletContext().getSessionCookieConfig();
        String name = config.getName() == null ? "JSESSIONID" : config.getName();
        String prefix = name + "=";
        var headers = new ArrayList<>(response.getHeaders("Set-Cookie"));
        String header = headers.stream().filter(value -> value.startsWith(prefix)).findFirst().orElse(null);
        if (header == null) {
            String path = config.getPath();
            if (path == null) path = request.getContextPath().isEmpty() ? "/" : request.getContextPath();
            header = ResponseCookie.from(name, id).path(path).domain(config.getDomain())
                    .httpOnly(true).secure(config.isSecure() || request.isSecure()).sameSite("Lax").build().toString();
        } else {
            int separator = header.indexOf(';');
            header = prefix + id + (separator < 0 ? "" : header.substring(separator));
        }
        header = header.replaceAll("(?i);\\s*(Max-Age|Expires)=[^;]*", "");
        String lower = header.toLowerCase(Locale.ROOT);
        if (!lower.contains("; httponly")) header += "; HttpOnly";
        if (!lower.contains("; samesite=")) header += "; SameSite=Lax";
        if ((config.isSecure() || request.isSecure()) && !lower.contains("; secure")) header += "; Secure";
        if (maxAge >= 0) {
            Instant expires = maxAge == 0 ? Instant.EPOCH : clock.instant().plusSeconds(maxAge);
            header += "; Max-Age=" + maxAge + "; Expires=" + COOKIE_DATE.format(expires);
        }
        // changeSessionId가 이미 발행한 세션 쿠키는 교체하고 다른 쿠키는 보존한다.
        response.setHeader("Set-Cookie", header);
        headers.stream().filter(value -> !value.startsWith(prefix))
                .forEach(value -> response.addHeader("Set-Cookie", value));
    }
}
