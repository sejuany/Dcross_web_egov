package com.dacos.auth;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.dacos.auth.dto.UserDto;
import com.dacos.config.MobileOkProperties;
import com.dreamsecurity.json.JSONObject;
import com.dreamsecurity.mobileOK.mobileOKKeyManager;

import jakarta.servlet.http.HttpSession;

@Service
public class MobileOkService {

    private static final Logger logger = LoggerFactory.getLogger(MobileOkService.class);
    public static final String SESSION_CLIENT_TX_ID = "MOBILE_OK_CLIENT_TX_ID";
    public static final String SESSION_PUBLIC_KEY = "MOBILE_OK_PUBLIC_KEY";
    public static final String SESSION_AUTH_TOKEN = "MOBILE_OK_AUTH_TOKEN";

    private static final String SUCCESS_CODE = "2000";
    private static final Set<String> PROVIDER_IDS = Set.of(
            "SKT", "KT", "LGU", "SKTMVNO", "KTMVNO", "LGUMVNO");
    private static final DateTimeFormatter CLIENT_INFO_DATE_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final MobileOkProperties properties;
    private final HttpClient httpClient;

    public MobileOkService(MobileOkProperties properties) {
        this.properties = properties;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public Map<String, Object> requestToken(HttpSession session) throws Exception {
        validateConfigured();

        mobileOKKeyManager mobileOK = createKeyManager();
        JSONObject resJson = requestTokenJson(session, mobileOK);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("ready", true);
        response.put("clientTxId", session.getAttribute(SESSION_CLIENT_TX_ID));
        response.put("resultCode", getString(resJson, "resultCode"));
        response.put("resultMsg", getString(resJson, "resultMsg"));
        response.put("publicKey", getString(resJson, "publicKey"));
        response.put("encryptMOKToken", getString(resJson, "encryptMOKToken"));

        return response;
    }

    public Map<String, Object> requestAuth(HttpSession session, UserDto user, String providerId) throws Exception {
        validateConfigured();

        // Build Mobile-OK identity payload from the pending login user.
        String normalizedProviderId = normalizeProviderId(providerId);
        UserIdentity identity = resolveUserIdentity(user);

        mobileOKKeyManager mobileOK = createKeyManager();
        JSONObject tokenJson = requestTokenJson(session, mobileOK);

        String tokenResultCode = getString(tokenJson, "resultCode");
        if (!SUCCESS_CODE.equals(tokenResultCode)) {
            return mobileOkError(tokenJson, "Mobile-OK 거래토큰 요청에 실패했습니다.");
        }

        String publicKey = getString(tokenJson, "publicKey");
        String encryptMOKToken = getString(tokenJson, "encryptMOKToken");
        if (isBlank(publicKey) || isBlank(encryptMOKToken)) {
            throw new IllegalStateException("Mobile-OK 거래토큰 응답 정보가 올바르지 않습니다.");
        }

        // Mobile-OK API step 2: encrypt auth info and request an SMS auth number.
        JSONObject authInfo = new JSONObject();
        authInfo.put("serviceType", "telcoAuth");
        authInfo.put("providerId", normalizedProviderId);
        authInfo.put("reqAuthType", "SMS");
        authInfo.put("usageCode", "01005");
        authInfo.put("userName", identity.userName);
        authInfo.put("userPhone", identity.userPhone);
        authInfo.put("userBirthday", identity.userBirthday);
        authInfo.put("userGender", identity.userGender);
        authInfo.put("userNation", identity.userNation);
        authInfo.put("retTransferType", "MOKResult");

        String encryptMOKAuthInfo = mobileOK.RSAServerEncrypt(publicKey, authInfo.toString());

        JSONObject authRequestBody = new JSONObject();
        authRequestBody.put("siteUrl", mobileOK.getSiteUrl());
        authRequestBody.put("encryptMOKToken", encryptMOKToken);
        authRequestBody.put("encryptMOKAuthInfo", encryptMOKAuthInfo);

        logger.info("[MobileOkService] 인증문자 발송 호출");
        JSONObject authResponseJson = new JSONObject(postJson(
                properties.getAuthRequestUrl(),
                authRequestBody.toString()));

        String resultCode = getString(authResponseJson, "resultCode");
        logger.info("[MobileOkService] 인증문자 발송 응답 받음: {}",
                SUCCESS_CODE.equals(resultCode) ? "성공" : "실패");
        if (authResponseJson.has("encryptMOKToken")) {
            session.setAttribute(SESSION_AUTH_TOKEN, getString(authResponseJson, "encryptMOKToken"));
        }
        session.setAttribute(SESSION_PUBLIC_KEY, publicKey);

        Map<String, Object> response = mobileOkResponse(authResponseJson);
        response.put("success", SUCCESS_CODE.equals(resultCode));
        response.put("ready", true);
        response.put("message", SUCCESS_CODE.equals(resultCode)
                ? "인증번호가 발송되었습니다."
                : getString(authResponseJson, "resultMsg"));
        response.put("requiresAuthNumber", SUCCESS_CODE.equals(resultCode));
        return response;
    }

    public Map<String, Object> confirmAuth(HttpSession session, UserDto user, String authNumber) throws Exception {
        validateConfigured();

        // Mobile-OK API step 3: verify the SMS auth number using the auth token from step 2.
        String normalizedAuthNumber = onlyDigits(authNumber);
        if (isBlank(normalizedAuthNumber)) {
            throw new IllegalArgumentException("통신사를 선택해주세요.");
        }

        Object publicKeyObj = session.getAttribute(SESSION_PUBLIC_KEY);
        Object encryptMOKTokenObj = session.getAttribute(SESSION_AUTH_TOKEN);
        if (publicKeyObj == null || encryptMOKTokenObj == null) {
            throw new IllegalStateException("Mobile-OK 인증요청 정보가 없습니다. 인증번호 발송부터 다시 진행해주세요.");
        }

        mobileOKKeyManager mobileOK = createKeyManager();

        JSONObject verifyInfo = new JSONObject();
        verifyInfo.put("authNumber", normalizedAuthNumber);

        JSONObject confirmRequestBody = new JSONObject();
        confirmRequestBody.put("encryptMOKToken", String.valueOf(encryptMOKTokenObj));
        confirmRequestBody.put(
                "encryptMOKVerifyInfo",
                mobileOK.RSAServerEncrypt(String.valueOf(publicKeyObj), verifyInfo.toString()));

        JSONObject confirmResponseJson = new JSONObject(postJson(
                properties.getConfirmUrl(),
                confirmRequestBody.toString()));

        String resultCode = getString(confirmResponseJson, "resultCode");
        if (!SUCCESS_CODE.equals(resultCode)) {
            if (confirmResponseJson.has("encryptMOKToken")) {
                session.setAttribute(SESSION_AUTH_TOKEN, getString(confirmResponseJson, "encryptMOKToken"));
            }
            Map<String, Object> retryResponse = mobileOkResponse(confirmResponseJson);
            retryResponse.put("success", false);
            retryResponse.put("message", getString(confirmResponseJson, "resultMsg"));
            return retryResponse;
        }

        String encryptMOKResult = getString(confirmResponseJson, "encryptMOKResult");
        if (isBlank(encryptMOKResult)) {
            throw new IllegalStateException("Mobile-OK 검증결과 응답 정보가 없습니다.");
        }

        JSONObject resultJson = new JSONObject(mobileOK.getResultJSON(encryptMOKResult));
        validateResult(session, user, resultJson);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("resultCode", SUCCESS_CODE);
        response.put("resultMsg", "success");
        response.put("message", "휴대폰 본인인증이 완료되었습니다.");
        response.put("userName", getString(resultJson, "userName"));
        return response;
    }

    private JSONObject requestTokenJson(HttpSession session, mobileOKKeyManager mobileOK) throws Exception {
        // Mobile-OK API step 1: create a transaction token tied to this session.
        String clientTxId = createClientTxId();
        session.setAttribute(SESSION_CLIENT_TX_ID, clientTxId);

        String reqClientInfo = clientTxId + "|" + LocalDateTime.now().format(CLIENT_INFO_DATE_FORMAT);
        String encryptReqClientInfo = mobileOK.RSAEncrypt(reqClientInfo);

        JSONObject tokenReqBody = new JSONObject();
        tokenReqBody.put("serviceId", mobileOK.getServiceId());
        tokenReqBody.put("encryptReqClientInfo", encryptReqClientInfo);
        tokenReqBody.put("siteUrl", mobileOK.getSiteUrl());

        logger.info("[MobileOkService] 토큰 호출");
        JSONObject response = new JSONObject(postJson(properties.getTokenUrl(), tokenReqBody.toString()));
        logger.info("[MobileOkService] 토큰 응답 받음: {}",
                SUCCESS_CODE.equals(getString(response, "resultCode")) ? "성공" : "실패");
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

        if (isBlank(properties.getAuthRequestUrl())) {
            throw new IllegalStateException("Mobile-OK auth-request-url 설정이 없습니다.");
        }

        if (isBlank(properties.getConfirmUrl())) {
            throw new IllegalStateException("Mobile-OK confirm-url 설정이 없습니다.");
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
                .timeout(Duration.ofSeconds(20))
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

    private String normalizeProviderId(String providerId) {
        String normalized = providerId == null ? "" : providerId.trim().toUpperCase(Locale.ROOT);
        if (!PROVIDER_IDS.contains(normalized)) {
            throw new IllegalArgumentException("통신사를 선택해주세요.");
        }
        return normalized;
    }

    private UserIdentity resolveUserIdentity(UserDto user) {
        // Mobile-OK requires birthday/gender/nation derived from the stored registration number.
        if (user == null) {
            throw new IllegalStateException("휴대폰 본인인증 대기 사용자 정보가 없습니다.");
        }

        String userName = trimToEmpty(user.getMEMBER_NM());
        String userPhone = onlyDigits(user.getMPHONE_NO());
        String registNo = onlyDigits(user.getREGIST_NO());

        if (isBlank(userName)) {
            throw new IllegalStateException("회원 이름 정보가 없습니다.");
        }
        if (userPhone.length() < 10) {
            throw new IllegalStateException("회원 휴대전화번호 정보가 올바르지 않습니다.");
        }
        if (registNo.length() < 7) {
            throw new IllegalStateException("휴대폰 인증용 등록번호 정보가 올바르지 않습니다.");
        }

        String birth6 = registNo.substring(0, 6);
        char genderCode = registNo.charAt(6);

        String century = switch (genderCode) {
            case '1', '2', '5', '6' -> "19";
            case '3', '4', '7', '8' -> "20";
            case '9', '0' -> "18";
            default -> throw new IllegalStateException("등록번호 성별 코드가 올바르지 않습니다.");
        };
        String userGender = ((genderCode - '0') % 2 == 1) ? "1" : "2";
        String userNation = (genderCode >= '5' && genderCode <= '8') ? "1" : "0";

        return new UserIdentity(userName, userPhone, century + birth6, userGender, userNation);
    }

    private void validateResult(HttpSession session, UserDto user, JSONObject resultJson) {
        // Prevent token replay by checking the returned transaction id and identity fields.
        String sessionClientTxId = String.valueOf(session.getAttribute(SESSION_CLIENT_TX_ID));
        String resultClientTxId = getString(resultJson, "clientTxId");
        if (isBlank(sessionClientTxId) || !sessionClientTxId.equals(resultClientTxId)) {
            throw new IllegalStateException("Mobile-OK 거래ID 검증에 실패했습니다.");
        }

        UserIdentity expected = resolveUserIdentity(user);
        String resultName = trimToEmpty(getString(resultJson, "userName"));
        String resultPhone = onlyDigits(getString(resultJson, "userPhone"));
        String resultBirthday = onlyDigits(getString(resultJson, "userBirthday"));

        if (!expected.userName.equals(resultName)
                || !expected.userPhone.equals(resultPhone)
                || !expected.userBirthday.equals(resultBirthday)) {
            throw new IllegalStateException("본인인증 결과가 로그인 사용자 정보와 일치하지 않습니다.");
        }
    }

    private Map<String, Object> mobileOkError(JSONObject json, String defaultMessage) {
        Map<String, Object> response = mobileOkResponse(json);
        response.put("success", false);
        response.put("ready", false);
        response.put("message", isBlank(getString(json, "resultMsg")) ? defaultMessage : getString(json, "resultMsg"));
        return response;
    }

    private Map<String, Object> mobileOkResponse(JSONObject json) {
        Map<String, Object> response = new HashMap<>();
        response.put("resultCode", getString(json, "resultCode"));
        response.put("resultMsg", getString(json, "resultMsg"));

        if (json.has("resendCount")) {
            response.put("resendCount", getString(json, "resendCount"));
        }
        if (json.has("arsOtpNumber")) {
            response.put("arsOtpNumber", getString(json, "arsOtpNumber"));
        }
        if (json.has("otpCode")) {
            response.put("otpCode", getString(json, "otpCode"));
        }

        return response;
    }

    private String getString(JSONObject json, String key) {
        return json.has(key) ? json.optString(key, "") : "";
    }

    private String onlyDigits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record UserIdentity(
            String userName,
            String userPhone,
            String userBirthday,
            String userGender,
            String userNation) {
    }
}
