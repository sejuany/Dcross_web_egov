package com.dacos.scheduler;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dacos.common.CommonService;
import com.dacos.scheduler.dto.SchedulerDto;
import com.dacos.scheduler.mapper.SchedulerMapper;


@Service
public class SchedulerService {

    private static final Logger logger = LoggerFactory.getLogger(SchedulerService.class);

    
    
    private final SchedulerMapper schedulerMapper;
    private final CommonService commonService;

    public SchedulerService(SchedulerMapper schedulerMapper, CommonService commonService) {
        this.schedulerMapper = schedulerMapper;
        this.commonService = commonService;
    }
    
    @Transactional
    public int processTodayNewcarWaitingServices() {
        // 오늘 등록예정일 건들 중 '납부완료','심사대기'상태인 것들 조회하여 심사요청으로 변경하는 스케쥴
        List<SchedulerDto> targetList = schedulerMapper.selectNewcarWaitingServices();

        if (targetList == null || targetList.isEmpty()) {
            logger.info("[SchedulerService] 처리할 건 없음");
            return 0;
        }

        int updateCount = 0;

        for (SchedulerDto target : targetList) {
            String serviceId = target.getSERVICE_ID();

            try {
                if (isBlank(target.getMPHONE_NO())) {
                    logger.warn("[SchedulerService] SMS 발송 제외 - 고객 연락처 없음, serviceId: {}", serviceId);
                    continue;
                }

                SchedulerDto specialistInfo = schedulerMapper.selectNewcarSpecialistInfo(target.getMEMBER_ID());
                String specialistPhone = specialistInfo == null ? "" : specialistInfo.getSPECIALIST_HP_NO();
                String smsText = "";
                
                // WA로 시작하는 회사 문자 처리
                if (target.getCOMPANY_ID() != null && target.getCOMPANY_ID().substring(0,2).equals("WA")) {
                     if (target.getCOMPANY_ID().equals("WA001")) {
                            smsText = "안녕하세요. 폴스타코리아 온라인 대행업체입니다.\n"
                            + safeValue(target.getCAR_NO()) + "차량의 신규등록이 접수되었습니다.\n\n"
                            + "※ 본 발신번호는 발신전용으로 전화 및 문자 수신이 불가합니다. 관련 문의 사항은 담당 스페셜리스트에게 연락 바랍니다."
                            + (isBlank(specialistPhone) ? "" : "\n연락처 : " + specialistPhone);    
                     }
                     else {
                        smsText = "안녕하세요. 신규등록 온라인 대행업체입니다.\n"
                                + safeValue(target.getCAR_NO()) + "차량의 신규등록이 접수되었습니다.\n\n"
                                + "※ 본 발신번호는 발신전용으로 전화 및 문자 수신이 불가합니다. 관련 문의 사항은 담당 스페셜리스트에게 연락 바랍니다.";
                     }
                    
                } else if (target.getCOMPANY_ID() != null && target.getCOMPANY_ID().substring(0,2).equals("WA")) {
                    // 한성자동차 처리
                    if (target.getCOMPANY_ID().equals("WA002")) {
                        smsText = "안녕하세요. 한성자동차 온라인 대행업체입니다.\n"
                                + safeValue(target.getCAR_NO()) + "차량의 신규등록이 접수되었습니다.\n\n"
                                + "※ 본 발신번호는 발신전용으로 전화 및 문자 수신이 불가합니다. 관련 문의 사항은 담당 스페셜리스트에게 연락 바랍니다."
                                + (isBlank(specialistPhone) ? "" : "\n연락처 : " + specialistPhone);
                    } else {
                        smsText = "안녕하세요. 신규등록 온라인 대행업체입니다.\n"
                                + safeValue(target.getCAR_NO()) + "차량의 신규등록이 접수되었습니다.\n\n"
                                + "※ 본 발신번호는 발신전용으로 전화 및 문자 수신이 불가합니다. 관련 문의 사항은 담당 스페셜리스트에게 연락 바랍니다.";
                    }
                    
                } else {
                    // 이외 기본 심사요청 문자 처리
                    smsText = "안녕하세요. 신규등록 온라인 대행업체입니다.\n"
                            + safeValue(target.getCAR_NO()) + "차량의 신규등록이 접수되었습니다.\n\n"
                            + "※ 본 발신번호는 발신전용으로 전화 및 문자 수신이 불가합니다. 관련 문의 사항은 담당 스페셜리스트에게 연락 바랍니다."
                            + (isBlank(specialistPhone) ? "" : "\n연락처 : " + specialistPhone);
                }
                
                // 심사요청 문자 발송
                Map<String, Object> param = new HashMap<>();
                param.put("PAY_HP_NO", target.getMPHONE_NO()); // 고객 연락처
                param.put("TEXT", smsText);                    // 문자 내용
                param.put("MSG_TYPE", "3");                   // 문자메세지 유형 1:SMS, 3:LMS

                commonService.sendSms(param);
                logger.info("[SchedulerService] SMS문자 발송완료 - serviceId: {}, 문자내용: {}", serviceId, smsText);

                // 심사요청으로 상태 변경
                // 한성자동차는 S_WAIT 라서 납부요청 조건 제거
                int updated = schedulerMapper.updateServiceToJudgeRequest(serviceId);
                updateCount += updated;

                if (updated == 0) {
                    logger.warn("[SchedulerService] 상태 변경 대상 없음 - serviceId: {}, currentProcSt: {}", serviceId, target.getPROC_ST());
                }
            } catch (Exception e) {
                logger.error("[SchedulerService] 처리 실패 - serviceId: {}, message: {}", serviceId, e.getMessage(), e);
            }
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
                if (targets == null || targets.isEmpty()) {
                    continue;
                }

                try {
                    StringBuilder smsTextBuilder = new StringBuilder("[폴스타코리아 미입금 확인] ");
                    for (SchedulerDto target : targets) {
                        smsTextBuilder.append(safeValue(target.getCUSTOMER_NM())).append(", ");
                    }
                    smsTextBuilder.append("고객의 등록비용이 아직 입금되지 않았습니다. 고객에게 입금 요청 부탁드립니다.");
                    String smsText = smsTextBuilder.toString();
                    logger.info("SMS_TEXT: {}", smsText);

                    // 담당자의 연락처로 문자 발송
                    SchedulerDto specialistInfo = schedulerMapper.selectNewcarSpecialistInfo(targets.get(0).getMEMBER_ID());
                    String specialistPhone = specialistInfo == null ? "" : specialistInfo.getSPECIALIST_HP_NO();

                    if (isBlank(specialistPhone)) {
                        logger.warn("[SchedulerService] 미입금 알림 발송 제외 - 담당자 연락처 없음, memberId: {}", targets.get(0).getMEMBER_ID());
                        continue;
                    }

                    Map<String, Object> param = new HashMap<>();
                    param.put("PAY_HP_NO", specialistPhone);
                    param.put("TEXT", smsText);
                    param.put("MSG_TYPE", "3"); // 예: SMS 메시지 유형
                    int result = commonService.sendSms(param);
                    logger.info("[SchedulerService] 문자 발송 완료 - getSPECIALIST_HP_NO: {}, SMS_TEXT: {}", specialistPhone, smsText);
                    updateCount += result;
                } catch (Exception e) {
                    logger.error(
                        "[SchedulerService] 미입금 알림 처리 실패 - memberId: {}, message: {}",
                        targets.get(0).getMEMBER_ID(),
                        e.getMessage(),
                        e
                    );
                }
            }
            
            return updateCount;
        } catch (Exception e) {
            logger.error("[SchedulerService] 등록예정-1일 15:30분 이후 미입금건 알림 문자 발송 중 오류 발생: {}", e.getMessage(), e);
            return 0;
        }
        
        
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String safeValue(String value) {
        return value == null ? "" : value;
    }
}
