package com.dacos.newcar.estimate;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;

import org.springframework.stereotype.Component;

import com.dacos.common.BusinessException;
import com.dacos.newcar.mapper.NewcarMapper;

import lombok.RequiredArgsConstructor;

/**
 * TM_BOND에서 운영 프로시저와 동일한 현재 공채 규칙을 조회한다.
 */
@Component
@RequiredArgsConstructor
public class DatabaseNewcarBondRuleResolver implements NewcarBondRuleResolver {

    private final NewcarMapper newcarMapper;

    @Override
    public String resolveBondValue(String area, String carGb, BigDecimal compare) {
        Map<String, Object> rule = newcarMapper.getActiveBondRule(area, carGb, compare);

        if (rule == null || rule.isEmpty()) {
            throw new BusinessException(
                    "TM_BOND에서 적용 가능한 공채 규칙을 찾을 수 없습니다: "
                            + area + " / " + carGb + " / " + compare,
                    404);
        }

        String value = Objects.toString(rule.get("BOND_VALUE"), "").trim();
        if (value.isEmpty()) {
            throw new BusinessException("TM_BOND 공채 규칙의 VALUE가 비어 있습니다.", 500);
        }
        return value;
    }
}
