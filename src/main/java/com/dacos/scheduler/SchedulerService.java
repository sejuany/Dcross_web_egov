package com.dacos.scheduler;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dacos.addservice.dto.AddServiceDto;
import com.dacos.common.CommonRepository;
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
    @Autowired
    private CommonRepository common; // DB 접근 역할
    
    @Transactional
    public int processTodayNewcarWaitingServices() {
        List<SchedulerDto> targetList = schedulerMapper.selectNewcarWaitingServices();

        if (targetList == null || targetList.isEmpty()) {
            logger.info("[SchedulerService] 처리할 건 없음");
            return 0;
        }

        int updateCount = 0;

        for (SchedulerDto target : targetList) {            
            // SP담당 연락처 추가
 			SchedulerDto specialistInfo = schedulerMapper.selectNewcarSpecialistInfo(target.getMEMBER_ID());
                
 			
            String SMS_TEXT = "안녕하세요. 폴스타코리아 온라인 대행업체입니다.\n" + target.getCAR_NO() +"차량의 신규등록이 접수되었습니다.\n\n" +
                              "※ 본 발신번호는 발신전용으로 전화 및 문자 수신이 불가합니다. 관련 문의 사항은 담당 스페셜리스트에게 연락 바랍니다. \n" +
                              "연락처 : "+specialistInfo.getSPECIALIST_HP_NO();
            
            String serviceId = target.getSERVICE_ID();
            String smsText = SMS_TEXT;
            
            // 심사요청 문자 발송
            Map<String, Object> param = new HashMap<>();
            param.put("PAY_HP_NO", specialistInfo.getSPECIALIST_HP_NO());  // 고객 연락처
            param.put("TEXT", smsText);                     // 문자 내용    
            param.put("MSG_TYPE", "3");               // 문자메세지 유형 1:SMS, 3: LMS
            int result = commonService.sendSms(param);
            logger.info("[SchedulerService] SMS문자 발송완료 - serviceId: {}, 문자내용: {}", serviceId, smsText);

            // 심사요청으로 상태 변경
            updateCount += schedulerMapper.updateServiceToJudgeRequest(serviceId);

            //JsonNode jsonResponse = commonService.linkServer(linkData);
            
        }

        return updateCount;
    }

    public int processTodayNewcarNonPayed() {
        // 내일 등록예정인 건들 중에서 15:30분 이후에도 입금이 안된 건들을 조회
        try {
            List<SchedulerDto> targetList = schedulerMapper.selectNewcarNonPayedServices();

            if (targetList == null || targetList.isEmpty()) {
                logger.info("[SchedulerService] 처리할 건 없음");
                return 0;
            }

            int updateCount = 0;

            // targetList에서 MEMBER_ID가 같은건끼리 묶어서 문자를 한번에 보내보자
            Map<String, List<SchedulerDto>> memberGroupedTargets = new HashMap<>();

            for (SchedulerDto target : targetList) {
                // MEMBER_ID를 키로 해서 같은 MEMBER_ID를 가진 건들을 리스트로 묶음
                // computeIfAbsent는 키가 존재하지 않으면 새로운 ArrayList를 생성해서 넣어주고, 존재하면 기존 리스트를 반환
                memberGroupedTargets.computeIfAbsent(target.getMEMBER_ID(), k -> new ArrayList<>()).add(target);
            }
            logger.info("memberGroupedTargets : {}", memberGroupedTargets);

            for (List<SchedulerDto> targets : memberGroupedTargets.values()) {
                // 같은 MEMBER_ID를 가진 건들에 대해 한 번에 문자 발송
                String SMS_TEXT = "[폴스타코리아 미입금 확인] ";
                for (SchedulerDto target : targets) {
                    SMS_TEXT += target.getCUSTOMER_NM() + ", ";
                }
                SMS_TEXT = SMS_TEXT + " 고객의 등록비용이 아직 입금되지 않았습니다. 고객에게 입금 요청 부탁드립니다.";
                logger.info("SMS_TEXT: {}", SMS_TEXT);

                // 심사요청 문자 발송
                Map<String, Object> param = new HashMap<>();

                // 담당자의 연락처로 문자 발송 
                // 담당자 연락처 조회
                SchedulerDto specialistInfo = schedulerMapper.selectNewcarSpecialistInfo(targets.get(0).getMEMBER_ID());
                param.put("PAY_HP_NO", specialistInfo.getSPECIALIST_HP_NO());
                param.put("TEXT", SMS_TEXT);
                param.put("MSG_TYPE", "3"); // 예: SMS 메시지 유형
                int result = commonService.sendSms(param);
                logger.info("[SchedulerService] 문자 발송 완료~! - getSPECIALIST_HP_NO: {}, SMS_TEXT: {}", specialistInfo.getSPECIALIST_HP_NO(), SMS_TEXT);
                updateCount += result;
            }
            
            return updateCount;
        } catch (Exception e) {
            e.printStackTrace();
            logger.error("[SchedulerService] 등록예정-1일 15:30분 이후 미입금건 알림 문자 발송 중 오류 발생: {}", e.getMessage());
            return 0;
        }
        
        
    }
}
