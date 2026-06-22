package com.dacos.common;

import com.dacos.auth.dto.UserDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.MappedStatement;
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

import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;
import java.util.StringJoiner;

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
                        org.apache.ibatis.mapping.BoundSql.class
                }
        )
})
public class SearchLogInterceptor implements Interceptor {

    private static final Logger logger = LoggerFactory.getLogger(SearchLogInterceptor.class);
    private static final int CONDITION_MAX_LENGTH = 3900;

    private final JdbcTemplate jdbcTemplate;

    public SearchLogInterceptor(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        MappedStatement statement = (MappedStatement) invocation.getArgs()[0];

        if (isSearchTarget(statement)) {
            Object parameter = invocation.getArgs()[1];
            insertSearchLog(statement.getId(), parameter);
        }

        return invocation.proceed();
    }

    private boolean isSearchTarget(MappedStatement statement) {
        return statement != null
                && statement.getSqlCommandType() == SqlCommandType.SELECT
                && !statement.getId().contains("!selectKey");
    }

    private void insertSearchLog(String queryId, Object parameter) {
        try {
            UserDto user = getSessionUser();
            String conditionText = limit(toConditionText(parameter), CONDITION_MAX_LENGTH);
            String workCd = extractWorkCd(parameter);

            jdbcTemplate.update(
                    "INSERT INTO TS_SEARCH_LOG ("
                            + "COMPANY_ID, BRANCH_ID, SANGSA_ID, MEMBER_ID, "
                            + "CONDITION_TX, QUERY_ID, INS_DATE, WORK_CD"
                            + ") VALUES (?, ?, ?, ?, ?, ?, SYSDATE, ?)",
                    user == null ? null : user.getCOMPANY_ID(),
                    user == null ? null : user.getBRANCH_ID(),
                    user == null ? null : user.getSANGSA_ID(),
                    user == null ? null : user.getLOGIN_ID(),
                    conditionText,
                    queryId,
                    workCd
            );
        } catch (Exception e) {
            logger.error("[SearchLogInterceptor] TS_SEARCH_LOG insert failed - queryId: {}", queryId, e);
        }
    }

    private String extractWorkCd(Object parameter) {
        Object value = findValue(parameter, "WORK_CD");

        if (value == null) {
            value = findValue(parameter, "workCd");
        }

        if (value == null) {
            value = findValue(parameter, "work_cd");
        }

        String workCd = value == null ? "" : String.valueOf(value).trim();
        return workCd.isEmpty() || "null".equalsIgnoreCase(workCd) ? "" : workCd;
    }

    private Object findValue(Object source, String key) {
        if (source == null || key == null) {
            return null;
        }

        if (source instanceof Map<?, ?>) {
            Map<?, ?> map = (Map<?, ?>) source;

            if (map.containsKey(key)) {
                return map.get(key);
            }

            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (key.equalsIgnoreCase(String.valueOf(entry.getKey()))) {
                    return entry.getValue();
                }
            }

            return null;
        }

        Object getterValue = invokeGetter(source, key);

        if (getterValue != null) {
            return getterValue;
        }

        return readField(source, key);
    }

    private Object invokeGetter(Object source, String key) {
        String normalizedKey = key.replace("_", "");

        for (Method method : source.getClass().getMethods()) {
            if (method.getParameterCount() != 0) {
                continue;
            }

            String methodName = method.getName();

            if (!methodName.startsWith("get")) {
                continue;
            }

            String propertyName = methodName.substring(3).replace("_", "");

            if (!normalizedKey.equalsIgnoreCase(propertyName)) {
                continue;
            }

            try {
                return method.invoke(source);
            } catch (Exception e) {
                logger.debug("[SearchLogInterceptor] getter read failed - method: {}", methodName, e);
                return null;
            }
        }

        return null;
    }

    private Object readField(Object source, String key) {
        for (Field field : source.getClass().getDeclaredFields()) {
            if (!key.equalsIgnoreCase(field.getName())) {
                continue;
            }

            try {
                field.setAccessible(true);
                return field.get(source);
            } catch (Exception e) {
                logger.debug("[SearchLogInterceptor] field read failed - field: {}", field.getName(), e);
                return null;
            }
        }

        return null;
    }

    private UserDto getSessionUser() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();

        if (attributes == null) {
            return null;
        }

        HttpServletRequest request = attributes.getRequest();
        HttpSession session = request.getSession(false);

        if (session == null) {
            return null;
        }

        Object user = session.getAttribute("user");
        return user instanceof UserDto ? (UserDto) user : null;
    }

    private String toConditionText(Object value) {
        Object sanitized = sanitize(value);
        return sanitized == null ? "{}" : String.valueOf(sanitized);
    }

    private Object sanitize(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof Map<?, ?>) {
            Map<?, ?> source = (Map<?, ?>) value;
            Map<String, Object> target = new LinkedHashMap<>();

            for (Map.Entry<?, ?> entry : source.entrySet()) {
                String key = String.valueOf(entry.getKey());
                target.put(key, isSensitiveKey(key) ? "***" : sanitize(entry.getValue()));
            }

            return target;
        }

        if (value instanceof Collection<?>) {
            Collection<?> source = (Collection<?>) value;
            StringJoiner joiner = new StringJoiner(", ", "[", "]");

            for (Object item : source) {
                joiner.add(String.valueOf(sanitize(item)));
            }

            return joiner.toString();
        }

        if (value.getClass().isArray()) {
            StringJoiner joiner = new StringJoiner(", ", "[", "]");
            int length = Array.getLength(value);

            for (int i = 0; i < length; i++) {
                joiner.add(String.valueOf(sanitize(Array.get(value, i))));
            }

            return joiner.toString();
        }

        return value;
    }

    private boolean isSensitiveKey(String key) {
        String upperKey = key == null ? "" : key.toUpperCase();
        return upperKey.contains("PASS")
                || upperKey.contains("PWD")
                || upperKey.contains("PASSWORD");
    }

    private String limit(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }

        return value.substring(0, maxLength);
    }

    @Override
    public Object plugin(Object target) {
        return Plugin.wrap(target, this);
    }

    @Override
    public void setProperties(Properties properties) {
    }
}
