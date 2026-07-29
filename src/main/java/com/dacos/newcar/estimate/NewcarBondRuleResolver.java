package com.dacos.newcar.estimate;

import java.math.BigDecimal;

/**
 * 계산기가 결정한 지역/차량구분/비교값으로 현재 적용 중인 공채 규칙을 조회한다.
 */
@FunctionalInterface
public interface NewcarBondRuleResolver {

    String resolveBondValue(String area, String carGb, BigDecimal compare);
}
