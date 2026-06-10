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
        logger.info("[Scheduler] 심사대기 -> 심사요청 스케쥴러 동작 시작");
        int updateCount = schedulerService.processTodayNewcarWaitingServices();
        logger.info("[Scheduler] 심사대기 -> 심사요청 스케쥴러 동작 완료 - updateCount: {}", updateCount);
    }

    @Scheduled(cron = "0 0 8 * * *", zone = "Asia/Seoul")
    public void processTodayNewcarNonPayed() {
        logger.info("[Scheduler] 등록예정일 15:30분 이후 미입금건 알림 문자 발송 스케쥴러 동작 시작");
        int updateCount = schedulerService.processTodayNewcarNonPayed();
        logger.info("[Scheduler] 등록예정일 15:30분 이후 미입금건 알림 문자 발송 스케쥴러 동작 완료 - updateCount: {}", updateCount);
    }
}
