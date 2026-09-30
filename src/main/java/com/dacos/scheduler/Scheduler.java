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
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.common.CommonService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/scheduler")
@RequiredArgsConstructor
public class Scheduler {

    private static final Logger logger = LoggerFactory.getLogger(Scheduler.class);

    private final SchedulerService schedulerService;
    private final CommonService commonService;

	/** 1분마다 5분 유효시간이 지난 고객 번호판 배정을 회수한다. */
	@Scheduled(cron = "0 * * * * *", zone = "Asia/Seoul")
	public void cleanupExpiredNumplateSelections() {
		schedulerService.cleanupExpiredNumplateSelections();
	}
    
    @Scheduled(cron = "0 0 8 * * *", zone = "Asia/Seoul")
    public void processTodayNewcarWaitingServices() {
    	String serverIp = commonService.getServerAddress("IP");
    	
    	// 운영, 개발 서버에서만 실행되도록 조건 추가
	    if ("10.109.111.40".equals(serverIp) || "210.109.111.140".equals(serverIp) || "172.10.10.2".equals(serverIp)) {
	    	runTodayNewcarWaitingServices("scheduled");
	    }
    }

    @Scheduled(cron = "0 0 15 * * *", zone = "Asia/Seoul")
    public void processTodayNewcarNonPayed() {
    	String serverIp = commonService.getServerAddress("IP");
    	
    	// 운영, 개발 서버에서만 실행되도록 조건 추가
	    if ("10.109.111.40".equals(serverIp) || "210.109.111.140".equals(serverIp) || "172.10.10.2".equals(serverIp)) {
	    	// SP 등록비용 미입금 자동 문자는 다코스 아웃바운드로 대체.
	    	// runTodayNewcarNonPayed("scheduled");
	    	runTodayNewcarCardNonPayed("scheduled");
	    }
    }

    /** 매일 오전 9시에 D-3 이전은 문자를 발송하고 D-2 건은 DCROSS 알림을 등록한다. */
    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")
    public void processNewcarNumplateSelectionReminders() {
        String serverIp = commonService.getServerAddress("IP");

        if ("10.109.111.40".equals(serverIp)
                || "210.109.111.140".equals(serverIp)
                || "172.10.10.2".equals(serverIp)) {
            runNewcarNumplateSelectionReminders("scheduled");
        }
    }

    /** 등록증이 준비된 처리완료 신규등록 건의 메일을 영업시간에 발송한다. */
    @Scheduled(cron = "0 0,30 9-17 * * *", zone = "Asia/Seoul")
    @Scheduled(cron = "0 0 18 * * *", zone = "Asia/Seoul")
    public void processRegistrationMails() {
        String serverIp = commonService.getServerAddress("IP");
        // 등록메일 스케줄은 운영 서버에서만 실행한다.
        if ("10.109.111.40".equals(serverIp)) {
            runRegistrationMails("scheduled");
        }
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

    @RequestMapping(
        value = "/newcar/numplate-selection-reminders/run",
        method = {RequestMethod.GET, RequestMethod.POST}
    )
    public Map<String, Object> runNewcarNumplateSelectionRemindersManually() {
        int sentCount = runNewcarNumplateSelectionReminders("manual");
        return createResult("processNewcarNumplateSelectionReminders", sentCount);
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

    private int runTodayNewcarCardNonPayed(String triggerType) {
    	logger.info("[Scheduler] 카드납부미완료건 처리 start - triggerType: {}", triggerType);
    	int updateCount = schedulerService.processTodayNewcarCardNonPayed();
    	logger.info(
    			"[Scheduler] 카드납부미완료건 처리 완료 - triggerType: {}, updateCount: {}",
    			triggerType,
    			updateCount
    			);
    	return updateCount;
    }

    private int runNewcarNumplateSelectionReminders(String triggerType) {
        logger.info("[Scheduler] 번호판 선택 안내 start - triggerType: {}", triggerType);
        int sentCount = schedulerService.processNewcarNumplateSelectionReminders();
		int alertCount = schedulerService.processNewcarNumplateD2Alerts();
        logger.info(
            "[Scheduler] 번호판 선택 안내 완료 - triggerType: {}, sentCount: {}, alertCount: {}",
            triggerType, sentCount, alertCount
        );
        int paymentCount = schedulerService.processNewcarPaymentReminders();
        logger.info("[Scheduler] 등록비용 재안내 완료 - triggerType: {}, sentCount: {}", triggerType, paymentCount);
        return sentCount + alertCount + paymentCount;
    }

    private int runRegistrationMails(String triggerType) {
        logger.info("[Scheduler] 등록완료 메일 발송 start - triggerType: {}", triggerType);
        int sentCount = schedulerService.processRegistrationMails();
        logger.info("[Scheduler] 등록완료 메일 발송 완료 - triggerType: {}, sentCount: {}",
                triggerType, sentCount);
        return sentCount;
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
