package com.dacos.scheduler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class Scheduler {

    private static final Logger logger = LoggerFactory.getLogger(Scheduler.class);

    private final SchedulerService schedulerService;

    @Scheduled(cron = "0 0 8 * * *", zone = "Asia/Seoul")
    public void processTodayNewcarWaitingServices() {
        logger.info("[Scheduler] today newcar waiting service scheduler start");
        int updateCount = schedulerService.processTodayNewcarWaitingServices();
        logger.info("[Scheduler] today newcar waiting service scheduler end - updateCount: {}", updateCount);
    }
}
