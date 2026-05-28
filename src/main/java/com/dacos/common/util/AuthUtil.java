package com.dacos.common.util;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;

import jakarta.servlet.http.HttpSession;

public class AuthUtil {

	// 로그인 정보 체크(단, 로컬에서는 체크 안 함)
    public static UserDto getLoginUser(HttpSession session) {
        UserDto user = (UserDto) session.getAttribute("user");
        
        // 세션 없으면 에러
        if (user == null) {
            throw new BusinessException("로그인 정보 없음", 401);
        }

        return user;
    }
}