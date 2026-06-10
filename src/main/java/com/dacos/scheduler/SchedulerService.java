package com.dacos.scheduler;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dacos.common.CommonService;
import com.dacos.scheduler.dto.SchedulerDto;
import com.dacos.scheduler.mapper.SchedulerMapper;
import com.fasterxml.jackson.databind.JsonNode;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SchedulerService {

    private static final Logger logger = LoggerFactory.getLogger(SchedulerService.class);

    
    
    private final SchedulerMapper schedulerMapper;
    @Autowired
    private CommonService commonService;
    
    @Transactional
    public int processTodayNewcarWaitingServices() {
        List<SchedulerDto> targetList = schedulerMapper.selectNewcarWaitingServices();

        if (targetList == null || targetList.isEmpty()) {
            logger.info("[SchedulerService] 처리할 건 없음");
            return 0;
        }

        int updateCount = 0;

        for (SchedulerDto target : targetList) {
            String SMS_TEXT = "안녕하세요. 폴스타코리아 온라인 대행업체입니다.\r\r\n"
                                                    + target.getCAR_NO() +"차량의 등록 접수가 완료되었으며 고객님께서 동의하신 내용 중 중요한 내용을 다시 한번 안내 해 드립니다.\r\n"
                                                    +"아래의 내용을 반드시 확인하시기 바랍니다.\r\r\n"
                                                    +"· 취득세 감면 조건 위반 등으로 인한 추징 안내\r\n"
                                                    +"감면 조건위반 등으로 추후 추징 대상이 될 경우 감면된 지방세를 징수하며, 추징금 발생 60일 이내 지자체에 미신고 시 별도의 가산세가 부과됩니다.\r\r\n"
                                                    +"저공해 등록 정보는 신규등록 완료 후 확인 가능하니 참고하시기 바랍니다.\r\r\n"
                                                    +"※ 본 발신번호는 발신전용으로 전화 및 문자 수신이 불가합니다. 관련 문의 사항은 폴스타코리아 담당자에게 연락 바랍니다. \r\n"
                                                    +"담당자 연락처 : 080-360-0100";

            String serviceId = target.getSERVICE_ID();
            String smsText = SMS_TEXT;
            
            // 심사요청 문자 발송
            Map<String, Object> param = new HashMap<>();
            param.put("PAY_HP_NO", target.getMPHONE_NO());
            param.put("TEXT", smsText);
            param.put("MSG_TYPE", "3"); // 예: SMS 메시지 유형
            int result = commonService.sendSms(param);
            logger.info("[SchedulerService] sms text prepared - serviceId: {}, smsText: {}", serviceId, smsText);

            // 심사요청으로 상태 변경
            updateCount += schedulerMapper.updateServiceToJudgeRequest(serviceId);

            //JsonNode jsonResponse = commonService.linkServer(linkData);
            
        }

        return updateCount;
    }

    public int processTodayNewcarNonPayed() {
        List<SchedulerDto> targetList = schedulerMapper.selectNewcarNonPayedServices();

        if (targetList == null || targetList.isEmpty()) {
            logger.info("[SchedulerService] 처리할 건 없음");
            return 0;
        }

        int updateCount = 0;

        for (SchedulerDto target : targetList) {
            String SMS_TEXT = "[폴스타코리아 미입금 확인] 고객의 등록비용이 아직 입금되지 않았습니다. 고객에게 입금 요청 부탁드립니다.";
            String serviceId = target.getSERVICE_ID();
            String smsText = SMS_TEXT;
            
            // 심사요청 문자 발송
            Map<String, Object> param = new HashMap<>();
            param.put("PAY_HP_NO", target.getMPHONE_NO());
            param.put("TEXT", smsText);
            param.put("MSG_TYPE", "3"); // 예: SMS 메시지 유형
            int result = commonService.sendSms(param);
            logger.info("[SchedulerService] sms text prepared - serviceId: {}, smsText: {}", serviceId, smsText);

            // 심사요청으로 상태 변경
            updateCount += schedulerMapper.updateServiceToJudgeRequest(serviceId);

            //JsonNode jsonResponse = commonService.linkServer(linkData);
            
        }

        return updateCount;
        
    }
}
