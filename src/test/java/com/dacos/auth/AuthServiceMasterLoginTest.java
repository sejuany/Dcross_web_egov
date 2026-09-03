package com.dacos.auth;

import org.junit.jupiter.api.Test;

/** 마스터 로그인 수정으로 일반 H 사용자의 휴대폰 인증이 우회되지 않는지 검증한다. */
public class AuthServiceMasterLoginTest {

    @Test
    void keepsMobileAuthenticationRules() {
        if (AuthService.requiresMobileAuth("H", true)) {
            throw new AssertionError("마스터 로그인은 휴대폰 인증을 요구하면 안 됩니다.");
        }
        if (!AuthService.requiresMobileAuth("H", false)) {
            throw new AssertionError("일반 H 로그인은 휴대폰 인증을 유지해야 합니다.");
        }
    }
}
