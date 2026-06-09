package com.dacos.common.util;

import java.util.Map;



/**
 * 화면 컬럼명 ↔ DB 컬럼명 매핑 정의
 *
 * 업무별로 화면 컬럼명과 DB 컬럼명이 다른 경우 사용한다.
 *
 * 사용 예)
 *   FieldMapper.convert(data, FieldMaps.OWNER_INFO);
 */
public class FieldMaps {

    /**
     * 공동소유자(TR_OWNERINFO) 컬럼 매핑
     */
    public static final Map<String, String> OWNER_INFO =
            Map.of(
                "DEBTOR_REG_NO", "REG_NO",
                "DEBTOR_BIZ_NO", "BIZ_NO",
                "DEBTOR_REG_GB", "DEBTOR_GB",
                "DEBTOR_TEL_NO", "DSIGN_HP_NO"
            );
}