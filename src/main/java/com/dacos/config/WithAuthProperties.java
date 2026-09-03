package com.dacos.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Data;

@Data
@Component
@ConfigurationProperties(prefix = "with-auth")
public class WithAuthProperties {
    private boolean enabled;
    private String issueOauthUrl;
    private String parseTokenUrl;
    private String sdkUrl;
    private String clientId;
    private String clientSecret;
    private String encryptKey;
    private String encryptIv;
}
