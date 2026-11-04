package com.dacos.numplateApp;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.numplateApp.mapper.NumPlateMapper;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Notification;
import com.google.firebase.messaging.WebpushConfig;
import com.google.firebase.messaging.WebpushFcmOptions;

import jakarta.annotation.PostConstruct;

/** 번호판 담당자 토큰, 알림 이력, FCM 개별 발송을 한 곳에서 처리한다. */
@Service
public class NumPlatePushService {

    private static final Logger logger = LoggerFactory.getLogger(NumPlatePushService.class);
    private static final Pattern SERVICE_ID = Pattern.compile("^[A-Za-z0-9_-]{1,30}$");

    private final NumPlateMapper numPlateMapper;
    private final boolean enabled;
    private final String credentialsPath;
    private final String projectId;
    private final String publicBaseUrl;
    private final String internalApiKey;
    private FirebaseMessaging firebaseMessaging;

    public NumPlatePushService(
            NumPlateMapper numPlateMapper,
            @Value("${firebase.push.enabled:true}") boolean enabled,
            @Value("${firebase.push.credentials:C:/GoogleFirebase/dcross-web-firebase-adminsdk.json}") String credentialsPath,
            @Value("${firebase.push.project-id:dcross-web}") String projectId,
            @Value("${firebase.push.public-base-url:https://no.dcross.kr}") String publicBaseUrl,
            @Value("${firebase.push.internal-api-key:}") String internalApiKey) {
        this.numPlateMapper = numPlateMapper;
        this.enabled = enabled;
        this.credentialsPath = credentialsPath;
        this.projectId = projectId;
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
        this.internalApiKey = internalApiKey;
    }

    @PostConstruct
    void initializeFirebase() {
        if (!enabled) {
            logger.info("[NumPlatePush] Firebase push is disabled");
            return;
        }
        Path keyFile = Path.of(credentialsPath);
        if (!Files.isRegularFile(keyFile)) {
            logger.warn("[NumPlatePush] Firebase credentials not found: {}", keyFile);
            return;
        }
        try (InputStream input = Files.newInputStream(keyFile)) {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(input))
                    .setProjectId(projectId)
                    .build();
            FirebaseApp app = FirebaseApp.getApps().stream()
                    .filter(candidate -> "dcross-web-push".equals(candidate.getName()))
                    .findFirst()
                    .orElseGet(() -> FirebaseApp.initializeApp(options, "dcross-web-push"));
            firebaseMessaging = FirebaseMessaging.getInstance(app);
            logger.info("[NumPlatePush] Firebase initialized for project {}", projectId);
        } catch (IOException | RuntimeException exception) {
            logger.error("[NumPlatePush] Firebase initialization failed", exception);
        }
    }

    public void requireInternalApiKey(String supplied) {
        if (internalApiKey.isBlank() || supplied == null || !MessageDigest.isEqual(
                internalApiKey.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8))) {
            throw new BusinessException("푸시 API 인증에 실패했습니다.", 401);
        }
    }

    /** 로그인 담당자의 현재 브라우저 FCM 토큰을 TM_NUM_MANAGER에 연결한다. */
    @Transactional
    public void registerToken(UserDto user, String rawToken) {
        String phone = managerPhone(user);
        String token = Objects.toString(rawToken, "").trim();
        if (token.isEmpty() || token.length() > 512) {
            throw new BusinessException("올바른 푸시 토큰이 아닙니다.");
        }
        Map<String, Object> param = Map.of("TEL_NO", phone, "TOKEN", token);
        numPlateMapper.clearPushTokenFromOtherManager(param);
        if (numPlateMapper.updateManagerPushToken(param) != 1) {
            throw new BusinessException("푸시 토큰을 저장하지 못했습니다.", 409);
        }
    }

    public List<Map<String, Object>> getNotifications(UserDto user) {
        return numPlateMapper.getPushNotifications(Map.of("TEL_NO", managerPhone(user)));
    }

    public Map<String, Object> getStatus(UserDto user) {
        String token = numPlateMapper.getManagerPushToken(Map.of("TEL_NO", managerPhone(user)));
        return Map.of("enabled", enabled, "firebaseReady", firebaseMessaging != null,
                "projectId", projectId, "publicBaseUrl", publicBaseUrl,
                "tokenRegistered", token != null && !token.isBlank());
    }

    /** 토큰은 반드시 현재 세션 담당자에게 등록된 값이어야 한다. */
    public Map<String, Object> sendTest(UserDto user, String rawToken) {
        String phone = managerPhone(user);
        if (firebaseMessaging == null) {
            throw new BusinessException("Firebase가 준비되지 않았습니다. 서버의 푸시 활성화 설정과 서비스 계정 파일을 확인해 주세요.", 503);
        }
        String token = Objects.toString(rawToken, "").trim();
        Map<String, Object> param = Map.of("TEL_NO", phone);
        if (token.isEmpty() || token.length() > 512
                || !token.equals(numPlateMapper.getManagerPushToken(param))) {
            throw new BusinessException("현재 기기의 알림을 먼저 등록해 주세요.", 409);
        }
        if (numPlateMapper.countRecentTestPush(param) > 0) {
            throw new BusinessException("테스트 알림은 30초 간격으로 보낼 수 있습니다.", 429);
        }
        String title = "번호판 푸시 테스트";
        String body = "Java 21 서버에서 보낸 테스트 알림입니다. 알림센터에서 확인해 주세요.";
        Map<String, Object> history = new HashMap<>();
        history.put("SERVICE_ID", null);
        history.put("TEL_NO", phone);
        history.put("TITLE", title);
        history.put("MESSAGE", body);
        history.put("TOKEN", token);
        history.put("INS_USER", "NUMPLATE_TEST");
        // 수신 직후 알림센터가 조회해도 이력이 보이도록 발송 전에 INSERT를 커밋한다.
        if (numPlateMapper.insertPushMessage(history) != 1) {
            throw new BusinessException("테스트 알림 이력을 저장하지 못했습니다.", 409);
        }
        String result = send(token, title, body, "", "/numplateapp/notifications");
        return Map.of("pushSent", "SENT".equals(result), "historySaved", true, "resultCode", result);
    }

    /** 기존 Java 7 공통 메소드의 알림 내용을 받아 최신 토큰으로 대신 발송한다. */
    public Map<String, Object> sendRelay(Map<String, Object> request) {
        String phone = Objects.toString(request.get("telNo"), "").replaceAll("[^0-9]", "");
        String title = Objects.toString(request.get("title"), "").trim();
        String body = Objects.toString(request.get("message"), "").trim();
        String serviceId = Objects.toString(request.get("serviceId"), "").trim();
        String insUser = Objects.toString(request.get("insUser"), "DCROSS_RELAY").trim();
        if (phone.length() < 8 || phone.length() > 15) {
            throw new BusinessException("올바른 수신 휴대폰 번호가 필요합니다.");
        }
        if (title.isEmpty() || title.length() > 100 || body.isEmpty() || body.length() > 1000) {
            throw new BusinessException("푸시 제목은 1~100자, 내용은 1~1000자로 입력해 주세요.");
        }
        if (!serviceId.isEmpty() && !SERVICE_ID.matcher(serviceId).matches()) {
            throw new BusinessException("올바른 접수번호가 아닙니다.");
        }
        if (insUser.length() > 50) throw new BusinessException("발송자 식별값은 50자 이하로 입력해 주세요.");

        Map<String, Object> target = numPlateMapper.getRelayPushTarget(Map.of("TEL_NO", phone));
        if (target == null) throw new BusinessException("등록된 번호판 담당자를 찾을 수 없습니다.", 404);
        String token = Objects.toString(target.get("TOKEN"), "").trim();
        Map<String, Object> history = new HashMap<>();
        history.put("TEL_NO", Objects.toString(target.get("TEL_NO"), "").replaceAll("[^0-9]", ""));
        history.put("TITLE", title);
        history.put("MESSAGE", body);
        history.put("TOKEN", token);
        history.put("SERVICE_ID", serviceId.isEmpty() ? null : serviceId);
        history.put("INS_USER", insUser.isEmpty() ? "DCROSS_RELAY" : insUser);
        if (numPlateMapper.insertPushMessage(history) != 1) {
            throw new BusinessException("푸시 알림 이력을 저장하지 못했습니다.", 409);
        }
        String clickPath = serviceId.isEmpty() ? "/numplateapp/notifications" : "/numplateapp/request/" + serviceId;
        String result = token.isEmpty() ? "NO_TOKEN" : send(token, title, body, serviceId, clickPath);
        return Map.of("pushSent", "SENT".equals(result), "historySaved", true, "resultCode", result);
    }

    public void markRead(UserDto user, long idx) {
        if (idx < 1 || numPlateMapper.markPushNotificationRead(
                Map.of("TEL_NO", managerPhone(user), "IDX", idx)) != 1) {
            throw new BusinessException("알림을 찾을 수 없습니다.", 404);
        }
    }

    /** 이전 프로젝트는 배정 저장 성공 후 SERVICE_ID 하나만 이 API로 전달한다. */
    @Transactional
    public Map<String, Object> sendAssignment(String rawServiceId) {
        String serviceId = Objects.toString(rawServiceId, "").trim();
        if (!SERVICE_ID.matcher(serviceId).matches()) {
            throw new BusinessException("올바른 접수번호가 아닙니다.");
        }

        Map<String, Object> target = numPlateMapper.getAssignedPushTarget(serviceId);
        if (target == null) {
            throw new BusinessException("배정된 번호판 담당자를 찾을 수 없습니다.", 404);
        }

        String phone = Objects.toString(target.get("TEL_NO"), "");
        String token = Objects.toString(target.get("TOKEN"), "").trim();
        String carNo = Objects.toString(target.get("CAR_NO"), "차량");
        String title = "번호판 탈부착 요청";
        String body = carNo + " 차량의 번호판 처리건이 배정되었습니다.";
        String clickPath = "/numplateapp/request/" + serviceId;

        Map<String, Object> history = new HashMap<>();
        history.put("SERVICE_ID", serviceId);
        history.put("TEL_NO", phone);
        history.put("TITLE", title);
        history.put("MESSAGE", body);
        history.put("TOKEN", token);
        history.put("INS_USER", "DCROSS_WEB");
        if (numPlateMapper.countRecentAssignmentPush(history) > 0) {
            return Map.of("serviceId", serviceId, "pushSent", false,
                    "historySaved", false, "duplicate", true);
        }
        numPlateMapper.insertPushMessage(history);

        boolean sent = !token.isEmpty() && "SENT".equals(send(token, title, body, serviceId, clickPath));
        return Map.of("serviceId", serviceId, "pushSent", sent, "historySaved", true);
    }

    private String send(String token, String title, String body, String serviceId, String clickPath) {
        if (firebaseMessaging == null) {
            logger.warn("[NumPlatePush] Message stored but Firebase is not initialized: {}", serviceId);
            return "NOT_INITIALIZED";
        }
        try {
            Message message = Message.builder()
                    .setToken(token)
                    .setNotification(Notification.builder().setTitle(title).setBody(body).build())
                    .putData("serviceId", serviceId)
                    .putData("url", clickPath)
                    .setWebpushConfig(WebpushConfig.builder()
                            .setFcmOptions(WebpushFcmOptions.withLink(publicBaseUrl + clickPath))
                            .build())
                    .build();
            String messageId = firebaseMessaging.send(message);
            logger.info("[NumPlatePush] Message sent: serviceId={}, messageId={}", serviceId, messageId);
            return "SENT";
        } catch (FirebaseMessagingException exception) {
            logger.warn("[NumPlatePush] FCM send failed: serviceId={}, code={}, errorCode={}, httpStatus={}, cause={}",
                    serviceId, exception.getMessagingErrorCode(), exception.getErrorCode(),
                    exception.getHttpResponse() == null ? null : exception.getHttpResponse().getStatusCode(),
                    exception.getCause() == null ? null : exception.getCause().getClass().getName());
            if (exception.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED) {
                numPlateMapper.clearInvalidPushToken(token);
            }
            return exception.getMessagingErrorCode() == null ? "FCM_ERROR" : exception.getMessagingErrorCode().name();
        }
    }

    private String managerPhone(UserDto user) {
        String phone = user == null ? "" : Objects.toString(user.getMPHONE_NO(), "").replaceAll("[^0-9]", "");
        if (phone.length() < 8 || phone.length() > 11 || !"NUMPLATE_APP".equals(user.getLOGIN_GB())) {
            throw new BusinessException("번호판 담당자 로그인이 필요합니다.", 401);
        }
        return phone;
    }
}
