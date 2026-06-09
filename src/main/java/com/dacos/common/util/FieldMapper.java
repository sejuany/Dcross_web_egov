package com.dacos.common.util;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;



/**
 * 화면 컬럼명 → DB 컬럼명 변환 유틸
 *
 * 사용 목적
 * - 화면(dataset)에서 사용하는 컬럼명과
 *   DB 테이블 컬럼명이 다른 경우 사용
 * - 예) 화면에서는 DEBTOR_REG_NO로 사용하지만 DB에서는 REG_NO로 저장하는 경우
 * - 한 화면에 같은 컬럼명이 있으면 안 되기 때문에 DEBTOR_REG_NO, DEBTOR_BIZ_NO 등으로 구분해서 사용한다.
 *  
 * 예)
 *   DEBTOR_REG_NO   → REG_NO
 *   DEBTOR_BIZ_NO   → BIZ_NO
 *   DEBTOR_REG_GB   → DEBTOR_GB
 *   DEBTOR_MPHONE_NO → DSIGN_HP_NO
 *
 * 특징
 * - 원본 Map은 유지
 * - 변환된 컬럼은 신규 Key로 추가
 * - null 값은 제외
 * - 공통 사용 가능 (OWNERINFO, MORTGAGE, PAYMENT 등)
 */
public class FieldMapper {

    public static Map<String, Object> convert(
            Map<String, Object> source,
            Map<String, String> fieldMap) {

        if (source == null) {
            return null;
        }

        Map<String, Object> result = new HashMap<>(source);

        for (Map.Entry<String, String> entry : fieldMap.entrySet()) {

            Object value = source.get(entry.getKey());

            if (value != null) {
                result.put(entry.getValue(), value);
            }
        }

        return result;
    }

    public static List<Map<String, Object>> convert(
            List<Map<String, Object>> list,
            Map<String, String> fieldMap) {

        if (list == null) {
            return Collections.emptyList();
        }

        return list.stream()
                .map(item -> convert(item, fieldMap))
                .collect(Collectors.toList());
    }
}