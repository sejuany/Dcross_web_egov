package com.dacos.auth;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.dacos.config.MobileOkProperties;
import com.dreamsecurity.json.JSONObject;
import com.dreamsecurity.mobileOK.mobileOKKeyManager;

import jakarta.servlet.http.HttpSession;

@Service
public class MobileOkService {

    public static final String SESSION_CLIENT_TX_ID = "MOBILE_OK_CLIENT_TX_ID";

    private static final DateTimeFormatter CLIENT_INFO_DATE_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final MobileOkProperties properties;
    private final HttpClient httpClient;

    public MobileOkService(MobileOkProperties properties) {
        this.properties = properties;
        this.httpClient = HttpClient.newHttpClient();
    }

    public Map<String, Object> requestToken(HttpSession session) throws Exception {
        validateConfigured();

        mobileOKKeyManager mobileOK = createKeyManager();
        String clientTxId = createClientTxId();
        session.setAttribute(SESSION_CLIENT_TX_ID, clientTxId);

        String reqClientInfo = clientTxId + "|" + LocalDateTime.now().format(CLIENT_INFO_DATE_FORMAT);
        String encryptReqClientInfo = mobileOK.RSAEncrypt(reqClientInfo);

        JSONObject tokenReqBody = new JSONObject();
        tokenReqBody.put("serviceId", mobileOK.getServiceId());
        tokenReqBody.put("encryptReqClientInfo", encryptReqClientInfo);
        tokenReqBody.put("siteUrl", mobileOK.getSiteUrl());

        String mokResult = postJson(properties.getTokenUrl(), tokenReqBody.toString());
        JSONObject resJson = new JSONObject(mokResult);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("ready", true);
        response.put("clientTxId", clientTxId);
        response.put("resultCode", getString(resJson, "resultCode"));
        response.put("resultMsg", getString(resJson, "resultMsg"));
        response.put("publicKey", getString(resJson, "publicKey"));
        response.put("encryptMOKToken", getString(resJson, "encryptMOKToken"));

        return response;
    }

    private mobileOKKeyManager createKeyManager() throws Exception {
        mobileOKKeyManager mobileOK = new mobileOKKeyManager();
        mobileOK.setSiteUrl(properties.getSiteUrl());
        mobileOK.keyInit(resolveKeyFilePath(), properties.getKeyPassword());
        return mobileOK;
    }

    private void validateConfigured() throws IOException {
        if (!properties.isEnabled()) {
            throw new IllegalStateException("Mobile-OK 연동이 비활성화되어 있습니다.");
        }

        if (isBlank(properties.getKeyFile())) {
            throw new IllegalStateException("Mobile-OK key-file 설정이 없습니다.");
        }

        if (isBlank(properties.getKeyPassword())) {
            throw new IllegalStateException("Mobile-OK key-password 설정이 없습니다.");
        }

        if (isBlank(properties.getSiteUrl())) {
            throw new IllegalStateException("Mobile-OK site-url 설정이 없습니다.");
        }

        if (isBlank(properties.getTokenUrl())) {
            throw new IllegalStateException("Mobile-OK token-url 설정이 없습니다.");
        }

        Path keyPath = Path.of(resolveKeyFilePath());
        if (!Files.isRegularFile(keyPath)) {
            throw new IllegalStateException("Mobile-OK 키 파일을 찾을 수 없습니다: " + keyPath);
        }
    }

    private String resolveKeyFilePath() {
        String keyFile = properties.getKeyFile();

        if (keyFile != null && keyFile.startsWith("file:")) {
            return keyFile.substring("file:".length());
        }

        return keyFile;
    }

    private String createClientTxId() {
        String prefix = isBlank(properties.getClientTxIdPrefix())
                ? "Dacos309"
                : properties.getClientTxIdPrefix();
        return prefix + UUID.randomUUID().toString().replace("-", "");
    }

    private String postJson(String url, String jsonData) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json;charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(jsonData, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(
                request,
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Mobile-OK API HTTP status: " + response.statusCode());
        }

        return response.body();
    }

    private String getString(JSONObject json, String key) {
        return json.has(key) ? json.getString(key) : "";
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
