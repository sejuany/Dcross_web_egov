package com.dacos.scheduler;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.springframework.beans.BeanUtils;

import com.dacos.common.CommonService;

class SchedulerConstructorTest {
    @Test
    void springCanInstantiateSchedulerWithoutStartingJobs() throws NoSuchMethodException {
        var constructor = Scheduler.class.getConstructor(SchedulerService.class, CommonService.class);
        assertNotNull(assertDoesNotThrow(() -> BeanUtils.instantiateClass(constructor, null, null)));
    }
}
