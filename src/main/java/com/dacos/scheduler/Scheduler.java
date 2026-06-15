package com.dacos.scheduler;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/scheduler")
@RequiredArgsConstructor
public class Scheduler {

    private static final Logger logger = LoggerFactory.getLogger(Scheduler.class);

    private final SchedulerService schedulerService;

    @Scheduled(cron = "0 0 8 * * *", zone = "Asia/Seoul")
    public void processTodayNewcarWaitingServices() {
        runTodayNewcarWaitingServices("scheduled");
    }

    @Scheduled(cron = "0 30 15 * * *", zone = "Asia/Seoul")
    public void processTodayNewcarNonPayed() {
        runTodayNewcarNonPayed("scheduled");
    }

    @GetMapping("/newcar/waiting-services/run")
    @PostMapping("/newcar/waiting-services/run")
    public Map<String, Object> runTodayNewcarWaitingServicesManually() {
        int updateCount = runTodayNewcarWaitingServices("manual");
        return createResult("processTodayNewcarWaitingServices", updateCount);
    }

    @GetMapping("/newcar/non-payed/run")
    @PostMapping("/newcar/non-payed/run")
    public Map<String, Object> runTodayNewcarNonPayedManually() {
        int updateCount = runTodayNewcarNonPayed("manual");
        return createResult("processTodayNewcarNonPayed", updateCount);
    }

    @GetMapping("/newcar/run-all")
    @PostMapping("/newcar/run-all")
    public Map<String, Object> runAllNewcarSchedulersManually() {
        int waitingServicesUpdateCount = runTodayNewcarWaitingServices("manual");
        int nonPayedUpdateCount = runTodayNewcarNonPayed("manual");

        Map<String, Object> result = createResult(
            "processAllNewcarSchedulers",
            waitingServicesUpdateCount + nonPayedUpdateCount
        );
        result.put("waitingServicesUpdateCount", waitingServicesUpdateCount);
        result.put("nonPayedUpdateCount", nonPayedUpdateCount);
        return result;
    }

    private int runTodayNewcarWaitingServices(String triggerType) {
        logger.info("[Scheduler] 납부완료건 신청 처리 start - triggerType: {}", triggerType);
        int updateCount = schedulerService.processTodayNewcarWaitingServices();
        logger.info(
            "[Scheduler] 납부완료건 신청 처리 완료 - triggerType: {}, updateCount: {}",
            triggerType,
            updateCount
        );
        return updateCount;
    }

    private int runTodayNewcarNonPayed(String triggerType) {
        logger.info("[Scheduler] 납부미완료건 처리 start - triggerType: {}", triggerType);
        int updateCount = schedulerService.processTodayNewcarNonPayed();
        logger.info(
            "[Scheduler] 납부미완료건 처리 완료 - triggerType: {}, updateCount: {}",
            triggerType,
            updateCount
        );
        return updateCount;
    }

    private Map<String, Object> createResult(String jobName, int updateCount) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("jobName", jobName);
        result.put("updateCount", updateCount);
        result.put("executedAt", LocalDateTime.now().toString());
        return result;
    }
}
