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
import com.dacos.newcar.NewcarService;
import com.dacos.scheduler.dto.SchedulerDto;
import com.dacos.scheduler.mapper.SchedulerMapper;


@Service
public class SchedulerService {

    private static final Logger logger = LoggerFactory.getLogger(SchedulerService.class);

    
    
    private final SchedulerMapper schedulerMapper;
    private final CommonService commonService;
    private final NewcarService newcarService;

    public SchedulerService(SchedulerMapper schedulerMapper, CommonService commonService, NewcarService newcarService) {
        this.schedulerMapper = schedulerMapper;
        this.commonService = commonService;
        this.newcarService = newcarService;
    }

	/** 만료 정리의 트랜잭션 경계는 NewcarService에 두고 스케줄러는 해당 흐름만 위임한다. */
	public int cleanupExpiredNumplateSelections() {
		return newcarService.cleanupExpiredNumplateSelections();
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
                     if (target.getCOMPANY_ID().equals("WA001") || target.getCOMPANY_ID().equals("WA999")) {
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
    				commonService.sendSms(param);
    				
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

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String safeValue(String value) {
        return value == null ? "" : value;
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
