package com.dacos.config;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpSession;

/** 로그인 세션에 묶인 CSRF 토큰을 생성하고 검증한다. */
@Component
public class CsrfTokenService {

    private static final String SESSION_ATTRIBUTE =
            CsrfTokenService.class.getName() + ".token";
    private static final int TOKEN_BYTES = 32;

    private final SecureRandom secureRandom = new SecureRandom();

    public String getOrCreate(HttpSession session) {
        Object saved = session.getAttribute(SESSION_ATTRIBUTE);
        if (saved instanceof String token && !token.isBlank()) {
            return token;
        }

        byte[] random = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(random);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        session.setAttribute(SESSION_ATTRIBUTE, token);
        return token;
    }

    public boolean matches(HttpSession session, String requestToken) {
        if (session == null || requestToken == null || requestToken.isBlank()) {
            return false;
        }

        Object saved = session.getAttribute(SESSION_ATTRIBUTE);
        if (!(saved instanceof String sessionToken) || sessionToken.isBlank()) {
            return false;
        }

        return MessageDigest.isEqual(
                sessionToken.getBytes(StandardCharsets.UTF_8),
                requestToken.getBytes(StandardCharsets.UTF_8));
    }
}
