package com.dacos.newcar;

import java.io.Serializable;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

/** 공개 토큰으로 검증한 접수에만 연결한다. 클라이언트의 SERVICE_ID와 원문 오류/URL은 저장하지 않는다. */
@Service
public class NumplateDiagnosticService {
    private static final Logger logger = LoggerFactory.getLogger(NumplateDiagnosticService.class);
    private static final String SESSION_KEY = NumplateDiagnosticService.class.getName();
    private static final String TRACE_KEY = "_NP_TRACE";
    private static final long LIFETIME_MS = 30 * 60 * 1000L;
    private static final int MAX_EVENTS = 250;
    private static final Set<String> EVENTS = Set.of("PAGE_STATE", "BUTTON_STATE", "NUMBER_STATE",
            "API_BEGIN", "API_END", "API_ERROR", "API_PENDING", "CLIENT_ERROR", "PAGE_HIDDEN",
            "PAGE_VISIBLE", "BUTTON_TAP", "DOM_STATE", "UI_TAP", "UI_CLICK", "UI_CHANGE",
            "UI_CANCEL", "UI_AFTER_CLICK", "NETWORK_STATE", "PAGE_RESTORE", "PAGE_FOCUS");
    private static final Set<String> BOOLEANS = Set.of("loading", "hasSelected", "hasData", "completed",
            "selectionStarted", "canStart", "selectionUnavailable", "expired", "lookupFailed",
            "buttonVisible", "disabled", "showLookupConsent", "showSelectionConfirm", "requiresNumplateTypeSelection",
            "lookupConsentChecked", "showNumplateTypeConfirm", "numplateTypeConfirmChecked", "hasSelectedNumplateType",
            "online", "pageVisible", "hasFocus", "persisted", "targetDisabled", "targetChecked",
            "domPrimaryPresent", "domPrimaryDisabled", "domPrimaryVisible", "domPrimaryInViewport",
            "domPrimaryPointerBlocked", "domHitTested", "domPrimaryCovered", "domConfirmPresent",
            "domConfirmDisabled", "domReadFailed", "geometricPointerBlocked", "domConfirmPointerBlocked",
            "domConfirmHitTested", "domConfirmCovered");
    private static final Set<String> NUMBERS = Set.of("remainingSeconds", "selectCount", "candidateCount",
            "clientTimeMs", "clientMonotonicMs", "timeZoneOffsetMinutes", "expiresAtEpochMs",
            "responseServerTimeMs", "responseDbTimeMs", "elapsedMs", "httpStatus", "droppedEvents",
            "clientSeq", "numplateSelectTimeMs", "appearTimeMs", "plateUpdateCount", "installerUpdateCount", "errorLine", "errorColumn",
            "optionIndex", "underlyingIndex", "geometricIndex", "domRadioCount", "domCheckedCount", "domCheckedIndex",
            "domDisabledRadioCount", "domOverlayCount", "viewportWidth", "viewportHeight", "domPrimaryOpacity");
    private static final Set<String> REASONS = Set.of("LOADING", "SELECTION_NOT_STARTED", "EXPIRES_AT_MISSING",
            "EXPIRED", "NUMBER_NOT_SELECTED", "DATA_MISSING", "TYPE_SELECTION_REQUIRED", "LOOKUP_FAILED", "COMPLETED");
    private static final Set<String> CONTROLS = Set.of("NUMBER_OPTION", "PRIMARY_BUTTON", "TYPE_OPTION",
            "TYPE_BUTTON", "TYPE_CONFIRM", "TYPE_CANCEL", "TYPE_CONSENT", "LOOKUP_CONFIRM", "LOOKUP_CANCEL",
            "LOOKUP_CONSENT", "SELECTION_CONFIRM", "SELECTION_CANCEL", "TYPE_BACKDROP", "LOOKUP_BACKDROP",
            "SELECTION_BACKDROP", "OTHER");
    private static final Map<String, Set<String>> ENUMS = Map.of(
            "pointerType", Set.of("mouse", "touch", "pen", "keyboard", "unknown"),
            "browserFamily", Set.of("EDGE", "SAMSUNG", "FIREFOX", "CHROME", "SAFARI", "OTHER"),
            "osFamily", Set.of("ANDROID", "IOS", "WINDOWS", "MAC", "OTHER"),
            "errorCode", Set.of("ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT", "ERR_CANCELED",
                    "ERR_BAD_REQUEST", "ERR_BAD_RESPONSE", "OTHER"));
    private final CommonRepository common;
    private final ObjectMapper json;
    private final TransactionTemplate transaction;

    private record Context(String serviceId, String pageId, long createdAt, AtomicInteger count) implements Serializable {}
    private record Trace(Context context, String requestId) {}

    public NumplateDiagnosticService(CommonRepository common, ObjectMapper json, PlatformTransactionManager manager) {
        this.common = common;
        this.json = json;
        this.transaction = new TransactionTemplate(manager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.transaction.setTimeout(2);
    }

    public Map<String, Object> trace(String operation, Map<String, Object> param, HttpServletRequest request,
            Supplier<Map<String, Object>> action) {
        prepareAction(param, request);
        Trace trace = (Trace) param.get(TRACE_KEY);
        persist(trace.context(), "SERVER_API_BEGIN", trace.requestId(), Map.of("operation", operation,
                "pageSessionId", uuid(request.getHeader("X-Numplate-Page"))));
        long started = System.nanoTime();
        Map<String, Object> result;
        try {
            result = action.get();
        } catch (RuntimeException error) {
            finish(operation, param, trace, null, request, started, error);
            throw error;
        }
        return finish(operation, param, trace, result, request, started, null);
    }

    /** JSON으로 위조할 수 없는 서버 내부 Trace만 기존 행동 이력에 연결한다. */
    public void prepareAction(Map<String, Object> param, HttpServletRequest request) {
        param.keySet().removeIf(key -> key.startsWith("_NP_"));
        Context context = null;
        try {
            context = find(request.getSession(false), request.getHeader("X-Numplate-Diagnostic"));
        } catch (RuntimeException failure) {
            logger.warn("[번호판 진단 세션 확인 실패] cause={}", failure.getClass().getSimpleName());
        }
        param.put(TRACE_KEY, new Trace(context, uuid(request.getHeader("X-Numplate-Request"))));
    }

    public String requestId(Map<String, Object> param) {
        return param.get(TRACE_KEY) instanceof Trace trace ? trace.requestId() : UUID.randomUUID().toString();
    }

    public String actionDetail(Map<String, Object> param, String detail) {
        if (!(param.get(TRACE_KEY) instanceof Trace trace) || trace.context() == null) return detail;
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("pageSessionId", trace.context().pageId());
        if (!detail.isEmpty()) values.put("result", detail);
        return encode(values);
    }

    public void recordClient(Map<String, Object> param, HttpSession session) {
        Context context = find(session, Objects.toString(param.get("DIAGNOSTIC_ID"), ""));
        if (context == null) throw new BusinessException("진단 기록의 유효시간이 지났습니다.", 400);
        String event = Objects.toString(param.get("EVENT_CD"), "");
        if (!EVENTS.contains(event)) throw new BusinessException("허용되지 않은 진단 기록입니다.", 400);
        if (context.count().get() >= MAX_EVENTS) throw new BusinessException("진단 기록 횟수를 초과했습니다.", 429);
        Map<String, Object> detail = new LinkedHashMap<>();
        if (param.get("DETAIL") instanceof Map<?, ?> input) copySafe(input, detail);
        persist(context, event, uuid(Objects.toString(param.get("REQUEST_ID"), "")), detail);
    }

    private Map<String, Object> finish(String operation, Map<String, Object> param, Trace trace,
            Map<String, Object> result, HttpServletRequest request, long started, RuntimeException error) {
        try {
            long elapsedMs = (System.nanoTime() - started) / 1_000_000;
            Map<String, Object> clock = clock();
            Context context = trace.context();
            String diagnosticId = request.getHeader("X-Numplate-Diagnostic");
            // serviceId는 토큰 검증을 통과한 서비스 응답에서만 가져온다.
            if (context == null && result != null && result.get("serviceId") instanceof String serviceId && !serviceId.isBlank()) {
                diagnosticId = UUID.randomUUID().toString();
                context = new Context(serviceId, uuid(request.getHeader("X-Numplate-Page")),
                        System.currentTimeMillis(), new AtomicInteger());
                remember(request.getSession(true), diagnosticId, context);
            }
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("operation", operation);
            detail.put("pageSessionId", uuid(request.getHeader("X-Numplate-Page")));
            detail.put("elapsedMs", elapsedMs);
            detail.putAll(clock);
            if (result != null) {
                copySafe(result, detail);
                detail.put("hasSelected", !Objects.toString(result.get("selectedCarNo"), "").isBlank());
                if (result.get("carNos") instanceof List<?> rows) detail.put("candidateCount", rows.size());
                detail.put("expiresAtRaw", Objects.toString(result.get("expiresAt"), ""));
            }
            if (param.get("_NP_STATE") instanceof Map<?, ?> state) copySafe(state, detail);
            if (param.get("_NP_REASON") instanceof String reason && reason.matches("[A-Z_]{1,48}")) detail.put("reasonCode", reason);
            if (error != null) {
                detail.putIfAbsent("reasonCode", error instanceof BusinessException ? "BUSINESS_RULE_REJECTED" : "SERVER_ERROR");
                detail.put("httpStatus", error instanceof BusinessException business ? business.getStatusCode() : 500);
            }
            persist(context, error == null ? "SERVER_API_END" : "SERVER_API_ERROR", trace.requestId(), detail);
            if (result != null && context != null) {
                Map<String, Object> response = new HashMap<>(result);
                Map<String, Object> diagnostics = new LinkedHashMap<>(clock);
                diagnostics.put("diagnosticId", diagnosticId);
                diagnostics.put("pageSessionId", context.pageId());
                diagnostics.put("requestId", trace.requestId());
                response.put("diagnostics", diagnostics);
                return response;
            }
        } catch (RuntimeException failure) {
            logger.warn("[번호판 진단 처리 실패] operation={} requestId={} cause={}",
                    operation, trace.requestId(), failure.getClass().getSimpleName());
        }
        return result;
    }

    private Map<String, Object> clock() {
        Map<String, Object> clock = new LinkedHashMap<>();
        try {
            String utc = transaction.execute(status -> common.select(Map.of(), "selectNumplateDiagnosticClock"));
            clock.put("dbTimeMs", Instant.parse(utc).toEpochMilli());
        } catch (RuntimeException failure) {
            logger.warn("[번호판 DB 시각 조회 실패] cause={}", failure.getClass().getSimpleName());
        }
        clock.put("serverTimeMs", System.currentTimeMillis());
        return clock;
    }

    private void persist(Context context, String event, String requestId, Map<String, Object> input) {
        if (context == null) {
            logger.info("[번호판 진단 연결 전] event={} requestId={} detail={}", event, requestId, encode(input));
            return;
        }
        if (context.count().incrementAndGet() > MAX_EVENTS) return;
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("pageSessionId", context.pageId());
        detail.put("serverTimeMs", System.currentTimeMillis());
        detail.putAll(input);
        String encoded = encode(detail);
        // DB가 실패해도 토큰/개인정보 없는 상태를 앱 로그에서 확인할 수 있다.
        logger.info("[번호판 진단] serviceId={} event={} requestId={} detail={}", context.serviceId(), event, requestId, encoded);
        Map<String, Object> work = Map.of("SERVICE_ID", context.serviceId(), "EVENT_CD", event,
                "REQUEST_ID", requestId, "DETAIL_TX", encoded);
        try {
            Integer count = transaction.execute(status -> common.insert(work, "insertNumplateDiagnostic"));
            if (count == null || count != 1) logger.warn("[번호판 진단 저장 건수 오류] event={} requestId={}", event, requestId);
        } catch (RuntimeException failure) {
            logger.warn("[번호판 진단 저장 실패] event={} requestId={} cause={}", event, requestId, failure.getClass().getSimpleName());
        }
    }

    private void copySafe(Map<?, ?> input, Map<String, Object> output) {
        input.forEach((key, value) -> {
            String name = Objects.toString(key, "");
            if (BOOLEANS.contains(name) && value instanceof Boolean) output.put(name, value);
            if (NUMBERS.contains(name) && value instanceof Number number && Double.isFinite(number.doubleValue())) output.put(name, number);
            if ("disabledReasons".equals(name) && value instanceof List<?> reasons) {
                output.put(name, reasons.stream().filter(reason -> reason instanceof String && REASONS.contains(reason)).distinct().limit(10).toList());
            }
            if (Set.of("buildVersion", "bundleVersion", "operation", "errorKind", "errorName").contains(name)
                    && value instanceof String text && text.matches("[A-Za-z0-9_.-]{1,96}")) output.put(name, text);
            if (Set.of("control", "underlyingControl", "coverControl", "geometricControl", "confirmCoverControl").contains(name)
                    && value instanceof String text && CONTROLS.contains(text)) output.put(name, text);
            if (Set.of("targetTag", "coverTag", "confirmCoverTag").contains(name) && value instanceof String text
                    && Set.of("INPUT", "BUTTON", "LABEL", "SPAN", "DIV", "SECTION", "SVG", "PATH", "OTHER").contains(text)) output.put(name, text);
            if ("relatedEvent".equals(name) && value instanceof String text && EVENTS.contains(text)) output.put(name, text);
            if (ENUMS.containsKey(name) && value instanceof String text && ENUMS.get(name).contains(text)) output.put(name, text);
            if ("timeZone".equals(name) && value instanceof String text && text.matches("[A-Za-z0-9_+/-]{1,64}")) output.put(name, text);
            if ("expiresAtRaw".equals(name) && value instanceof String text && text.matches("[0-9T:. Z+-]{0,40}")) output.put(name, text);
        });
    }

    private String encode(Map<String, Object> values) {
        Map<String, Object> bounded = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : values.entrySet()) {
            bounded.put(entry.getKey(), entry.getValue());
            try {
                if (json.writeValueAsBytes(bounded).length > 1800) bounded.remove(entry.getKey());
            } catch (JsonProcessingException failure) {
                bounded.remove(entry.getKey());
            }
        }
        try {
            return json.writeValueAsString(bounded);
        } catch (JsonProcessingException failure) {
            return "{}";
        }
    }

    @SuppressWarnings("unchecked")
    private Context find(HttpSession session, String id) {
        if (session == null || id == null || !id.matches("[0-9a-f-]{36}")) return null;
        synchronized (session) {
            Object attribute = session.getAttribute(SESSION_KEY);
            if (!(attribute instanceof Map<?, ?>)) return null;
            Context context = ((Map<String, Context>) attribute).get(id);
            return context != null && System.currentTimeMillis() - context.createdAt() < LIFETIME_MS ? context : null;
        }
    }

    @SuppressWarnings("unchecked")
    private void remember(HttpSession session, String id, Context context) {
        synchronized (session) {
            Map<String, Context> contexts = new LinkedHashMap<>();
            Object attribute = session.getAttribute(SESSION_KEY);
            if (attribute instanceof Map<?, ?>) contexts.putAll((Map<String, Context>) attribute);
            contexts.values().removeIf(item -> System.currentTimeMillis() - item.createdAt() >= LIFETIME_MS);
            while (contexts.size() >= 8) contexts.remove(contexts.keySet().iterator().next());
            contexts.put(id, context);
            session.setAttribute(SESSION_KEY, contexts);
        }
    }

    private String uuid(String value) {
        return value != null && value.matches("[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")
                ? value.toLowerCase(java.util.Locale.ROOT) : UUID.randomUUID().toString();
    }
}
