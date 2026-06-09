package com.dacos.auth.dto;

/**
 * 로그인 요청 DTO
 */
public class LoginRequest {
    private String userId;
    private String password;
    private String regNo;

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRegNo() { return regNo; }
    public void setRegNo(String regNo) { this.regNo = regNo; }
}
