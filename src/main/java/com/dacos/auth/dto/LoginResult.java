package com.dacos.auth.dto;

import lombok.Data;

@Data
public class LoginResult {
    private boolean success;
    private String authType;
    private boolean requiresMobileAuth;
    private boolean requiresCertificateAuth;
    private String pendingAuthToken;
    private UserDto user;

    public static LoginResult normal(UserDto user) {
        LoginResult result = new LoginResult();
        result.setSuccess(true);
        result.setAuthType("NORMAL");
        result.setUser(user);
        return result;
    }

    public static LoginResult mobile(String pendingAuthToken, UserDto user) {
        LoginResult result = new LoginResult();
        result.setSuccess(true);
        result.setAuthType("MOBILE");
        result.setRequiresMobileAuth(true);
        result.setPendingAuthToken(pendingAuthToken);
        result.setUser(user);
        return result;
    }

    public static LoginResult certificate(UserDto user) {
        LoginResult result = new LoginResult();
        result.setSuccess(true);
        result.setAuthType("CERTIFICATE");
        result.setRequiresCertificateAuth(true);
        result.setUser(user);
        return result;
    }
}
