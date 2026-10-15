package com.dacos.newcar;

import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;

@Service
public class NumplateActionService {
    private static final Logger logger = LoggerFactory.getLogger(NumplateActionService.class);
    private final CommonRepository common;
    private final NumplateSelectionService selection;
    private final TransactionTemplate transaction;

    public NumplateActionService(CommonRepository common, NumplateSelectionService selection,
            PlatformTransactionManager transactionManager) {
        this.common = common;
        this.selection = selection;
        this.transaction = new TransactionTemplate(transactionManager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
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

    // 트랜잭션 프록시가 커밋/롤백을 끝낸 뒤 결과를 별도 트랜잭션에 기록한다.
    public Map<String, Object> confirm(Map<String, Object> param) {
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

    private int record(Map<String, Object> param, String event, String requestId, String detail) {
        String token = Objects.toString(param.get("TOKEN"), "").trim();
        int nested = token.lastIndexOf("?t=");
        if (nested >= 0) token = token.substring(nested + 3).trim();
        String carNo = Objects.toString(param.get("CAR_NO"), "").trim();
        if (!token.matches("[A-Za-z0-9_-]{20,128}") || carNo.isBlank()
                || carNo.length() > 20 || carNo.chars().anyMatch(Character::isISOControl)) {
            throw new BusinessException("행동 기록 요청이 올바르지 않습니다.");
        }
        Map<String, Object> work = Map.of("TOKEN", token, "CAR_NO", carNo,
                "EVENT_CD", event, "REQUEST_ID", requestId, "DETAIL_TX", detail);
        try {
            Integer count = transaction.execute(status -> common.insert(work, "insertNumplateAction"));
            return count == null ? 0 : count;
        } catch (RuntimeException e) {
            // 이력 장애가 고객의 실제 번호 확정을 막지 않도록 하되 토큰/SQL은 출력하지 않는다.
            logger.error("[번호판 행동 이력 저장 실패] event={}, requestId={}, cause={}",
                    event, requestId, e.getClass().getSimpleName());
            return -1;
        }
    }
}
