package com.dacos.newcar;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;
import com.dacos.telegram.TelegramService;

@Service
public class NumplateActionService {
    private static final Logger logger = LoggerFactory.getLogger(NumplateActionService.class);
    private static final String PNG_PREFIX = "data:image/png;base64,";
    private static final int MAX_PNG_BYTES = 10 * 1024 * 1024;
    private static final byte[] PNG_MAGIC = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
    private final CommonRepository common;
    private final NumplateSelectionService selection;
    private final TransactionTemplate transaction;
    private final TelegramService telegramService;
    private Path reportDir = defaultReportDir();

    public NumplateActionService(CommonRepository common, NumplateSelectionService selection,
            PlatformTransactionManager transactionManager) {
        this(common, selection, transactionManager, null);
    }

    @Autowired
    public NumplateActionService(CommonRepository common, NumplateSelectionService selection,
            PlatformTransactionManager transactionManager, @Autowired(required = false) TelegramService telegramService) {
        this.common = common;
        this.selection = selection;
        this.telegramService = telegramService;
        this.transaction = new TransactionTemplate(transactionManager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    private static Path defaultReportDir() {
        return Path.of("/web/report/numplate").toAbsolutePath().normalize();
    }

    void setReportDir(Path reportDir) {
        this.reportDir = reportDir.toAbsolutePath().normalize();
    }

    public static Path resolveReportImagePath(Path baseDir, String serviceId) {
        return resolveReportImagePath(baseDir, serviceId, null);
    }

    public static Path resolveReportImagePath(Path baseDir, String serviceId, Integer seq) {
        String trimmed = Objects.toString(serviceId, "").trim();
        if (!trimmed.matches("[A-Za-z0-9_-]{1,100}")) {
            throw new BusinessException("접수번호 형식이 올바르지 않습니다.", 400);
        }
        Path normalizedBase = baseDir.toAbsolutePath().normalize();
        String filename;
        if (seq == null || seq <= 0) {
            filename = trimmed + ".png";
        } else {
            filename = String.format("%s_%02d.png", trimmed, seq);
        }
        Path resolved = normalizedBase.resolve(filename).normalize();
        if (!resolved.startsWith(normalizedBase)) {
            throw new BusinessException("잘못된 파일 경로입니다.", 400);
        }
        return resolved;
    }

    public static Path resolveExistingReportImage(String serviceId) {
        return resolveExistingReportImage(serviceId, null);
    }

    public static Path resolveExistingReportImage(String serviceId, Integer seq) {
        Path baseDir = defaultReportDir();
        if (seq != null && seq > 0) {
            Path target = resolveReportImagePath(baseDir, serviceId, seq);
            if (Files.isRegularFile(target)) {
                return target;
            }
            if (seq == 1) {
                Path legacy = resolveReportImagePath(baseDir, serviceId, null);
                if (Files.isRegularFile(legacy)) {
                    return legacy;
                }
            }
            return target;
        }
        Path firstSeq = resolveReportImagePath(baseDir, serviceId, 1);
        if (Files.isRegularFile(firstSeq)) {
            return firstSeq;
        }
        return resolveReportImagePath(baseDir, serviceId, null);
    }

    public void recordClientAction(Map<String, Object> param) {
        String event = Objects.toString(param.get("EVENT_CD"), "");
        if (!Set.of("NUMBER_CLICK", "CONFIRM_OPEN", "CONFIRM_CANCEL").contains(event)) {
            throw new BusinessException("허용되지 않은 행동 기록입니다.");
        }
        int count = record(param, event, UUID.randomUUID().toString(), "");
        if (count == 0) throw new BusinessException("유효하지 않은 번호판 선택 링크입니다.");
        if (count < 0) throw new BusinessException("행동 이력을 기록하지 못했습니다.", 503);
    }

    public void reportError(Map<String, Object> param) {
        String token = normalizeToken(param.get("TOKEN"));
        if (!token.matches("[A-Za-z0-9_-]{20,128}")) {
            throw new BusinessException("유효하지 않은 번호판 선택 링크입니다.");
        }
        String symptom = cleanText(param.get("SYMPTOM"), 300);
        String feature = cleanText(param.get("FEATURE"), 300);
        String wantedCarNo = cleanText(param.get("CAR_NO"), 20).replace("\n", " ").trim();
        if (symptom.isEmpty() && feature.isEmpty() && wantedCarNo.isEmpty()) {
            throw new BusinessException("오류 내용을 입력해 주세요.");
        }
        byte[] png = decodePngDataUrl(Objects.toString(param.get("IMAGE"), ""));
        String detail = "[현상] " + (symptom.isEmpty() ? "-" : symptom)
                + "\n[동작 안 하는 기능] " + (feature.isEmpty() ? "-" : feature)
                + "\n[선택하려던 번호] " + (wantedCarNo.isEmpty() ? "-" : wantedCarNo);
        String requestId = UUID.randomUUID().toString();
        Map<String, Object> work = new HashMap<>(Map.of("TOKEN", token, "EVENT_CD", "ERROR_REPORT",
                "CAR_NO", wantedCarNo.isEmpty() ? "-" : wantedCarNo, "REQUEST_ID", requestId, "DETAIL_TX", detail));
        Map<String, Object> access;
        try {
            access = transaction.execute(status -> {
                // 접수 행을 잠근 상태에서 회차 계산과 저장을 끝내 사진과 이력 순서를 맞춘다.
                Map<String, Object> assignment = common.select(
                        Map.of("TOKEN", token, "LOCK_YN", "Y"), "selectNumplateMessageForUpdate");
                String serviceId = assignment == null ? "" : Objects.toString(assignment.get("SERVICE_ID"), "").trim();
                if (serviceId.isEmpty()) throw new BusinessException("유효하지 않은 번호판 선택 링크입니다.");
                Integer count = common.select(Map.of("SERVICE_ID", serviceId), "countNumplateErrorReport");
                int seq = Objects.requireNonNull(count) + 1;
                Path imagePath = resolveReportImagePath(reportDir, serviceId, seq);
                try {
                    Files.createDirectories(reportDir);
                    try (OutputStream output = Files.newOutputStream(imagePath, StandardOpenOption.CREATE_NEW)) {
                        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                            @Override
                            public void afterCompletion(int completionStatus) {
                                if (completionStatus == STATUS_ROLLED_BACK) {
                                    try {
                                        Files.deleteIfExists(imagePath);
                                    } catch (IOException failure) {
                                        logger.error("[번호판 오류 캡쳐 정리 실패] serviceId={}, seq={}, cause={}",
                                                serviceId, seq, failure.getClass().getSimpleName());
                                    }
                                }
                            }
                        });
                        output.write(png);
                    }
                } catch (IOException failure) {
                    logger.error("[번호판 오류 캡쳐 저장 실패] serviceId={}, seq={}, cause={}",
                            serviceId, seq, failure.getClass().getSimpleName());
                    throw new BusinessException("오류 화면 캡쳐를 저장하지 못했습니다.", 503);
                }
                work.put("NOW", new Date());
                if (common.insert(work, "insertNumplateAction") != 1) {
                    throw new BusinessException("유효하지 않은 번호판 선택 링크입니다.");
                }
                Map<String, Object> result = new HashMap<>(assignment);
                result.put("REPORT_SEQ", seq);
                return result;
            });
        } catch (BusinessException failure) {
            throw failure;
        } catch (RuntimeException failure) {
            logger.error("[번호판 오류 제출 저장 실패] requestId={}, cause={}", requestId, failure.getClass().getSimpleName());
            throw new BusinessException("오류 내용을 저장하지 못했습니다.", 503);
        }
        // 접수 저장을 완료한 뒤 알림을 보내 알림 장애가 이미 저장된 접수를 취소하지 않게 한다.
        if (telegramService != null) {
            try {
                int seq = (Integer) access.get("REPORT_SEQ");
                telegramService.sendMessage(String.format(
                        "[고객 번호판 선택 오류 접수%s]\n• 접수번호: %s\n• 고객명: %s\n• 차명: %s\n• 희망번호: %s\n• 오류현상: %s\n• 동작 안 하는 기능: %s",
                        seq > 1 ? String.format(" (%d차)", seq) : "", access.get("SERVICE_ID"),
                        Objects.toString(access.get("CUSTOMER_NM"), "-"), Objects.toString(access.get("CAR_NM"), "-"),
                        wantedCarNo.isEmpty() ? "-" : wantedCarNo, symptom.isEmpty() ? "-" : symptom,
                        feature.isEmpty() ? "-" : feature), null, null, "newds");
            } catch (RuntimeException failure) {
                logger.error("[텔레그램 알림 전송 실패] requestId={}, cause={}", requestId, failure.getClass().getSimpleName());
            }
        }
    }

    private String cleanText(Object value, int maxLength) {
        String text = Objects.toString(value, "").replace("\r\n", "\n").replace('\r', '\n');
        StringBuilder cleaned = new StringBuilder();
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (ch == '\n' || ch == '\t' || !Character.isISOControl(ch)) cleaned.append(ch);
        }
        String result = cleaned.toString().trim();
        return result.length() > maxLength ? result.substring(0, maxLength).trim() : result;
    }

    private byte[] decodePngDataUrl(String dataUrl) {
        String value = dataUrl.trim();
        if (!value.startsWith(PNG_PREFIX)) throw new BusinessException("화면 캡쳐 이미지가 올바르지 않습니다.");
        String encoded = value.substring(PNG_PREFIX.length()).trim();
        if (encoded.isEmpty() || encoded.length() > (MAX_PNG_BYTES * 4 / 3) + 16) {
            throw new BusinessException("화면 캡쳐 이미지 크기가 올바르지 않습니다.");
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException failure) {
            throw new BusinessException("화면 캡쳐 이미지 형식이 올바르지 않습니다.");
        }
        if (bytes.length < PNG_MAGIC.length || bytes.length > MAX_PNG_BYTES) {
            throw new BusinessException("화면 캡쳐 이미지가 올바르지 않습니다.");
        }
        for (int i = 0; i < PNG_MAGIC.length; i++) {
            if (bytes[i] != PNG_MAGIC[i]) throw new BusinessException("PNG 이미지 파일만 저장할 수 있습니다.");
        }
        return bytes;
    }

    // 트랜잭션 프록시가 커밋/롤백을 끝낸 뒤 결과를 별도 트랜잭션에 기록한다.
    public Map<String, Object> confirm(Map<String, Object> param) {
        // 같은 요청 ID로 확정 요청과 처리 결과를 연결해 한 번의 확정 시도를 추적한다.
        String requestId = UUID.randomUUID().toString();
        record(param, "CONFIRM_REQUEST", requestId, "");
        try {
            Map<String, Object> result = selection.confirmCustomerNumplateSelection(param);
            record(param, "CONFIRM_SUCCESS", requestId,
                    Boolean.TRUE.equals(result.get("alreadySelected")) ? "ALREADY_SELECTED" : "SAVED");
            return result;
        } catch (RuntimeException e) {
            record(param, "CONFIRM_FAILURE", requestId,
                    e instanceof BusinessException ? e.getMessage() : e.getClass().getSimpleName());
            throw e;
        }
    }

    private String normalizeToken(Object rawToken) {
        String token = Objects.toString(rawToken, "").trim();
        int nested = token.lastIndexOf("?t=");
        return nested >= 0 ? token.substring(nested + 3).trim() : token;
    }

    private int record(Map<String, Object> param, String event, String requestId, String detail) {
        String token = normalizeToken(param.get("TOKEN"));
        String carNo = Objects.toString(param.get("CAR_NO"), "").trim();
        if (!token.matches("[A-Za-z0-9_-]{20,128}") || carNo.isBlank()
                || carNo.length() > 20 || carNo.chars().anyMatch(Character::isISOControl)) {
            throw new BusinessException("행동 기록 요청이 올바르지 않습니다.");
        }
        Map<String, Object> work = new HashMap<>(Map.of("TOKEN", token, "CAR_NO", carNo,
                "EVENT_CD", event, "REQUEST_ID", requestId, "DETAIL_TX", detail));
        try {
            Integer count = transaction.execute(status -> {
                work.put("NOW", new Date());
                return common.insert(work, "insertNumplateAction");
            });
            if (count == null || count != 1) {
                logger.warn("[번호판 행동 이력 저장 건수 오류] event={} requestId={}", event, requestId);
            }
            return count == null ? 0 : count;
        } catch (RuntimeException e) {
            // 이력 장애가 고객의 실제 번호 확정을 막지 않도록 하되 토큰/SQL은 출력하지 않는다.
            logger.error("[번호판 행동 이력 저장 실패] event={}, requestId={}, cause={}", event, requestId, e.getClass().getSimpleName());
            return -1;
        }
    }
}
