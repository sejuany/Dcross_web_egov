package com.dacos.auth;

import com.dacos.auth.dto.UserDto;
import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class LoginSessionListener implements HttpSessionListener {

    private static final Logger logger = LoggerFactory.getLogger(LoginSessionListener.class);

    private final AuthService authService;

    public LoginSessionListener(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public void sessionDestroyed(HttpSessionEvent event) {
        Object sessionUser = event.getSession().getAttribute("user");

        if (!(sessionUser instanceof UserDto)) {
            return;
        }

        UserDto user = (UserDto) sessionUser;

        authService.logout(user.getLOGIN_ID(), user.getLOGIN_DT());
        logger.info("[LoginSessionListener] session destroyed - userId: {}", user.getLOGIN_ID());
    }
}
