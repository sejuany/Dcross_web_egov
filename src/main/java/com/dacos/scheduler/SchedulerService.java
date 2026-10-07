package com.dacos.scheduler;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dacos.common.CommonService;
import com.dacos.newcar.NewcarService;
import com.dacos.newcar.RegistrationMailService;
import com.dacos.newcar.NumplateSelectionService;
import com.dacos.scheduler.dto.SchedulerDto;
import com.dacos.scheduler.mapper.SchedulerMapper;


@Service
public class SchedulerService {

    private static final Logger logger = LoggerFactory.getLogger(SchedulerService.class);

    
    
    private final SchedulerMapper schedulerMapper;
    private final CommonService commonService;
    private final NewcarService newcarService;
    private final RegistrationMailService registrationMailService;
    private final NumplateSelectionService numplateService;

    public SchedulerService(SchedulerMapper schedulerMapper, CommonService commonService, NewcarService newcarService,
            RegistrationMailService registrationMailService, NumplateSelectionService numplateService) {
        this.schedulerMapper = schedulerMapper;
        this.commonService = commonService;
        this.newcarService = newcarService;
        this.registrationMailService = registrationMailService;
        this.numplateService = numplateService;
    }

	/** 만료 정리의 트랜잭션 경계는 NewcarService에 두고 스케줄러는 해당 흐름만 위임한다. */
	public int cleanupExpiredNumplateSelections() {
		return numplateService.cleanupExpiredNumplateSelections();
	}

    /** 한 건의 실패가 다음 대상의 발송을 막지 않도록 건별로 처리한다. */
    public int processRegistrationMails() {
        List<String> serviceIds = schedulerMapper.selectRegistrationMailTargets();
        if (serviceIds == null || serviceIds.isEmpty()) return 0;

        int sentCount = 0;
        for (String serviceId : serviceIds) {
            if (registrationMailService.sendScheduled(serviceId)) sentCount++;
        }
        return sentCount;
    }
    
    @Transactional
    public int processTodayNewcarWaitingServices() {
        // 오늘 등록예정일 건들 중 '납부완료','심사대기'상태인 것들 조회하여 심사요청으로 변경하는 스케쥴
        List<SchedulerDto> targetList = schedulerMapper.selectNewcarWaitingServices();
        String sSubject =  "";	// 문자 메시지 제목
        String sNonTaxString = "";	// 취득세 감면
        
        if (targetList == null || targetList.isEmpty()) {
            logger.info("[SchedulerService] 처리할 건 없음");
            return 0;
        }

        int updateCount = 0;

        for (SchedulerDto target : targetList) {
            String serviceId = target.getSERVICE_ID();

            try {
				// 연락처 유무와 관계없이 금일 등록예정 건의 보험 접수를 먼저 처리함.
				try {
					newcarService.insertAndSendNewcarInsurance(
						serviceId,
						target.getCOMPANY_ID(),
						"SCHEDULAR"
					);
				} catch (Exception e) {
					// 보험 접수 실패가 기존 SMS 및 S_REQ 전환을 중단시키지 않도록 함.
					logger.error("[보험접수] 08시 스케줄 처리 실패 - serviceId: {}", serviceId, e);
				}

                // 고객 연락처 및 SMS 발송 결과와 관계없이 심사요청으로 상태 변경
                int updated = schedulerMapper.updateServiceToJudgeRequest(serviceId);
                updateCount += updated;

                if (updated == 0) {
                    logger.warn("[SchedulerService] 상태 변경 대상 없음 - serviceId: {}, currentProcSt: {}", serviceId, target.getPROC_ST());
                }

                if (isBlank(target.getMPHONE_NO())) {
                    logger.warn("[SchedulerService] SMS 발송 제외 - 고객 연락처 없음, serviceId: {}", serviceId);
                    continue;
                }

                SchedulerDto specialistInfo = schedulerMapper.selectNewcarSpecialistInfo(target.getMEMBER_ID());
                String specialistPhone = specialistInfo == null ? "" : specialistInfo.getSPECIALIST_HP_NO();
                if (specialistPhone != null && !specialistPhone.contains("-")) {
                    if (specialistPhone.length() == 11) {
                        specialistPhone = specialistPhone.replaceAll("(\\d{3})(\\d{4})(\\d{4})", "$1-$2-$3");
                    } else if (specialistPhone.length() == 10) {
                        specialistPhone = specialistPhone.replaceAll("(\\d{3})(\\d{3})(\\d{4})", "$1-$2-$3");
                    }
                }
                String smsText = "";
                
                // WA로 시작하는 회사 문자 처리
                if (target.getCOMPANY_ID() != null && target.getCOMPANY_ID().substring(0,2).equals("WA")) {
                    if (target.getCOMPANY_ID().equals("WA001")) {
                        /*
                        smsText = "안녕하세요. 폴스타 고객 지원 시스템입니다.\n\n"
                        + "■ 신차 등록 접수 및 세제 혜택 유지 안내\n"
                        + "고객님의 소중한 차량(" + safeValue(target.getCAR_NO()) + ") 등록 서류가 관청에 정상 접수되었습니다. 고객님께서 적용받으신 '취득세 감면 혜택'과 관련하여 필수 유의사항을 안내해 드립니다.\n\n"
                        + "[취득세 감면 유지 유의사항]\n"
                        + "감면 혜택을 받은 차량은 정해진 법적 요건(의무 보유 기간 등)을 유지해 주셔야 합니다. 요건 변동(조기 매각 등) 사유가 발생할 경우, 감면받은 지방세가 환수될 수 있으며 발생일로부터 60일 이내 미신고 시 가산세가 부과될 수 있으니 유의해 주시기 바랍니다.\n\n"
                        + "저공해 차량 등록 정보는 신규 등록 절차가 모두 완료된 후 전산에서 확인 가능합니다.\n\n"
                        + "※ 본 메시지는 시스템 발신 전용으로 회신이 어렵습니다. 관련 문의 사항은 담당 스페셜리스트에게 문의해 주시면 자세히 안내해 드리겠습니다."
                        + (isBlank(specialistPhone) ? "" : "\n담당 스페셜리스트 : " + specialistPhone);
                        */
                        
                        
                        smsText = "안녕하세요. 폴스타 차량의 등록 신청이 관청에 접수되었습니다.\n\n"
                                + "주문번호 : " + target.getLINK_ID() + "\r\n차대번호 : " + target.getCARID_NO() + "\r\n\r\n" 
                                + "[취득세 감면 대상자 유의사항]\n"
                                + "1. 감면 혜택을 받은 차량은 정해진 법적 요건(의무 보유 기간 등)을 유지해야 합니다. 요건 변동(조기 매각 등) 사유가 발생할 경우, 감면받은 지방세가 환수될 수 있으며 사유 발생일로부터 60일 이내 미신고 시 가산세가 부과될 수 있으니 유의해 주시기 바랍니다.\n"
                                + "2. 기존 감면과 동일한 감면은 적용할 수 없습니다. 대체 취득의 경우 신규 차량 등록일부터 60일 내에 기존 감면 차량을 말소하거나 소유권을 이전해야 합니다. \r\n\r\n"
                                + "[저공해 차량 대상자 안내사항]\n"
                                + "저공해 차량 등록 정보는 신규 등록을 마친 다음 날부터 무공해차 통합누리집에서 확인하실 수 있습니다.\n\n"
                                + "[외부 장치용 번호판 수요자 안내사항]\n"
                                + "외부 장치용 번호판은 신규등록 완료 후 가까운 차량등록관청에 방문하여 외부 장치용 번호판을 신청하실 수 있습니다.\n\n"
                                + "※ 본 메시지는 자동 발송되는 발신전용 메시지입니다. 차량 등록과 관련하여 문의사항이 있으신 고객님은 담당 스페셜리스트에게 문의 부탁 드립니다."
                                + (isBlank(specialistPhone) ? "" : "\n담당 스페셜리스트 : " + specialistPhone); 
                        sSubject = "등록 접수 안내";
                    }else if (target.getCOMPANY_ID().equals("WA999")) {
                        smsText = "안녕하세요. BMW 차량의 등록 신청이 관청에 접수되었습니다.\n\n"
                                + "주문번호 : " + target.getLINK_ID() + "\r\n차대번호 : " + target.getCARID_NO() + "\r\n\r\n" 
                                + "[취득세 감면 대상자 유의사항]\n"
                                + "1. 감면 혜택을 받은 차량은 정해진 법적 요건(의무 보유 기간 등)을 유지해야 합니다. 요건 변동(조기 매각 등) 사유가 발생할 경우, 감면받은 지방세가 환수될 수 있으며 사유 발생일로부터 60일 이내 미신고 시 가산세가 부과될 수 있으니 유의해 주시기 바랍니다.\n"
                                + "2. 기존 감면과 동일한 감면은 적용할 수 없습니다. 대체 취득의 경우 신규 차량 등록일부터 60일 내에 기존 감면 차량을 말소하거나 소유권을 이전해야 합니다. \r\n\r\n"
                                + "[저공해 차량 대상자 안내사항]\n"
                                + "저공해 차량 등록 정보는 신규 등록을 마친 다음 날부터 무공해차 통합누리집에서 확인하실 수 있습니다.\n\n"
                                + "[외부 장치용 번호판 수요자 안내사항]\n"
                                + "외부 장치용 번호판은 신규등록 완료 후 가까운 차량등록관청에 방문하여 외부 장치용 번호판을 신청하실 수 있습니다.\n\n"
                                + "※ 본 메시지는 자동 발송되는 발신전용 메시지입니다. 차량 등록과 관련하여 문의사항이 있으신 고객님은 담당자에게 문의 부탁 드립니다."
                                + (isBlank(specialistPhone) ? "" : "\n담당자 : " + specialistPhone); 
                        sSubject = "등록 접수 안내";
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
                param.put("PAY_HP_NO", target.getPAY_HP_NO()); // 결제자 연락처
                param.put("TEXT", smsText);                    // 문자 내용
                param.put("MSG_TYPE", "3");                   // 문자메세지 유형 1:SMS, 3:LMS
                param.put("SUBJECT", sSubject);                   // 문자메세지 제목
                commonService.sendSms(param);
                logger.info("[SchedulerService] SMS문자 발송완료 - serviceId: {}, 문자내용: {}", serviceId, smsText);
            } catch (Exception e) {
                logger.error("[SchedulerService] 처리 실패 - serviceId: {}, message: {}", serviceId, e.getMessage(), e);
            }
        }

        return updateCount;
    }

    public int processTodayNewcarNonPayed() {
        // 내일 등록예정인 건들 중에서 15:00분 이후에도 입금이 안된 건들을 조회
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
                    StringBuilder smsTextBuilder = new StringBuilder("");
                    for (SchedulerDto target : targets) {
                        smsTextBuilder.append(safeValue(target.getREQ_CAR_NO())).append(", ");
                    }
                    smsTextBuilder.append("고객의 등록비용이 아직 입금되지 않았습니다. 고객에게 입금 요청 부탁드립니다.");
                    String smsText = smsTextBuilder.toString();
                    logger.info("SMS_TEXT: {}", smsText);

                    /* SP 등록비용 미입금 문자 발송 중단
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
                    param.put("SUBJECT", "미입금 고객 납부 요청 필요"); // 예: SMS 메시지 유형
                    int result = commonService.sendSms(param);
                    logger.info("[SchedulerService] 문자 발송 완료 - getSPECIALIST_HP_NO: {}, SMS_TEXT: {}", specialistPhone, smsText);
                    updateCount += result;
                    */
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
            logger.error("[SchedulerService] 등록예정-1일 15:00분 이후 미입금건 알림 문자 발송 중 오류 발생: {}", e.getMessage(), e);
            return 0;
        }
        
         
    }

    public int processTodayNewcarCardNonPayed() {
    	// 금일 등록예정인 건들 중에서 15:00분 이후에도 카드 납부가 안된 건들을 조회
    	try {
    		List<SchedulerDto> targetList = schedulerMapper.selectNewcarCardNonPayedServices();
    		
    		if (targetList == null || targetList.isEmpty()) {
    			logger.info("[SchedulerService] 처리할 건 없음");
    			return 0;
    		}
    		
    		int updateCount = 0;
    		
    		for (SchedulerDto target : targetList) {
    			try {
    				// 고객 안내 문자
    				String smsText = "[" + safeValue(target.getREQ_CAR_NO()) + "] 차량의 취득세가 아직 확인되지 않아 안내드립니다.\n\n"
    								+ "1) 전자납부번호 : " + safeValue(target.getACQ_VBANK_NO()) + "\n"
    								+ "2) 납부금액 : " + safeAmount(target.getACQ_PAY_AMT()) + "원\n"
    								+ "3) 납부방법 : 위택스(카드), 은행ATM(카드)\n\n"
    								+ "※ 미결제 시 당일 관청 등록 처리가 마감되어 부득이하게 출고 일정이 지연될 수 있으니, 원활한 차량 인도를 위해 시간 내 결제 당부드립니다.\n"
    								+ "※ 이미 납부하신 경우, 전산 반영 시차로 인해 본 안내문이 발송된 것이니 양해 부탁드립니다.";
    				
    				Map<String, Object> param = new HashMap<>();
    				param.put("PAY_HP_NO", target.getPAY_HP_NO());
    				param.put("TEXT", smsText);
    				param.put("MSG_TYPE", "3"); // 예: SMS 메시지 유형
    				param.put("SUBJECT", "취득세 납부 미확인 안내"); // 예: SMS 제목
    				updateCount += commonService.sendSms(param);
    				
    				/* SP 취득세 미납부 문자 발송 중단
    				// 담당자의 연락처로 문자 발송
    				SchedulerDto specialistInfo = schedulerMapper.selectNewcarSpecialistInfo(target.getMEMBER_ID());
    				String specialistPhone = specialistInfo == null ? "" : specialistInfo.getSPECIALIST_HP_NO();
    				
    				if (isBlank(specialistPhone)) {
    					logger.warn("[SchedulerService] 카드 미입금 알림 발송 제외 - 담당자 연락처 없음, memberId: {}", target.getMEMBER_ID());
    					continue;
    				}
    				
    				// 담당자 안내 문자
    				smsText = "[" + safeValue(target.getREQ_CAR_NO()) + "] 차량의 취득세가 납부되지 않았습니다. 고객께 납부요청 부탁드립니다.\n\n"
    								+ "1) 전자납부번호 : " + safeValue(target.getACQ_VBANK_NO()) + "\n"
    								+ "2) 납부금액 : " + safeAmount(target.getACQ_PAY_AMT()) + "원\n"
    								+ "3) 납부방법 : 위택스(카드), 은행ATM(카드)\n"
    								+ "4) 납부기한 : 당일 15:00\n\n"
    								+ "고객 연락처 : " + safeValue(target.getPAY_HP_NO());
    				
    				param.put("PAY_HP_NO", specialistPhone);
    				param.put("TEXT", smsText);
    				param.put("MSG_TYPE", "3"); // 예: SMS 메시지 유형
    				param.put("SUBJECT", "취득세 납부 요청 필요"); // 예: SMS 제목
    				int result = commonService.sendSms(param);
    				updateCount += result;
    				*/
    			} catch (Exception e) {
    				logger.error(
    						"[SchedulerService] 카드 미입금 알림 처리 실패 - memberId: {}, message: {}",
    						target.getMEMBER_ID(),
    						e.getMessage(),
    						e
    						);
    			}
    		}
    		
    		return updateCount;
    	} catch (Exception e) {
    		logger.error("[SchedulerService] 카드납부 15:00분 이후 미입금건 알림 문자 발송 중 오류 발생: {}", e.getMessage(), e);
    		return 0;
    	}
    	
    	
    }

    /**
     * 등록예정일이 D-3 이상 남았고 아직 번호판을 선택하지 않은 고객에게 안내 문자를 보낸다.
     * 현금/할부와 이용자명의 리스는 대표소유자, 리스는 리스계약자에게 발송한다.
     */
    public int processNewcarNumplateSelectionReminders() {
        List<SchedulerDto> candidates = schedulerMapper.selectNewcarNumplateReminderTargets();

        if (candidates == null || candidates.isEmpty()) {
            logger.info("[번호판선택안내] 조회 대상 없음");
            return 0;
        }

        logger.info("[번호판선택안내] 조회 대상 건수={}", candidates.size());
        int sentCount = 0;

        for (SchedulerDto target : candidates) {
            String serviceId = safeValue(target.getSERVICE_ID()).trim();
            String companyId = safeValue(target.getCOMPANY_ID()).trim();
            boolean paid = "Y".equalsIgnoreCase(safeValue(target.getPAY_ST()).trim());
            Date registDate = target.getREGIST_DATE();
            LocalDate registrationDay = toLocalDate(registDate);
            long remainingDays = registrationDay == null
                    ? -1
                    : ChronoUnit.DAYS.between(LocalDate.now(ZoneId.of("Asia/Seoul")), registrationDay);

            logger.info(
                "[번호판선택안내] 조회 결과 - serviceId={}, companyId={}, registDate={}, remainingDays={}, paySt={}, paid={}",
                serviceId, companyId, registDate, remainingDays, target.getPAY_ST(), paid
            );

            if (!numplateService.isPostNumplateCompany(companyId)) {
                logger.info(
                    "[번호판선택안내] 발송 제외 - 대상 업체 아님. serviceId={}, companyId={}",
                    serviceId, companyId
                );
                continue;
            }

            String taskCd = safeValue(target.getTASK_CD()).trim();
            String procCd = safeValue(target.getPROC_CD()).trim();
            String phoneNo = "";
            
            if ("LEASE".equals(taskCd) && "I".equals(procCd)) {
                phoneNo = safeValue(target.getLEASE_HP_NO()).trim();
            } else if (("NORML".equals(taskCd) && "I".equals(procCd))
                    || ("LEASE".equals(taskCd) && "C".equals(procCd))) {
                phoneNo = safeValue(target.getMPHONE_NO()).trim();
            } else {
                logger.info("[번호판선택안내] 발송 제외 - 수신자 기준 없는 업무 유형. serviceId={}, taskCd={}, procCd={}",
                        serviceId, taskCd, procCd);
                continue;
            }
            if (phoneNo.isBlank()) {
                logger.warn("[번호판선택안내] 발송 제외 - 고객 연락처 없음. serviceId={}", serviceId);
                continue;
            }

            try {
                String token = getOrCreateNumplateMessageToken(target);
                if (token.isBlank()) {
                    logger.error("[번호판선택안내] 발송 제외 - 토큰 확보 실패. serviceId={}", serviceId);
                    continue;
                }

                String url = numplateService.buildNumplateSelectionUrl(token);
                LocalDate deadlineDay = registrationDay.minusDays(3);
                String deadline = deadlineDay.format(DateTimeFormatter.ofPattern("MM/dd"));
                String insuranceDeadline = deadlineDay.format(DateTimeFormatter.ISO_LOCAL_DATE);
                String insuranceStartDate = registrationDay.format(DateTimeFormatter.ISO_LOCAL_DATE);

                Map<String, Object> sms = new HashMap<>();
                sms.put("PAY_HP_NO", phoneNo);
                sms.put("MSG_TYPE", "3");
                sms.put("SUBJECT", "번호 선택 재안내");
                sms.put(
                    "TEXT",
                    buildNumplateReminderText(
                        target,
                        url,
                        deadline,
                        insuranceDeadline,
                        insuranceStartDate
                    )
                );

                int resetCount = schedulerMapper.resetNumplateSelectionForReminder(serviceId);
                logger.info(
                    "[번호판선택안내] 조회 기회 초기화 - serviceId={}, tokenKept=true, resetCount={}",
                    serviceId, resetCount
                );
                if (resetCount != 1) {
                    logger.error(
                        "[번호판선택안내] 발송 제외 - 조회 기회 초기화 실패. serviceId={}, resetCount={}",
                        serviceId, resetCount
                    );
                    continue;
                }

                int result = commonService.sendSms(sms);
                sentCount += result;
                logger.info(
                    "[번호판선택안내] 문자 발송 결과 - serviceId={}, paid={}, result={}",
                    serviceId, paid, result
                );
            } catch (Exception e) {
                logger.error(
                    "[번호판선택안내] 처리 실패 - serviceId={}, paid={}, message={}",
                    serviceId, paid, e.getMessage(), e
                );
            }
        }

        return sentCount;
    }

    /** 번호판 선택을 마친 등록비용 미납 고객에게 D-3까지 납부 안내를 보낸다. */
    public int processNewcarPaymentReminders() {
        List<Map<String, Object>> targets = schedulerMapper.selectNewcarPaymentReminderTargets();
        int sentCount = 0;

        for (Map<String, Object> target : targets) {
            String serviceId = Objects.toString(target.get("SERVICE_ID"), "");
            String phoneNo = Objects.toString(target.get("PAY_HP_NO"), "").trim();
            if (phoneNo.isEmpty()) {
                logger.warn("[등록비용재안내] 납부자 연락처 없음 - serviceId={}", serviceId);
                continue;
            }

            try {
                // 재안내는 납부자에게만 보낸다.
                Map<String, Object> sms = new HashMap<>();
                sms.put("PAY_HP_NO", phoneNo);
                sms.put("MSG_TYPE", "3");
                sms.put("SUBJECT", "Y".equals(target.get("CARD_YN"))
                        ? "등록비용 납부 안내(취득세 카드납부)" : "등록비용 납부 안내");
                sms.put("TEXT", buildNewcarPaymentReminderText(target));
                sentCount += commonService.sendSms(sms);
            } catch (Exception e) {
                logger.error("[등록비용재안내] 문자 발송 실패 - serviceId={}", serviceId, e);
            }
        }
        return sentCount;
    }

    String buildNewcarPaymentReminderText(Map<String, Object> target) {
        String companyName = Objects.toString(target.get("COMPANY_NM"), "")
                .split("_", 2)[0].replace("오토모티브코리아", "").trim();
        String carNo = Objects.toString(target.get("REQ_CAR_NO"), "").trim();
        String specialistPhone = Objects.toString(target.get("SPECIALIST_HP_NO"), "").trim();
        if (!specialistPhone.contains("-")) {
            if (specialistPhone.length() == 11) {
                specialistPhone = specialistPhone.replaceFirst("(\\d{3})(\\d{4})(\\d{4})", "$1-$2-$3");
            } else if (specialistPhone.length() == 10) {
                specialistPhone = specialistPhone.replaceFirst("(\\d{3})(\\d{3})(\\d{4})", "$1-$2-$3");
            }
        }

        // 납부요청 패키지의 고객 문자 문구와 금액 항목을 그대로 사용한다.
        String text = "안녕하세요. " + companyName + " 등록비용 납부 안내드립니다.\r\n\r\n"
                + "주문번호 : " + Objects.toString(target.get("LINK_ID"), "") + "\r\n"
                + "차대번호 : " + Objects.toString(target.get("CARID_NO"), "") + "\r\n\r\n"
                + "- 입금기한 : " + Objects.toString(target.get("PAY_DEADLINE"), "") + "\r\n"
                + "- 납부비용 : " + safeAmount(target.get("TOTAL_AMT")) + "원\r\n"
                + "- 납부계좌 : 우리은행 " + Objects.toString(target.get("VBANK_NO"), "") + "\r\n"
                + "- 예금주명 : " + carNo.substring(Math.max(0, carNo.length() - 4)) + "주식회사다코\r\n"
                + "등록 예정일에 맞춰 차량이 등록될수 있도록, 안내해 드린 기한 내에 등록 비용을 입금해주세요.\r\n\r\n"
                + "■ 등록비용 안내\r\n"
                + "(차액 발생 시 등록하신 환불정보로 환불예정. 등록완료 후 영업일 기준 1일 소요)\r\n";

        boolean cardPayment = "Y".equals(target.get("CARD_YN"));
        text += "취득세 : " + (cardPayment ? "등록 후 안내 (카드납부)" : safeAmount(target.get("ACQ_AMT"))) + "\r\n"
                + "채권취급수수료 : " + safeAmount(target.get("BFEE_AMT")) + "\r\n"
                + "채권 : " + safeAmount(target.get("BOND_AMT")) + "\r\n"
                + "등록수수료 : " + safeAmount(target.get("FEE_AMT")) + "\r\n"
                + "인지세 : " + safeAmount(target.get("INJI_AMT")) + "\r\n"
                + "예비비 : " + safeAmount(target.get("SPARE_AMT")) + "\r\n"
                + "증지대 : " + safeAmount(target.get("STAMP_AMT")) + "\r\n"
                + "번호판대 : " + safeAmount(target.get("TNUM_AMT"));
        if (cardPayment) {
            text += "\r\n\r\n■ 취득세 카드납부 안내\r\n"
                    + "- 납부시한 : 등록 당일 15시까지\r\n"
                    + "미납 시 차량 인도가 지연될 수 있습니다.";
        }
        return text + "\r\n\r\n■ 자동차보험 가입 안내\r\n"
                + "- 가입 필수 기한 : " + Objects.toString(target.get("INSURANCE_DEADLINE"), "") + " 까지\r\n"
                + "- 보험 시작일 : " + Objects.toString(target.get("INSURANCE_START_DATE"), "") + " 부터 ~\r\n"
                + "- 반드시 차대번호로 가입 (차량번호 가입 불가)\r\n"
                + "- 숫자 0과 알파벳 O 를 구분해서 가입해주세요."
                + "\r\n\r\n※ 본 메시지는 자동 발송되는 발신전용 메시지입니다. 차량 등록과 관련하여 문의사항이 있으신 고객님은 담당 스페셜리스트에게 문의 부탁 드립니다. "
                + "\r\n담당 스페셜리스트 : " + specialistPhone;
    }

    /** 영업일 기준 D-2 및 등록예정일 경과 미처리 건을 신차사업부 알림으로 등록한다. */
    @Transactional
    public int processNewcarNumplateD2Alerts() {
        List<SchedulerDto> targets = schedulerMapper.selectNewcarNumplateD2AlertTargets();
        List<SchedulerDto> overdueTargets = schedulerMapper.selectOverdueNewcarNumplateAlertTargets();
        if ((targets == null || targets.isEmpty())
                && (overdueTargets == null || overdueTargets.isEmpty())) {
            logger.info("[번호판D-2알림] D-2 및 등록예정일 경과 대상 없음");
            return 0;
        }

        String newcarTeam = safeValue(schedulerMapper.selectNewcarTeamCompanyId()).trim();
        if (newcarTeam.isBlank()) {
            logger.error("[번호판D-2알림] 신차사업부 공통코드 없음 - GROUP_ID=TEAMS, CODE_ID=NEWC");
            return 0;
        }

        int alertCount = 0;
        for (SchedulerDto target : targets == null ? List.<SchedulerDto>of() : targets) {
            String serviceId = safeValue(target.getSERVICE_ID()).trim();
            String companyId = safeValue(target.getCOMPANY_ID()).trim();
            boolean numplateMissing = safeValue(target.getREQ_CAR_NO()).trim().isEmpty();
            boolean unpaid = "N".equalsIgnoreCase(safeValue(target.getPAY_ST()).trim());
            boolean reviewRequested = "REQ".equalsIgnoreCase(safeValue(target.getPROC_ST()).trim())
                    && "S_REQ".equalsIgnoreCase(safeValue(target.getJUDGE_ST()).trim());

            logger.info(
                "[번호판D-2알림] 상태 확인 - serviceId={}, registDate={}, procSt={}, judgeSt={}, reqCarNo={}, paySt={}, numplateMissing={}, unpaid={}, reviewRequested={}",
                serviceId, target.getREGIST_DATE(), target.getPROC_ST(), target.getJUDGE_ST(),
                target.getREQ_CAR_NO(), target.getPAY_ST(), numplateMissing, unpaid, reviewRequested
            );

            if (!numplateService.isPostNumplateCompany(companyId)) {
                logger.info(
                    "[번호판D-2알림] 제외 - 대상 업체 아님. serviceId={}, companyId={}",
                    serviceId, companyId
                );
                continue;
            }

            // 심사요청 단계라도 번호판을 선택하지 않았다면 번호판 알림만 등록한다.
            if (reviewRequested) {
                if (numplateMissing) {
                    alertCount += schedulerMapper.insertNewcarD2Alert(
                        serviceId,
                        target.getCARID_NO(),
                        "[신차사업] 등록예정일 임박 건 번호판 선택 필요",
                        newcarTeam
                    );
                }
                continue;
            }

            if (numplateMissing && unpaid) {
                alertCount += schedulerMapper.insertNewcarD2Alert(
                    serviceId,
                    target.getCARID_NO(),
                    "[신차사업] 등록예정일 임박 건 납부/번호선택 필요",
                    newcarTeam
                );
            } else if (numplateMissing) {
                alertCount += schedulerMapper.insertNewcarD2Alert(
                    serviceId,
                    target.getCARID_NO(),
                    "[신차사업] 등록예정일 임박 건 번호판 선택 필요",
                    newcarTeam
                );
            } else if (unpaid) {
                alertCount += schedulerMapper.insertNewcarD2Alert(
                    serviceId,
                    target.getCARID_NO(),
                    "[신차사업] 등록예정일 임박 건 등록비 납부 필요",
                    newcarTeam
                );
            }
        }

        for (SchedulerDto target : overdueTargets == null ? List.<SchedulerDto>of() : overdueTargets) {
            String serviceId = safeValue(target.getSERVICE_ID()).trim();
            String companyId = safeValue(target.getCOMPANY_ID()).trim();
            boolean reviewRequested = "REQ".equalsIgnoreCase(safeValue(target.getPROC_ST()).trim())
                    && "S_REQ".equalsIgnoreCase(safeValue(target.getJUDGE_ST()).trim());
            boolean numplateMissing = safeValue(target.getREQ_CAR_NO()).trim().isEmpty();
            logger.info(
                "[등록예정일경과알림] 상태 확인 - serviceId={}, registDate={}, procSt={}, judgeSt={}, numplateMissing={}",
                serviceId, target.getREGIST_DATE(), target.getPROC_ST(), target.getJUDGE_ST(), numplateMissing
            );
            if (!numplateService.isPostNumplateCompany(companyId)) {
                logger.info(
                    "[등록예정일경과알림] 제외 - 대상 업체 아님. serviceId={}, companyId={}",
                    serviceId, companyId
                );
                continue;
            }

            alertCount += schedulerMapper.insertNewcarD2Alert(
                serviceId,
                target.getCARID_NO(),
                reviewRequested && numplateMissing
                    ? "[신차사업] 등록예정일 경과 건 번호판 선택 필요"
                    : "[신차사업] 등록예정일 경과 건 처리 필요",
                newcarTeam
            );
        }

        logger.info(
            "[번호판D-2알림] 완료 - D-2 조회건수={}, 경과 조회건수={}, 등록건수={}",
            targets == null ? 0 : targets.size(),
            overdueTargets == null ? 0 : overdueTargets.size(),
            alertCount
        );
        return alertCount;
    }

    private String getOrCreateNumplateMessageToken(SchedulerDto target) {
        String serviceId = target.getSERVICE_ID();
        String token = safeValue(schedulerMapper.selectNumplateMessageToken(serviceId)).trim();
        if (!token.isBlank()) {
            logger.info("[번호판선택안내] 기존 토큰 재사용 - serviceId={}", serviceId);
            return token;
        }

        String newToken = UUID.randomUUID().toString().replace("-", "");
        int updated = schedulerMapper.updateNumplateMessageTokenIfMissing(serviceId, newToken);
        if (updated == 1) {
            logger.info("[번호판선택안내] 신규 토큰 생성 - serviceId={}", serviceId);
        }

        // 다른 실행이 먼저 저장했을 수도 있으므로, 문자에는 DB에 확정된 토큰만 사용한다.
        return safeValue(schedulerMapper.selectNumplateMessageToken(serviceId)).trim();
    }

    private String buildNumplateReminderText(
            SchedulerDto target,
            String url,
            String deadline,
            String insuranceDeadline,
            String insuranceStartDate) {
        return "안녕하세요. 폴스타 차량번호 선택을 위한 링크를 재안내해 드립니다.\r\n\r\n"
                + "주문번호 : " + safeValue(target.getLINK_ID()) + "\r\n"
                + "차대번호 : " + safeValue(target.getCARID_NO()) + "\r\n\r\n"
                + url + "\r\n\r\n"
                + "오늘 중으로 위 링크에 접속하셔서 번호를 선택해 주세요.\r\n\r\n"
                + "※ 번호 조회 후 5분 내로 선택을 완료해 주세요. (시간 초과 시 재선택 불가)\r\n\r\n"
                + "■ 아래 항목이 " + deadline + "까지 완료되어야 원활한 등록이 가능합니다.\r\n"
                + "- 차량대금 납부\r\n"
                + "- 등록비용 납부\r\n"
                + "- 번호 선택\r\n"
                + "- 보험가입\r\n\r\n"
                + "■ 자동차보험 가입 안내\r\n"
                + "- 가입 필수 기한 : " + insuranceDeadline + " 까지\r\n"
                + "- 보험 시작일 : " + insuranceStartDate + " 부터 ~\r\n"
                + "- 반드시 차대번호로 가입 (차량번호 가입 불가)\r\n"
                + "- 숫자 0과 알파벳 O 를 구분해서 가입해주세요.\r\n\r\n"
                + "문의사항은 1844-0801(내선 1)로 연락해 주세요.";
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String safeValue(String value) {
        return value == null ? "" : value;
    }

    private LocalDate toLocalDate(Date date) {
        if (date == null) {
            return null;
        }
        if (date instanceof java.sql.Date) {
            return ((java.sql.Date) date).toLocalDate();
        }
        return date.toInstant().atZone(ZoneId.of("Asia/Seoul")).toLocalDate();
    }
    
    private String safeAmount(Object amount) {
        if (amount == null || amount.toString().trim().isEmpty()) {
            return "0";
        }

        try {
            return String.format("%,d", Long.parseLong(amount.toString()));
        } catch (Exception e) {
            return amount.toString();
        }
    }
}
