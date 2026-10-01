package com.dacos.common;

import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.StringJoiner;

import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.mapping.ParameterMapping;
import org.apache.ibatis.mapping.SqlCommandType;
import org.apache.ibatis.plugin.Interceptor;
import org.apache.ibatis.plugin.Intercepts;
import org.apache.ibatis.plugin.Invocation;
import org.apache.ibatis.plugin.Plugin;
import org.apache.ibatis.plugin.Signature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.dacos.auth.AuthController;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.ServiceAccessGuard.ListAccessScope;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

/**
 * HTTP 요청에서 실행되는 TR_SERVICE SELECT의 결과를 로그인 권한 범위로 제한한다.
 *
 * <p>정확한 SERVICE_ID 조회는 SQL 실행 전에 차단하고, 목록 조회는 반환 직전에
 * SERVICE_ID별 권한을 일괄 확인하여 허용된 행만 남긴다. SQL을 동적으로 다시 쓰지
 * 않으므로 기존 Oracle 조인/서브쿼리의 의미를 바꾸지 않는다.</p>
 */
@Component
@Intercepts({
        @Signature(
                type = Executor.class,
                method = "query",
                args = {
                        MappedStatement.class,
                        Object.class,
                        org.apache.ibatis.session.RowBounds.class,
                        org.apache.ibatis.session.ResultHandler.class
                }
        ),
        @Signature(
                type = Executor.class,
                method = "query",
                args = {
                        MappedStatement.class,
                        Object.class,
                        org.apache.ibatis.session.RowBounds.class,
                        org.apache.ibatis.session.ResultHandler.class,
                        org.apache.ibatis.cache.CacheKey.class,
                        BoundSql.class
                }
        )
})
public class TrServiceQueryAccessInterceptor implements Interceptor {

    private static final Logger logger =
            LoggerFactory.getLogger(TrServiceQueryAccessInterceptor.class);
    private static final String REQUEST_CACHE_ATTRIBUTE =
            TrServiceQueryAccessInterceptor.class.getName() + ".serviceScopeCache";
    private static final int ORACLE_IN_CHUNK_SIZE = 900;

    /**
     * 신규 입력 중 전사 중복 여부만 판단하는 쿼리다. 결과의 SERVICE_ID는 화면에
     * 반환되지 않으며, 회사 범위로 숨기면 중복 신청이 허용될 수 있어 필터하지 않는다.
     */
    private static final Set<String> INTERNAL_VALIDATION_QUERY_IDS = Set.of(
            "com.dacos.newcar.mapper.NewcarMapper.selectDuplicateCarIdNO",
            "com.dacos.newcar.mapper.NewcarMapper.selectDuplicateCarIdNO2",
            "com.dacos.newcar.mapper.NewcarMapper.selectDuplicateLinkIdNO");

    /** TR_SERVICE가 LEFT JOIN되어도 미사용 번호판 행은 SERVICE_ID가 없는 정상 공용 데이터다. */
    private static final Set<String> ALLOW_UNASSIGNED_ROWS_QUERY_IDS = Set.of(
            "com.dacos.numplateApp.mapper.NumPlateMapper.getNumPlateList");

    private final JdbcTemplate jdbcTemplate;

    public TrServiceQueryAccessInterceptor(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        MappedStatement statement = (MappedStatement) invocation.getArgs()[0];
        if (!isProtectedSelect(statement)) {
            return invocation.proceed();
        }

        Object parameter = invocation.getArgs()[1];
        BoundSql boundSql = invocation.getArgs().length == 6
                ? (BoundSql) invocation.getArgs()[5]
                : statement.getBoundSql(parameter);

        if (!SearchLogInterceptor.referencesTrService(boundSql.getSql())) {
            return invocation.proceed();
        }

        HttpServletRequest request = currentRequest();
        if (request == null) {
            // 스케줄러와 서버 내부 작업은 HTTP 사용자 조회가 아니다.
            return invocation.proceed();
        }

        UserDto user = sessionUser(request);
        if (user == null) {
            if (isAnonymousBusinessRequest(request)) {
                // 고객 토큰/서버 간 호출은 각 서비스의 전용 토큰 검증을 사용한다.
                return invocation.proceed();
            }
            throw new BusinessException("로그인 정보가 없습니다.", 401);
        }

        ListAccessScope scope = ServiceAccessGuard.listAccessScopeFor(user);
        if ("GLOBAL".equals(scope.scope())) {
            return invocation.proceed();
        }

        String queryId = statement.getId();
        if (INTERNAL_VALIDATION_QUERY_IDS.contains(queryId)) {
            return invocation.proceed();
        }

        Set<String> inputServiceIds = extractInputServiceIds(parameter, boundSql);
        if (!inputServiceIds.isEmpty()) {
            requireServiceAccess(user, inputServiceIds, request);
        }

        Object result = invocation.proceed();
        return filterResult(queryId, result, user, inputServiceIds, request);
    }

    private boolean isProtectedSelect(MappedStatement statement) {
        return statement != null
                && statement.getSqlCommandType() == SqlCommandType.SELECT
                && !statement.getId().contains("!selectKey");
    }

    private Object filterResult(
            String queryId,
            Object result,
            UserDto user,
            Set<String> inputServiceIds,
            HttpServletRequest request) {

        if (!(result instanceof List<?> rows) || rows.isEmpty()) {
            return result;
        }

        Set<String> resultServiceIds = new LinkedHashSet<>();
        for (Object row : rows) {
            String serviceId = text(readProperty(row, "SERVICE_ID"));
            if (!serviceId.isEmpty()) {
                resultServiceIds.add(serviceId);
            }
        }
        Map<String, Map<String, Object>> services =
                loadServiceScopes(resultServiceIds, request);

        List<Object> allowedRows = new ArrayList<>(rows.size());
        int deniedCount = 0;
        for (Object row : rows) {
            String serviceId = text(readProperty(row, "SERVICE_ID"));
            boolean allowed;
            if (!serviceId.isEmpty()) {
                allowed = ServiceAccessGuard.canReadService(
                        user, services.get(normalizeServiceId(serviceId)));
            } else if (!inputServiceIds.isEmpty()) {
                // SERVICE_ID로 선검증한 상세/상태 조회 결과가 단일 값일 수 있다.
                allowed = true;
            } else if (ALLOW_UNASSIGNED_ROWS_QUERY_IDS.contains(queryId)) {
                allowed = true;
            } else {
                allowed = ServiceAccessGuard.canReadService(user, scopeFromRow(row));
            }

            if (allowed) {
                allowedRows.add(row);
            } else {
                deniedCount++;
            }
        }

        if (deniedCount > 0) {
            logger.warn(
                    "[TR_SERVICE 조회 권한] 범위 밖 결과 제거 - queryId: {}, userId: {}, count: {}",
                    queryId,
                    user.getLOGIN_ID(),
                    deniedCount);
        }
        return allowedRows;
    }

    private void requireServiceAccess(
            UserDto user,
            Set<String> serviceIds,
            HttpServletRequest request) {

        Map<String, Map<String, Object>> services = loadServiceScopes(serviceIds, request);
        for (String serviceId : serviceIds) {
            Map<String, Object> service = services.get(normalizeServiceId(serviceId));
            if (!ServiceAccessGuard.canReadService(user, service)) {
                logger.warn(
                        "[TR_SERVICE 조회 권한] 접수번호 조회 차단 - userId: {}",
                        user.getLOGIN_ID());
                // 접수번호 존재 여부를 권한 없는 사용자에게 노출하지 않는다.
                throw new BusinessException("접수 정보를 찾을 수 없습니다.", 404);
            }
        }
    }

    private Map<String, Map<String, Object>> loadServiceScopes(
            Collection<String> serviceIds,
            HttpServletRequest request) {

        Map<String, Map<String, Object>> cache = requestScopeCache(request);
        List<String> missing = serviceIds.stream()
                .map(this::text)
                .filter(value -> !value.isEmpty())
                .filter(value -> !cache.containsKey(normalizeServiceId(value)))
                .distinct()
                .toList();

        for (int start = 0; start < missing.size(); start += ORACLE_IN_CHUNK_SIZE) {
            int end = Math.min(start + ORACLE_IN_CHUNK_SIZE, missing.size());
            List<String> chunk = missing.subList(start, end);
            StringJoiner placeholders = new StringJoiner(",");
            chunk.forEach(ignored -> placeholders.add("?"));

            String sql = "SELECT SERVICE_ID, COMPANY_ID, BRANCH_ID, SANGSA_ID, MEMBER_ID, GOVT_ID "
                    + "FROM TR_SERVICE WHERE SERVICE_ID IN (" + placeholders + ")";
            List<Map<String, Object>> found = jdbcTemplate.queryForList(sql, chunk.toArray());
            for (Map<String, Object> service : found) {
                String serviceId = text(readProperty(service, "SERVICE_ID"));
                if (!serviceId.isEmpty()) {
                    cache.put(normalizeServiceId(serviceId), service);
                }
            }
            for (String serviceId : chunk) {
                cache.putIfAbsent(normalizeServiceId(serviceId), Collections.emptyMap());
            }
        }
        return cache;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Map<String, Object>> requestScopeCache(HttpServletRequest request) {
        Object cached = request.getAttribute(REQUEST_CACHE_ATTRIBUTE);
        if (cached instanceof Map<?, ?>) {
            return (Map<String, Map<String, Object>>) cached;
        }
        Map<String, Map<String, Object>> cache = new HashMap<>();
        request.setAttribute(REQUEST_CACHE_ATTRIBUTE, cache);
        return cache;
    }

    private Set<String> extractInputServiceIds(Object parameter, BoundSql boundSql) {
        Set<String> serviceIds = new LinkedHashSet<>();
        collectNamedServiceIds(parameter, serviceIds);

        if (serviceIds.isEmpty() && isScalar(parameter)) {
            for (ParameterMapping mapping : boundSql.getParameterMappings()) {
                if (isServiceIdKey(mapping.getProperty())) {
                    addServiceIdValue(parameter, serviceIds);
                    break;
                }
            }
        }
        return serviceIds;
    }

    private void collectNamedServiceIds(Object source, Set<String> serviceIds) {
        if (source == null) {
            return;
        }
        if (source instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (isServiceIdKey(String.valueOf(entry.getKey()))) {
                    addServiceIdValue(entry.getValue(), serviceIds);
                }
            }
            return;
        }

        for (Method method : source.getClass().getMethods()) {
            if (method.getParameterCount() != 0 || !method.getName().startsWith("get")) {
                continue;
            }
            if (!isServiceIdKey(method.getName().substring(3))) {
                continue;
            }
            try {
                addServiceIdValue(method.invoke(source), serviceIds);
            } catch (ReflectiveOperationException e) {
                logger.debug("SERVICE_ID getter read failed: {}", method.getName(), e);
            }
        }
    }

    private void addServiceIdValue(Object value, Set<String> serviceIds) {
        if (value == null) {
            return;
        }
        if (value instanceof Collection<?> collection) {
            collection.forEach(item -> addServiceIdValue(item, serviceIds));
            return;
        }
        if (value.getClass().isArray()) {
            for (int i = 0; i < Array.getLength(value); i++) {
                addServiceIdValue(Array.get(value, i), serviceIds);
            }
            return;
        }
        String serviceId = text(value);
        if (!serviceId.isEmpty() && !"null".equalsIgnoreCase(serviceId)) {
            serviceIds.add(serviceId);
        }
    }

    private Map<String, Object> scopeFromRow(Object row) {
        Map<String, Object> service = new HashMap<>();
        copyProperty(row, service, "COMPANY_ID");
        copyProperty(row, service, "BRANCH_ID");
        copyProperty(row, service, "SANGSA_ID");
        copyProperty(row, service, "MEMBER_ID");
        copyProperty(row, service, "GOVT_ID");
        return service;
    }

    private void copyProperty(Object source, Map<String, Object> target, String key) {
        Object value = readProperty(source, key);
        if (value != null) {
            target.put(key, value);
        }
    }

    private Object readProperty(Object source, String key) {
        if (source == null) {
            return null;
        }
        if (source instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (normalizeKey(String.valueOf(entry.getKey())).equals(normalizeKey(key))) {
                    return entry.getValue();
                }
            }
            return null;
        }

        String normalizedKey = normalizeKey(key);
        for (Method method : source.getClass().getMethods()) {
            if (method.getParameterCount() == 0 && method.getName().startsWith("get")
                    && normalizeKey(method.getName().substring(3)).equals(normalizedKey)) {
                try {
                    return method.invoke(source);
                } catch (ReflectiveOperationException e) {
                    logger.debug("result getter read failed: {}", method.getName(), e);
                    return null;
                }
            }
        }
        for (Field field : source.getClass().getDeclaredFields()) {
            if (!normalizeKey(field.getName()).equals(normalizedKey)) {
                continue;
            }
            try {
                field.setAccessible(true);
                return field.get(source);
            } catch (ReflectiveOperationException e) {
                logger.debug("result field read failed: {}", field.getName(), e);
                return null;
            }
        }
        return null;
    }

    private boolean isServiceIdKey(String key) {
        String normalized = normalizeKey(key);
        return "SERVICEID".equals(normalized) || "SERVICEIDS".equals(normalized);
    }

    private boolean isScalar(Object value) {
        return value instanceof CharSequence || value instanceof Number;
    }

    private String normalizeKey(String value) {
        return value == null ? "" : value.replace("_", "").toUpperCase(Locale.ROOT);
    }

    private String normalizeServiceId(String value) {
        return text(value).toUpperCase(Locale.ROOT);
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private HttpServletRequest currentRequest() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) {
            return null;
        }
        return attributes.getRequest();
    }

    private UserDto sessionUser(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return null;
        }
        Object user = session.getAttribute(AuthController.SESSION_USER);
        return user instanceof UserDto ? (UserDto) user : null;
    }

    private boolean isAnonymousBusinessRequest(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri != null
                && (uri.startsWith("/api/customer/")
                    || uri.startsWith("/api/internal/registration-mail/"));
    }

    @Override
    public Object plugin(Object target) {
        return Plugin.wrap(target, this);
    }
}
