package com.dacos.util;

import com.p6spy.engine.spy.P6SpyOptions; // 추가
import com.p6spy.engine.spy.appender.MessageFormattingStrategy;
import jakarta.annotation.PostConstruct; // 추가 (Java 21 기준)
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class P6SpySqlFormatter implements MessageFormattingStrategy {

    // ✅ 핵심 추가: 스프링이 켜질 때 P6Spy의 기본 포맷터를 이 클래스로 강제 교체합니다.
    @PostConstruct
    public void setLogMessageFormat() {
        P6SpyOptions.getActiveInstance().setLogMessageFormat(this.getClass().getName());
    }

    @Override
    public String formatMessage(int connectionId, String now, long elapsed, String category, String prepared, String sql, String url) {
        
        // 1. statement(쿼리)가 아니거나 쿼리가 비어있으면 아예 무시 (찌꺼기 로그 완벽 차단)
        if (!"statement".equals(category) || !StringUtils.hasText(sql)) {
            return "";
        }

        // 2. 쿼리 다듬기
        String trimmedSql = sql.trim();
        trimmedSql = trimmedSql.replaceAll("(?m)^\\s*\\n", ""); 

        // 3. 최종 출력
        return String.format("[%d ms] | SQL 실행: %n%s", elapsed, trimmedSql);
    }
}