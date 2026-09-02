package com.dacos.scheduler;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

import com.dacos.scheduler.dto.SchedulerDto;
import com.dacos.scheduler.mapper.SchedulerMapper;

class SchedulerServiceTest {

    @Test
    void changesStatusWhenCustomerPhoneIsMissing() {
        SchedulerDto target = new SchedulerDto();
        target.setSERVICE_ID("R011-1");
        target.setPROC_ST("P_END");

        AtomicInteger updateCalls = new AtomicInteger();
        SchedulerMapper mapper = (SchedulerMapper) Proxy.newProxyInstance(
                SchedulerMapper.class.getClassLoader(),
                new Class<?>[] { SchedulerMapper.class },
                (proxy, method, args) -> switch (method.getName()) {
                    case "selectNewcarWaitingServices" -> List.of(target);
                    case "updateServiceToJudgeRequest" -> {
                        updateCalls.incrementAndGet();
                        yield 1;
                    }
                    default -> throw new UnsupportedOperationException(method.getName());
                });

        SchedulerService service = new SchedulerService(mapper, null, null);

        assertEquals(1, service.processTodayNewcarWaitingServices());
        assertEquals(1, updateCalls.get());
    }
}
