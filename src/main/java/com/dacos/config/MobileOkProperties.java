package com.dacos.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "mobile-ok")
public class MobileOkProperties {

    private boolean enabled;
    private String keyFile;
    private String keyPassword;
    private String clientTxIdPrefix;
    private String siteUrl;
    private String tokenUrl;
    private String authRequestUrl;
    private String confirmUrl;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getKeyFile() {
        return keyFile;
    }

    public void setKeyFile(String keyFile) {
        this.keyFile = keyFile;
    }

    public String getKeyPassword() {
        return keyPassword;
    }

    public void setKeyPassword(String keyPassword) {
        this.keyPassword = keyPassword;
    }

    public String getClientTxIdPrefix() {
        return clientTxIdPrefix;
    }

    public void setClientTxIdPrefix(String clientTxIdPrefix) {
        this.clientTxIdPrefix = clientTxIdPrefix;
    }

    public String getSiteUrl() {
        return siteUrl;
    }

    public void setSiteUrl(String siteUrl) {
        this.siteUrl = siteUrl;
    }

    public String getTokenUrl() {
        return tokenUrl;
    }

    public void setTokenUrl(String tokenUrl) {
        this.tokenUrl = tokenUrl;
    }

    public String getAuthRequestUrl() {
        return authRequestUrl;
    }

    public void setAuthRequestUrl(String authRequestUrl) {
        this.authRequestUrl = authRequestUrl;
    }

    public String getConfirmUrl() {
        return confirmUrl;
    }

    public void setConfirmUrl(String confirmUrl) {
        this.confirmUrl = confirmUrl;
    }
}
