package com.dacos.auth;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.dacos.config.WithAuthProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

@Service
public class WithAuthService {

    private static final Logger logger = LoggerFactory.getLogger(WithAuthService.class);
    private static final String SUCCESS_CODE = "200";
    private static final long EXPIRATION_CLOCK_SKEW_SECONDS = 120L;

    private final WithAuthProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public WithAuthService(WithAuthProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public AccessToken issueAccessToken() throws Exception {
        validateConfigured();

        String basicAuth = Base64.getEncoder().encodeToString(
                (properties.getClientId() + ":" + properties.getClientSecret())
                        .getBytes(StandardCharsets.UTF_8));
        String form = "grant_type=" + URLEncoder.encode("client_credentials", StandardCharsets.UTF_8);

        logger.info("[WithAuthService] 액세스 토큰 호출");
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(properties.getIssueOauthUrl()))
                .timeout(Duration.ofSeconds(20))
                .header("Authorization", "Basic " + basicAuth)
                .header("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(form, StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = send(request);
        JsonNode json = objectMapper.readTree(response.body());
        String accessToken = json.path("access_token").asText("");

        if (accessToken.isBlank()) {
            throw new IllegalStateException("withAuth 액세스 토큰 응답이 올바르지 않습니다.");
        }

        logger.info("[WithAuthService] 액세스 토큰 응답 받음: 성공");
        return new AccessToken(accessToken, properties.getSdkUrl());
    }

    public VerificationResult verify(String transactionToken) throws Exception {
        if (transactionToken == null
                || transactionToken.isBlank()
                || "null".equalsIgnoreCase(transactionToken)
                || transactionToken.length() > 8192) {
            throw new IllegalArgumentException("withAuth 인증 토큰이 올바르지 않습니다.");
        }

        AccessToken oauth = issueAccessToken();
        ObjectNode body = objectMapper.createObjectNode().put("token", transactionToken);

        logger.info("[WithAuthService] 간편인증 결과 검증 호출");
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(properties.getParseTokenUrl()))
                .timeout(Duration.ofSeconds(20))
                .header("Authorization", "Bearer " + oauth.value())
                .header("Content-Type", "application/json;charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = send(request);
        JsonNode result = decodeResult(response.body());

        if (!SUCCESS_CODE.equals(result.path("resultCode").asText())) {
            throw new IllegalStateException("withAuth 간편인증 결과 검증에 실패했습니다.");
        }

        JsonNode data = result.path("resultData");
        String name = decryptField(data.path("name").asText("")).trim();
        String phone = onlyDigits(decryptField(data.path("phone").asText("")));
        long expiresAt = data.path("exp").asLong(0L);

        logger.info(
                "[WithAuthService] 검증 응답 확인 - resultCode: {}, resultDataType: {}, fields: {}, name: {}, phone: {}, exp: {}",
                result.path("resultCode").asText(""),
                data.getNodeType(),
                fieldNames(data),
                maskName(name),
                maskPhone(phone),
                expiresAt);

        if (name.isBlank() || phone.length() < 10) {
            throw new IllegalStateException("withAuth 사용자 정보가 올바르지 않습니다.");
        }
        if (isExpired(expiresAt, Instant.now().getEpochSecond())) {
            throw new IllegalStateException("withAuth 인증 결과가 만료되었습니다.");
        }
        logger.info("[WithAuthService] 간편인증 결과 검증 응답 받음: 성공");
        return new VerificationResult(name, phone);
    }

    boolean isExpired(long expiresAt, long nowEpochSeconds) {
        return expiresAt > 0L && nowEpochSeconds > expiresAt + EXPIRATION_CLOCK_SKEW_SECONDS;
    }

    JsonNode decodeResult(String responseBody) throws Exception {
        String value = responseBody == null ? "" : responseBody.trim();
        if (value.isBlank()) {
            throw new IllegalStateException("withAuth 검증 응답이 없습니다.");
        }

        JsonNode json = tryReadJson(value);
        if (json != null
                && json.isObject()
                && json.has("resultCode")
                && !json.path("resultData").isTextual()) {
            return json;
        }

        String encrypted = value;
        if (json != null && json.isTextual()) {
            encrypted = json.asText();
        } else if (json != null && json.path("data").isTextual()) {
            encrypted = json.path("data").asText();
        } else if (json != null && json.path("resultData").isTextual()) {
            encrypted = json.path("resultData").asText();
        }

        JsonNode decrypted = objectMapper.readTree(decryptAes(encrypted));
        if (json != null
                && json.isObject()
                && json.has("resultCode")
                && decrypted.isObject()
                && !decrypted.has("resultCode")) {
            ObjectNode result = ((ObjectNode) json).deepCopy();
            result.set("resultData", decrypted);
            return result;
        }
        return decrypted;
    }

    String decryptField(String value) throws GeneralSecurityException {
        if (value == null || value.isBlank()) {
            return "";
        }

        try {
            byte[] ciphertext = Base64.getDecoder().decode(value);
            if (ciphertext.length == 0 || ciphertext.length % 16 != 0) {
                return value;
            }
        } catch (IllegalArgumentException ignored) {
            return value;
        }

        return decryptAes(value);
    }

    private List<String> fieldNames(JsonNode data) {
        List<String> names = new ArrayList<>();
        data.fieldNames().forEachRemaining(name -> {
            if (!"ci".equalsIgnoreCase(name)) {
                names.add(name);
            }
        });
        return names;
    }

    private String maskName(String name) {
        if (name == null || name.isBlank()) {
            return "(empty)";
        }
        return name.length() == 1 ? "*" : name.charAt(0) + "*".repeat(name.length() - 1);
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.isBlank()) {
            return "(empty)";
        }
        return "*".repeat(Math.max(0, phone.length() - 4))
                + phone.substring(Math.max(0, phone.length() - 4));
    }

    private JsonNode tryReadJson(String value) {
        try {
            return objectMapper.readTree(value);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String decryptAes(String encrypted) throws GeneralSecurityException {
        byte[] key = Base64.getDecoder().decode(properties.getEncryptKey());
        byte[] iv = Base64.getDecoder().decode(properties.getEncryptIv());
        byte[] ciphertext = Base64.getDecoder().decode(encrypted);

        if (key.length != 32 || iv.length != 16) {
            throw new IllegalStateException("withAuth 암호화 키 설정이 올바르지 않습니다.");
        }

        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(iv));
        return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    }

    private HttpResponse<String> send(HttpRequest request) throws Exception {
        HttpResponse<String> response = httpClient.send(
                request,
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("withAuth API HTTP status: " + response.statusCode());
        }
        return response;
    }

    private void validateConfigured() {
        if (!properties.isEnabled()) {
            throw new IllegalStateException("withAuth 연동이 비활성화되어 있습니다.");
        }
        if (isBlank(properties.getIssueOauthUrl())
                || isBlank(properties.getParseTokenUrl())
                || isBlank(properties.getSdkUrl())
                || isBlank(properties.getClientId())
                || isBlank(properties.getClientSecret())
                || isBlank(properties.getEncryptKey())
                || isBlank(properties.getEncryptIv())) {
            throw new IllegalStateException("withAuth 연동 설정이 없습니다.");
        }
    }

    private String onlyDigits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    public record AccessToken(String value, String sdkUrl) {
    }

    public record VerificationResult(String name, String phone) {
    }
}
