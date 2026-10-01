package com.dacos.newcar;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.ApiResponse;
import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;
import com.dacos.common.CommonService;
import com.dacos.common.ServiceAccessGuard;
import com.dacos.common.ServiceAccessGuard.ServiceAction;
import com.dacos.newcar.mapper.NewcarMapper;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NumplateSelectionService {

	private static final Logger logger = LoggerFactory.getLogger(NewcarService.class);
	// 번호판 조회 세션 Key
 	private static final String NUMPLATE_SESSION_KEY = "NUMPLATE_LIST";	
 	
    private final CommonRepository common;
    private final CommonService commonService;
    private final PlatformTransactionManager transactionManager;
	private final NewcarMapper newcarMapper;
	private final ServiceAccessGuard serviceAccessGuard;
 	
	@Value("${firebase.push.public-base-url}")
	private String publicBaseUrl;
 	
	
    /**
     * 신청 후 번호판 선택 문자 발송 처리
     * - 번호판 선택 대상 업체만 처리
     * - 등록예정일 기준 D-3까지 문자 발송
     */
    public void processNumplateSelectSms(
            Map<String, Object> mService,
            Map<String, Object> mNewCar,
            List<Map<String, Object>> lOwnerInfoList) {

        String serviceId = Objects.toString(mService.get("SERVICE_ID"), "");
        String companyId = Objects.toString(mService.get("COMPANY_ID"), "");
        String registDate = Objects.toString(mNewCar.get("REGIST_DATE"), "");

        // 신청 후 번호판 선택 대상 업체 확인
        boolean postNumplateCompany = isPostNumplateCompany(companyId);

        if (!postNumplateCompany) {
            logger.info(
                "[번호판문자] 종료 - 대상 업체 아님. SERVICE_ID={}, COMPANY_ID={}",
                serviceId, companyId
            );
            return;
        }

        // 등록예정일 기준 D-3 확인
        boolean selectPeriod = isNumplateSelectPeriod(registDate);

        // 번호판 선택 기간이 아닌 경우, 신차사업부 담당자에게 안내 메모 남기기
        if (!selectPeriod) {
            logger.info(
                "[번호판문자] 종료 - 번호판 선택 기간 아님. SERVICE_ID={}, REGIST_DATE={}",
                serviceId, registDate
            );
            
            Map<String, Object> param1 = new HashMap<>();
            param1.put("GROUP_ID", "TEAMS");
            param1.put("CODE_ID", "NEWC");
            
            // 신차사업부 담당자 조회
			Map<String, Object> code = common.select(param1, "selectCodeDetail");
			String newcarTeam = Objects.toString(code.get("CODE_NM"), "");
            
            Map<String, Object> param2 = new HashMap<>();
            param2.put("CAR_NO", mNewCar.get("CARID_NO"));
            param2.put("SERVICE_ID", serviceId);
            param2.put("CONTENT_TX", "[신차사업] 등록예정일 임박 건 번호판 선택 필요"); // 보여 줄 내용
            param2.put("COMPANY_ID", newcarTeam); // 보여 줄 사람
            
            common.insert(param2, "insertTmBoard");
            return;
        }
        
	    
	    // 신청시 문자 보낼 때 사용하는 번호
	    String taskCd = Objects.toString(mNewCar.get("TASK_CD"), "").trim();
	    String procCd = Objects.toString(mNewCar.get("PROC_CD"), "").trim();
	    String phoneNo = "";

	    // 리스: 리스 계약자 연락처
	    if ("LEASE".equals(taskCd) && "I".equals(procCd)) {
	        if (lOwnerInfoList != null && !lOwnerInfoList.isEmpty()) {
	            phoneNo = Objects.toString(
	                lOwnerInfoList.get(0).get("DEBTOR_TEL_NO"), ""
	            ).trim();
	        }
	    } 
	    
	    // 현금/할부, 이용자명의 리스: 대표소유자 연락처
	    else if (("NORML".equals(taskCd) && "I".equals(procCd))
	            || ("LEASE".equals(taskCd) && "C".equals(procCd))) {
	        phoneNo = Objects.toString(mNewCar.get("MPHONE_NO"), "").trim();
	    }

        // 번호판 선택 안내 문자 발송
        sendNumplateSelectSms(mService, mNewCar, registDate, phoneNo);
    }

    // 등록예정일 기준 D-3 확인
    public boolean isPostNumplateCompany(String companyId) {

        if (companyId == null || companyId.trim().isEmpty()) {
            logger.warn("[번호판문자] COMPANY_ID 없음");
            return false;
        }

        try {
            Map<String, Object> param = new HashMap<>();
            param.put("GROUP_ID", "DEAL");
            param.put("CODE_ID", "NUMPL");

            Map<String, Object> code =
                    common.select(param, "selectCodeDetail");

            if (code == null) {
                logger.warn(
                    "[번호판문자] 공통코드 조회 결과 없음. COMPANY_ID={}",
                    companyId
                );
                return false;
            }

            String detailNm =
                    Objects.toString(code.get("DETAIL_NM"), "");

            boolean result = Arrays.stream(detailNm.split("\\|"))
                    .anyMatch(companyId::equals);

            return result;

        } catch (Exception e) {
            logger.error(
                "[번호판문자] 업체 확인 실패. COMPANY_ID={}",
                companyId, e
            );
            return false;
        }
    }
    
	/**
	 * 번호판 선택 안내 문자 발송
	 * 기존 토큰을 재사용하거나 새 토큰을 저장한 뒤 트랜잭션 커밋 후 문자를 발송한다.
	 */
	private void sendNumplateSelectSms(
			Map<String, Object> mService, 
			Map<String, Object> mNewcar, 
			String registDate, String phoneNo) {
		
		String serviceId = Objects.toString(mService.get("SERVICE_ID"), "").trim();
	    
	    // 필수값 확인 
	    if (serviceId.isBlank()) {
	        logger.warn("번호판 선택 문자 발송 제외 - SERVICE_ID 없음");
	        return;
	    }

	    if (phoneNo.isBlank()) {
	        logger.warn("번호판 선택 문자 발송 제외 - 휴대폰 번호 없음. SERVICE_ID={}", serviceId);
	        return;
	    }
	    
	    try {
	    	// 등록예정일 기준 번호판 선택 마감일(D-3)
	        Date limitDate = getNumplateSelectLimitDate(registDate);
	        String selectLimitDate = new SimpleDateFormat("MM/dd").format(limitDate);
	        Map<String, Object> tokenParam = new HashMap<>();
	        tokenParam.put("SERVICE_ID", serviceId);
	        tokenParam.put("TOKEN", UUID.randomUUID().toString().replace("-", ""));
	        common.update(tokenParam, "createNumplateMessageTokenIfMissing");
	        String token = Objects.toString(
	                common.select(tokenParam, "getNumplateMessageTokenByServiceId"), "").trim();
	        if (token.isBlank()) {
	            logger.error("번호판 선택 토큰 저장 실패. SERVICE_ID={}", serviceId);
	            return;
	        }
	        Map<String, Object> sms = new HashMap<>(mNewcar);

			// 환경별 번호판 선택 URL 생성
			String url = publicBaseUrl
			        + "/customer/WaNewcarNumplateSelect?t="
			        + token;
			
			// 주문번호
			String orderNo = Objects.toString(mService.get("LINK_ID"), "").trim();
			
			// 차대번호
			String carIdNo = Objects.toString(mNewcar.get("CARID_NO"), "").trim();

	        sms.put("MSG_TYPE", "3");
	        sms.put("SUBJECT", "번호 선택 안내");
	        sms.put("PAY_HP_NO", phoneNo);

	        sms.put("TEXT",
	        	    "안녕하세요. 폴스타 차량번호 선택을 위하여 아래 링크에 접속해 주세요.\r\n\r\n"
	        	    + "주문번호 : " + orderNo + "\r\n"
	        	    + "차대번호 : " + carIdNo + "\r\n\r\n"
	        	    + url + "\r\n\r\n"
	        	    + "※ 번호 조회 후 5분 내로 번호를 선택을 완료해 주시기 바라며, 시간 초과 시 자동 초기화됩니다.\r\n"
	        	    + "번호 선택은 금일 중으로 위 링크를 통해 진행해 주시기 바랍니다.\r\n\r\n"
	        	    + "차량대금 납부, 등록비용 납부, 번호 선택은 모두 09/18까지 완료되어야 원활한 등록이 가능합니다.\r\n"
	        	    + "문의사항은 1844-0801(내선 1)로 연락해 주세요."
	        	);

	        sendNumplateSmsAfterCommit(sms, serviceId);
			
	    } catch (Exception e) {
	        // 문자 발송 실패가 신규등록 신청에 영향을 주지 않도록 예외 처리
	        logger.error("번호판 선택 문자 발송 중 오류. SERVICE_ID={}", serviceId, e);
	    }
	}

	private void sendNumplateSmsAfterCommit(Map<String, Object> sms, String serviceId) {
		Runnable send = () -> {
			try {
				TransactionTemplate transaction = new TransactionTemplate(transactionManager);
				transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
				Integer result = transaction.execute(status -> commonService.sendSms(sms));
				if (result == null || result < 1) {
					logger.error("번호판 선택 문자 발송 실패. SERVICE_ID={}", serviceId);
				}
			} catch (Exception e) {
				logger.error("번호판 선택 문자 발송 중 오류. SERVICE_ID={}", serviceId, e);
			}
		};
		if (TransactionSynchronizationManager.isActualTransactionActive()) {
			if (!TransactionSynchronizationManager.isSynchronizationActive()) {
				throw new IllegalStateException("번호판 선택 문자 발송을 커밋 이후로 예약할 수 없습니다.");
			}
			TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
				@Override
				public void afterCommit() {
					send.run();
				}
			});
		} else {
			send.run();
		}
	}
	
	/**
	 * 번호판 선택 가능 기간 여부
	 * - 등록예정일 3일 전(D-3) 당일까지 선택 가능
	 * - 예) 등록예정일 09/17 → 09/14까지 true
	 */
	private boolean isNumplateSelectPeriod(String registDate) {
	
	    if (registDate == null || "".equals(registDate.trim())) {
	        return false;
	    }
	
	    // 날짜에서 숫자만 추출
	    registDate = registDate.replaceAll("[^0-9]", "");

	    SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd");
	    sdf.setLenient(false);
	
	    try {
	        Date limitDate = getNumplateSelectLimitDate(registDate);
	
	        // 시간 제외 후 날짜만 비교
	        Date today = sdf.parse(sdf.format(new Date()));
	
	        return !today.after(limitDate);
	
	    } catch (ParseException e) {
	        logger.error("등록예정일 변환 오류. REGIST_DATE={}", registDate, e);
	        return false;
	    }
	}
	
	/**
	 * 번호판 선택 마감일 조회
	 * - 등록예정일 기준 D-3
	 * - 예) 등록예정일 20260917 → 20260914
	 */
	private Date getNumplateSelectLimitDate(String registDate) throws ParseException {

	    // 날짜에서 숫자만 추출
	    registDate = registDate.replaceAll("[^0-9]", "");

	    SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd");
	    sdf.setLenient(false);

	    Date registDt = sdf.parse(registDate);

	    Calendar cal = Calendar.getInstance();
	    cal.setTime(registDt);
	    cal.add(Calendar.DATE, -3);

	    return cal.getTime();
	}
	

	/**
	 * 선택 가능한 번호판 조회
	 * - 세션 최대 20개
	 * - 끝자리(0~9)별 최대 2개까지 저장
	 * - 끝자리 조회 : 1회 1개, 동일 끝자리 최대 2개
	 * - 무작위 조회 : 1회 최대 10개, 동일 끝자리 최대 2개
	 * - 조회 시 이전 표시중(P) 번호판은 미사용(N)으로 원복
	 * - 세션 최대치 도달 후에는 세션 번호판 안에서 재조회
	 */
	@Transactional
	public List<String> getNumplateList(
	        Map<String, Object> param,
	        UserDto user,
	        HttpSession session) {

	    String serviceId = Objects.toString(param.get("SERVICE_ID"), "").trim();
	    serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.UPDATE_SERVICE);

	    List<String> sessionList =
	        getNumplateSession(session, serviceId);

	    if (sessionList == null) {
	        sessionList = new ArrayList<>();
	    }

	    String condition = Objects.toString(param.get("CONDITION"), "NOT")
	            .trim().toUpperCase();
	    if (!"NOT".equals(condition) && !condition.matches(".*[0-9]$")) {
	        throw new BusinessException("번호판 조회 조건이 올바르지 않습니다.", 400);
	    }
	    param.put("CONDITION", condition);

	    int sessionCount = sessionList.size();

	    List<String> result = new ArrayList<>();


	    // =====================================================
	    // 이전 조회에서 표시중(P)이었던 세션 번호판 원복
	    // =====================================================
	    if (!sessionList.isEmpty()) {

	        param.put("NUM_LIST", sessionList);

	        common.update(param, "releaseNumplateList");
	    }


	    // =====================================================
	    // 세션 20개 미만 → 신규 번호판 조회 가능
	    // =====================================================
	    if (sessionCount < 20) {

	        // 끝자리별 현재 세션 저장 개수
	        Map<String, Integer> lastDigitCount = new HashMap<>();

	        for (int i = 0; i <= 9; i++) {
	            lastDigitCount.put(String.valueOf(i), 0);
	        }

	        for (String carNo : sessionList) {

	            if (carNo == null || carNo.isEmpty()) {
	                continue;
	            }

	            String lastDigit =
	                carNo.substring(carNo.length() - 1);

	            lastDigitCount.put(
	                lastDigit,
	                lastDigitCount.getOrDefault(lastDigit, 0) + 1
	            );
	        }

	        // 신규조회 시 기존 세션 번호 제외
	        param.put("NUM_LIST", sessionList);

	        // SQL에 끝자리별 현재 개수 전달
	        for (int i = 0; i <= 9; i++) {
	            param.put(
	                "LAST_COUNT_" + i,
	                lastDigitCount.getOrDefault(
	                    String.valueOf(i),
	                    0
	                )
	            );
	        }


	        // =================================================
	        // 무작위 조회
	        // =================================================
	        if ("NOT".equals(condition)) {

	            param.put(
	                "LIMIT",
	                Math.min(10, 20 - sessionCount)
	            );

	            result = common.selectList(
	                param,
	                "selectAvailableNumplateList"
	            );

	        // =================================================
	        // 끝자리 지정 조회
	        // =================================================
	        } else {

	            String lastDigit =
	                condition.substring(condition.length() - 1);

	            int currentCount =
	                lastDigitCount.getOrDefault(lastDigit, 0);

	            if (currentCount < 2) {

	                // 아직 2개 미만이면 신규 번호 1개 조회
	                param.put("LIMIT", 1);

	                result = common.selectList(
	                    param,
	                    "selectAvailableNumplateList"
	                );

	            } else {

	                // 이미 해당 끝자리 2개 확보
	                // → 신규조회하지 않고 세션 안에서 재조회
	                param.put("NUM_LIST", sessionList);
	                param.put("LIMIT", 1);

	                result = common.selectList(
	                    param,
	                    "selectSessionNumplateList"
	                );
	            }
	        }


	        // 신규 번호를 조회한 경우 세션에 추가
	        if (result != null && !result.isEmpty()) {

	            List<String> newList = new ArrayList<>();

	            for (String carNo : result) {
	                if (!sessionList.contains(carNo)) {
	                    newList.add(carNo);
	                }
	            }

	            if (!newList.isEmpty()) {
	                saveNumplateSession(
	                    session,
	                    serviceId,
	                    newList
	                );
	            }
	        } else {

	            // 신규조회 결과가 없으면
	            // 기존 세션 번호판에서 다시 조회
	            if (!sessionList.isEmpty()) {

	                param.put("NUM_LIST", sessionList);
	                param.put(
	                    "LIMIT",
	                    "NOT".equals(condition) ? 10 : 1
	                );

	                result = common.selectList(
	                    param,
	                    "selectSessionNumplateList"
	                );
	            }
	        }

	    } else {

	        // =================================================
	        // 세션 20개 도달 → 세션 번호판 안에서만 조회
	        // =================================================
	        param.put("NUM_LIST", sessionList);

	        param.put(
	            "LIMIT",
	            "NOT".equals(condition) ? 10 : 1
	        );

	        result = common.selectList(
	            param,
	            "selectSessionNumplateList"
	        );
	    }


	    if (result == null || result.isEmpty()) {
	        return new ArrayList<>();
	    }


	    // =====================================================
	    // 이번 조회에서 화면에 표시할 번호만 P 처리
	    // =====================================================
	    param.put("NUM_LIST", result);

	    common.update(
	        param,
	        "updateNumplateAppear"
	    );

	    return result;
	}
	

	/**
	 * 서비스별 조회 번호판을 세션에 누적 저장한다.
	 * - SERVICE_ID 기준 최대 20개까지 저장
	 */
	@SuppressWarnings("unchecked")
	private void saveNumplateSession(
	        HttpSession session,
	        String serviceId,
	        List<String> numList) {

	    Map<String, List<String>> sessionMap =
	            (Map<String, List<String>>) session.getAttribute(NUMPLATE_SESSION_KEY);

	    if (sessionMap == null) {
	        sessionMap = new HashMap<>();
	    }

	    List<String> savedList =
	            sessionMap.computeIfAbsent(serviceId, key -> new ArrayList<>());

	    for (String carNo : numList) {

	        if (savedList.size() >= 20) {
	            break;
	        }

	        if (!savedList.contains(carNo)) {
	            savedList.add(carNo);
	        }
	    }

	    session.setAttribute(NUMPLATE_SESSION_KEY, sessionMap);
	}
	
	/**
	 * 서비스별 최초 조회 번호판을 세션에서 조회한다.
	 */
	@SuppressWarnings("unchecked")
	private List<String> getNumplateSession(
	        HttpSession session,
	        String serviceId) {

	    Map<String, List<String>> sessionMap =
	            (Map<String, List<String>>) session.getAttribute(NUMPLATE_SESSION_KEY);

	    if (sessionMap == null) {
	        return null;
	    }

	    return sessionMap.get(serviceId);
	}

	// 번호판 선택
	@Transactional
	public ApiResponse<Object> selectNumplate(
			Map<String, Object> param, UserDto user, HttpSession session) {
		String serviceId = Objects.toString(param.get("SERVICE_ID"), "").trim();
		serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.CHANGE_STATUS);
		String carNo = Objects.toString(param.get("CAR_NO"), "").trim();
		List<String> queried = getNumplateSession(session, serviceId);
		if (carNo.isEmpty() || queried == null || !queried.contains(carNo)) {
			throw new BusinessException("현재 세션에서 조회하지 않은 번호판입니다.", 409);
		}
		Map<String, Object> detail = newcarMapper.getNewCarDetail(serviceId);
		if (detail == null || detail.isEmpty()) {
			throw new BusinessException("신청 정보를 찾을 수 없습니다.", 404);
		}
		param.put("CAR_NO", carNo);
		param.put("CARID_NO", detail.get("CARID_NO"));
		// 선택한 번호판 변경
		param.put("SERVICE_ID", serviceId + "_S");
		param.put("LOGIN_ID", user.getLOGIN_ID());
		param.put("USE_YN", "S");

	    // 선택 처리
	    int udpateCar = common.update(param, "updateNumplateUseYn");

	    if(udpateCar <= 0) {
		return ApiResponse.fail("번호판 상태 변경에 실패했습니다.");
	    }
		// SP가 직접 번호를 선택한 경우 고객 문자 배정은 더 이상 유효하지 않으므로
		// 남은 P 번호를 N으로 복구하고 CONFIRM_NO/토큰을 함께 제거한다.
		Map<String, Object> messageParam = Map.of("SERVICE_ID", serviceId);
		common.update(messageParam, "releasePreviousNumplateMessage");
		common.update(messageParam, "clearNumplateMessageDetach");
	    return ApiResponse.ok();
	}

	/**
	 * 문자로 보낼 번호판 목록을 화면 순서대로 정규화한다.
	 * CONFIRM_NO의 표시 순서도 이 목록을 기준으로 하므로 LinkedHashSet으로 순서를 보존하며,
	 * 빈 값·중복·10개 초과 요청은 서버에서 다시 차단한다.
	 */
	static List<String> normalizeNumplateMessageList(Object value) {
		if (!(value instanceof List<?>)) {
			throw new BusinessException("번호판 목록이 필요합니다.");
		}
		List<?> values = (List<?>) value;
		LinkedHashSet<String> unique = values.stream()
				.map(v -> Objects.toString(v, "").trim())
				.filter(v -> !v.isEmpty())
				.collect(Collectors.toCollection(LinkedHashSet::new));
		if (unique.size() != values.size() || unique.isEmpty() || unique.size() > 10) {
			throw new BusinessException("중복 없는 번호판을 1~10개까지 선택해 주세요.");
		}
		return new ArrayList<>(unique);
	}

	/** 고객 번호판 조회용 공개 토큰을 만들고 문자로 발송한다. 번호판 추출은 고객이 조회 버튼을 누를 때 수행한다. */
	@Transactional
	public Map<String, Object> sendNumplateSelectionMessage(Map<String, Object> param, UserDto user) {
		if (!"SU".equals(user.getMEMBER_GB())) {
			throw new BusinessException("SP 계정만 번호판 선택 문자를 발송할 수 있습니다.");
		}

		String serviceId = Objects.toString(param.get("SERVICE_ID"), "").trim();
		serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.CHANGE_STATUS);
		String phone = Objects.toString(param.get("PAY_HP_NO"), "").replaceAll("\\D", "");
		String baseUrl = Objects.toString(publicBaseUrl, "").trim().replaceAll("/+$", "");
		if (!phone.matches("\\d{10,11}") || !baseUrl.matches("https?://.+")) {
			throw new BusinessException("수신번호 또는 서버 접속 주소를 확인해 주세요.");
		}

		Map<String, Object> work = new HashMap<>();
		work.put("SERVICE_ID", serviceId);
		// 재발송과 고객 선택이 엇갈려 서로 다른 토큰을 덮어쓰지 않도록 서비스 행을 잠근다.
		Map<String, Object> detachRow = common.select(work, "lockNumplateMessageDetach");
		if (detachRow == null) {
			throw new BusinessException("번호판 배정 정보를 찾을 수 없습니다.");
		}

		String existingToken = Objects.toString(detachRow.get("NUMPLATE_MSG_TOKEN"), "").trim();

		// DB에 토큰이 있으면 화면의 재발송 상태와 무관하게 기존 링크를 재사용한다.
		if (!existingToken.isEmpty()) {
			// 이미 고객이 선택을 완료했는지 확인
			Map<String, Object> currentStatus = common.select(Map.of("SERVICE_ID", serviceId), "selectNumplateMessageStatus");
			if (currentStatus != null && !Objects.toString(currentStatus.get("REQ_CAR_NO"), "").isEmpty()) {
				throw new BusinessException("고객이 이미 번호판 선택을 완료했습니다.");
			}

			String confirmNo = Objects.toString(detachRow.get("CONFIRM_NO"), "");
			List<String> carNos = confirmNo.isBlank() ? List.of() : Arrays.asList(confirmNo.split(","));
			String url = baseUrl + "/customer/WaNewcarNumplateSelect?t=" + existingToken;
			Map<String, Object> sms = new HashMap<>();
			sms.put("PAY_HP_NO", phone);
			sms.put("MSG_TYPE", "3");
			sms.put("SUBJECT", "차량 번호 선택");
			sms.put("TEXT", "안녕하세요. 폴스타 차량번호 선택을 위하여 아래 링크에서 번호판 조회 후 5분 이내에 차량 번호를 선택해 주세요.\r\n" + url + "\r\n※ 본 메시지는 자동 발송되는 발신전용 메시지입니다. 차량 등록과 관련하여 문의사항이 있으신 고객님은 담당 스페셜리스트에게 문의 부탁 드립니다. \n" + //
							"담당 스페셜리스트 : " + Objects.toString(user.getMPHONE_NO(), ""));
			sendNumplateSmsAfterCommit(sms, serviceId);

			return Map.of("token", existingToken, "confirmNo", confirmNo, "carNos", carNos, "expiresInSeconds", 300, "isResend", true);
		}

		// 기존 링크에 남은 미선택 번호를 복구한 뒤 새 토큰은 조회 전 상태로 저장한다.
		common.update(work, "releasePreviousNumplateMessage");
		String token = UUID.randomUUID().toString().replace("-", "");
		work.put("TOKEN", token);
		if (common.update(work, "updateNumplateMessageToken") != 1) {
			throw new BusinessException("번호판 선택 링크 생성에 실패했습니다.");
		}

		String url = baseUrl + "/customer/WaNewcarNumplateSelect?t=" + token;
		Map<String, Object> sms = new HashMap<>();
		sms.put("PAY_HP_NO", phone);
		sms.put("MSG_TYPE", "3");
		sms.put("SUBJECT", "차량 번호 선택");
		sms.put("TEXT", "안녕하세요. 폴스타 차량번호 선택을 위하여 아래 링크에서 번호판 조회 후 5분 이내에 차량 번호를 선택해 주세요.\r\n" + url + "\r\n※ 본 메시지는 자동 발송되는 발신전용 메시지입니다. 차량 등록과 관련하여 문의사항이 있으신 고객님은 담당 스페셜리스트에게 문의 부탁 드립니다. \n" + //
						"담당 스페셜리스트 : " + Objects.toString(user.getMPHONE_NO(), ""));
		sendNumplateSmsAfterCommit(sms, serviceId);

		return Map.of("token", token, "confirmNo", "", "carNos", List.of(), "expiresInSeconds", 300, "isResend", false);
	}

	/**
	 * SP 화면 폴링 및 모달 재오픈 시 사용하는 배정 상태를 반환한다.
	 * NONE: 활성 토큰 없음, ACTIVE: 5분 이내 선택 대기, SELECTED: 고객 선택 완료,
	 * EXPIRED: 토큰은 남아 있으나 선택 가능 시간이 지남.
	 */
	public Map<String, Object> getNumplateSelectionStatus(String serviceId, UserDto user) {
		if (!"SU".equals(user.getMEMBER_GB())) {
			throw new BusinessException("SP 계정만 조회할 수 있습니다.");
		}
		serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.READ_DETAIL);
		Map<String, Object> row = common.select(Map.of("SERVICE_ID", serviceId), "selectNumplateMessageStatus");
		if (row == null || row.get("NUMPLATE_MSG_TOKEN") == null) {
			return Map.of("state", "NONE");
		}
		String selected = Objects.toString(row.get("REQ_CAR_NO"), "");
		Map<String, Object> result = new HashMap<>(row);
		int selectCount = getNumplateSelectCount(row);
		String state = !selected.isEmpty()
				? "SELECTED"
				: selectCount == 0 && row.get("NUMPLATE_SELECT_TIME") == null
						? "WAITING"
						: "Y".equals(row.get("ACTIVE_YN")) ? "ACTIVE" : "EXPIRED";
		result.put("state", state);
		if ("ACTIVE".equals(state)) {
			String confirmNo = Objects.toString(row.get("CONFIRM_NO"), "");
			result.put("carNos", confirmNo.isBlank() ? List.of() : Arrays.asList(confirmNo.split(",")));
		}
		return result;
	}

	/**
	 * 공개 링크의 토큰으로 고객/차량/배정 번호를 조회한다.
	 * 아직 선택하지 않은 건만 5분 만료를 적용한다. 이미 선택한 번호는 고객이 같은 링크를
	 * 다시 열어도 완료 결과를 확인할 수 있도록 만료 후에도 반환한다.
	 */
	public Map<String, Object> getCustomerNumplateSelection2(String token) {
		Map<String, Object> work = Map.of("TOKEN", Objects.toString(token, ""));
		Map<String, Object> assignment = common.select(work, "selectNumplateMessageForUpdate");
		if (assignment == null) {
			throw new BusinessException("유효하지 않은 번호판 선택 링크입니다.");
		}
		String selected = Objects.toString(assignment.get("REQ_CAR_NO"), "");
		Object appearedAt = assignment.get("APPEAR_DT");
		if (selected.isEmpty() && (!(appearedAt instanceof java.util.Date)
				|| ((java.util.Date) appearedAt).toInstant().plusSeconds(300).isBefore(Instant.now()))) {
			throw new BusinessException("번호판 선택 시간이 만료되었습니다.");
		}
		Map<String, Object> listParam = new HashMap<>(work);
		listParam.put("CONFIRM_NO", assignment.get("CONFIRM_NO"));
		List<Map<String, Object>> rows = common.selectList(listParam, "selectNumplateMessageList");
		Map<String, Object> result = new HashMap<>();
		result.put("carNos", rows);
		result.put("selectedCarNo", selected);
		result.put("expiresAt", rows.isEmpty() ? "" : Objects.toString(rows.get(0).get("EXPIRES_AT"), ""));
		result.put("customerName", Objects.toString(assignment.get("CUSTOMER_NM"), ""));
		result.put("carIdNo", Objects.toString(assignment.get("CARID_NO"), ""));
		result.put("carName", Objects.toString(assignment.get("CAR_NM"), ""));
		return result;
	}

	/** 공개 링크 진입 시 상태만 조회한다. 이 단계에서는 조회 횟수와 조회 시각을 변경하지 않는다. */
	public Map<String, Object> getCustomerNumplateSelection(String token) {
		String normalizedToken = normalizeCustomerNumplateToken(token);
		Map<String, Object> work = Map.of("TOKEN", normalizedToken);
		Map<String, Object> assignment = common.select(work, "selectCustomerNumplateAccess");
		
		if (assignment == null) {
			throw new BusinessException("유효하지 않은 번호판 선택 링크입니다.");
		}
		
		return buildCustomerNumplateSelectionResult(work, assignment);
	}

	/** 8천만원 이상 법인 차량의 번호판 종류를 번호 조회 시작 전에 한 번만 저장한다. */
	@Transactional
	public Map<String, Object> selectCustomerNumplateType(Map<String, Object> param) {
		String normalizedToken = normalizeCustomerNumplateToken(
				Objects.toString(param.get("TOKEN"), ""));
		String numplateGb = Objects.toString(param.get("NUMPLATE_GB"), "")
				.trim().toUpperCase();
		if (!"2G".equals(numplateGb) && !"FG".equals(numplateGb)) {
			throw new BusinessException("선택할 수 없는 번호판 종류입니다.");
		}

		Map<String, Object> work = new HashMap<>();
		work.put("TOKEN", normalizedToken);
		Map<String, Object> assignment = common.select(work, "selectCustomerNumplateAccess");
		if (assignment == null) {
			throw new BusinessException("유효하지 않은 번호판 선택 링크입니다.");
		}
		if (!isPremiumCorporateNumplateTarget(assignment)) {
			throw new BusinessException("번호판 종류 선택 대상이 아닙니다.");
		}
		if (!Objects.toString(assignment.get("REQ_CAR_NO"), "").isBlank()) {
			throw new BusinessException("이미 차량 번호 선택이 완료되었습니다.");
		}

		String savedNumplateGb = Objects.toString(assignment.get("SAVED_NUMPLATE_GB"), "");
		if (hasSelectedNumplateType(savedNumplateGb)) {
			if (savedNumplateGb.equalsIgnoreCase(numplateGb)) {
				return buildCustomerNumplateSelectionResult(work, assignment);
			}
			throw new BusinessException("번호판 종류가 이미 선택되었습니다.");
		}
		if (getNumplateSelectCount(assignment) != 0
				|| assignment.get("NUMPLATE_SELECT_TIME") != null) {
			throw new BusinessException("번호판 조회가 시작되어 종류를 변경할 수 없습니다.");
		}

		work.put("NUMPLATE_GB", numplateGb);
		if (common.update(work, "updateCustomerNumplateType") != 1) {
			throw new BusinessException("번호판 종류 저장에 실패했습니다.");
		}
		assignment = common.select(Map.of("TOKEN", normalizedToken), "selectCustomerNumplateAccess");
		if (assignment == null) {
			throw new BusinessException("번호판 종류 저장 결과를 확인할 수 없습니다.");
		}
		return buildCustomerNumplateSelectionResult(
				Map.of("TOKEN", normalizedToken), assignment);
	}

	/** 번호판 조회 버튼을 누른 시점에 최초 조회 횟수와 5분 타이머 시작 시각을 기록한다. */
	@Transactional
	public Map<String, Object> startCustomerNumplateSelection(String token) {
		String normalizedToken = normalizeCustomerNumplateToken(token);
		Map<String, Object> work = Map.of("TOKEN", normalizedToken);
		Map<String, Object> assignment = common.select(work, "selectCustomerNumplateAccess");
		if (assignment == null) {
			throw new BusinessException("유효하지 않은 번호판 선택 링크입니다.");
		}

		int selectCount = getNumplateSelectCount(assignment);
		Map<String, Object> originalAssignment = assignment;
		if (selectCount == 0 && assignment.get("NUMPLATE_SELECT_TIME") == null
				&& common.update(work, "startCustomerNumplateAccess") == 1) {
			assignment = common.select(work, "selectCustomerNumplateAccess");
			if (assignment == null) {
				throw new BusinessException("유효하지 않은 번호판 선택 링크입니다.");
			}

			Map<String, Object> drawParam = new HashMap<>(assignment);
			drawParam.put("TOKEN", normalizedToken);
			drawParam.put("LIMIT", 10);
			// 관리자가 COUNT를 0으로 초기화한 재조회라면 이전 P 후보를 먼저 모두 반환한다.
			common.update(drawParam, "releasePreviousNumplateMessage");
			common.update(drawParam, "clearNumplateMessageDetach");
			List<String> carNos = common.selectList(drawParam, "selectRandomCustomerNumplateList");
			if (carNos == null || carNos.size() < 10) {
				logger.warn("번호판 조회 실패 - 후보 10개 미만. SERVICE_ID={}, count={}",
						assignment.get("SERVICE_ID"), carNos == null ? 0 : carNos.size());
				return buildInsufficientNumplateResult(work, originalAssignment);
			}

			drawParam.put("NUM_LIST", carNos);
			int assignedCount = common.update(drawParam, "assignRandomCustomerNumplateList");
			if (assignedCount != 10) {
				logger.warn("번호판 조회 실패 - 점유 10개 미만. SERVICE_ID={}, count={}",
						assignment.get("SERVICE_ID"), assignedCount);
				return buildInsufficientNumplateResult(work, originalAssignment);
			}

			String confirmNo = String.join(",", carNos);
			drawParam.put("CONFIRM_NO", confirmNo);
			if (common.update(drawParam, "updateCustomerNumplateCandidates") != 1
					|| common.update(drawParam, "appendCustomerNumplateLookupMemo") != 1) {
				throw new BusinessException("번호판 조회 결과 저장에 실패했습니다.");
			}
			assignment = common.select(work, "selectCustomerNumplateAccess");
		}
		return buildCustomerNumplateSelectionResult(work, assignment);
	}

	private Map<String, Object> buildInsufficientNumplateResult(
			Map<String, Object> work, Map<String, Object> originalAssignment) {
		Map<String, Object> result = buildCustomerNumplateSelectionResult(work, originalAssignment);
		result.put("carNos", List.of());
		result.put("lookupFailed", true);
		// 조회 횟수·시각과 임시 점유를 모두 되돌려 다음 방문에서 다시 조회할 수 있게 한다.
		TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
		return result;
	}

	private Map<String, Object> buildCustomerNumplateSelectionResult(
			Map<String, Object> work, Map<String, Object> assignment) {
		
		Map<String, Object> listParam = new HashMap<>(work);
		listParam.put("CONFIRM_NO", assignment.get("CONFIRM_NO"));
		List<Map<String, Object>> rows = common.selectList(listParam, "selectNumplateMessageList");
		int selectCount = getNumplateSelectCount(assignment);

		Map<String, Object> result = new HashMap<>();
		result.put("serviceId", Objects.toString(assignment.get("SERVICE_ID"), ""));
		result.put("carNos", rows);
		result.put("selectedCarNo", Objects.toString(assignment.get("REQ_CAR_NO"), ""));
		result.put("expiresAt", Objects.toString(assignment.get("EXPIRES_AT"), ""));
		result.put("customerName", Objects.toString(assignment.get("CUSTOMER_NM"), ""));
		result.put("carIdNo", Objects.toString(assignment.get("CARID_NO"), ""));
		result.put("carName", Objects.toString(assignment.get("CAR_NM"), ""));
		result.put("linkId", Objects.toString(assignment.get("LINK_ID"), ""));
		result.put("numplateGb", Objects.toString(assignment.get("SAVED_NUMPLATE_GB"), ""));
		result.put("insuranceDeadline", Objects.toString(assignment.get("INSURANCE_DEADLINE"), ""));
		result.put("insuranceStartDate", Objects.toString(assignment.get("INSURANCE_START_DATE"), ""));
		result.put("selectCount", selectCount);
		result.put("selectionStarted", selectCount >= 1);
		result.put("canStart", selectCount == 0 && assignment.get("NUMPLATE_SELECT_TIME") == null);
		result.put("lookupFailed", false);
		result.put("requiresNumplateTypeSelection",
				Objects.toString(assignment.get("REQ_CAR_NO"), "").isBlank()
				&& selectCount == 0
				&& assignment.get("NUMPLATE_SELECT_TIME") == null
				&& "Y".equals(Objects.toString(assignment.get("NUMPLATE_TYPE_SELECT_YN"), "N")));
		return result;
	}

	private boolean hasSelectedNumplateType(String numplateGb) {
		String normalized = Objects.toString(numplateGb, "").trim().toUpperCase();
		return normalized.length() >= 2 && normalized.charAt(1) == 'G';
	}

	private boolean isPremiumCorporateNumplateTarget(Map<String, Object> assignment) {
		Object buyAmtValue = assignment.get("BUY_AMT");
		long buyAmt;
		if (buyAmtValue instanceof Number) {
			buyAmt = ((Number) buyAmtValue).longValue();
		} else {
			try {
				buyAmt = Long.parseLong(Objects.toString(buyAmtValue, "0").replace(",", ""));
			} catch (NumberFormatException e) {
				buyAmt = 0L;
			}
		}
		return "B".equals(Objects.toString(assignment.get("REG_GB"), ""))
				&& buyAmt >= 80_000_000L;
	}

	private int getNumplateSelectCount(Map<String, Object> assignment) {
		return assignment.get("NUMPLATE_SELECT_COUNT") instanceof Number
				? ((Number) assignment.get("NUMPLATE_SELECT_COUNT")).intValue()
				: 0;
	}

	private String normalizeCustomerNumplateToken(String token) {
		String normalizedToken = Objects.toString(token, "").trim();
		int nestedTokenIndex = normalizedToken.lastIndexOf("?t=");
		if (nestedTokenIndex >= 0) {
			normalizedToken = normalizedToken.substring(nestedTokenIndex + 3).trim();
		}
		if (!normalizedToken.matches("[A-Za-z0-9_-]{20,128}")) {
			throw new BusinessException("유효하지 않은 번호판 선택 링크입니다.");
		}
		return normalizedToken;
	}

	/**
	 * 고객이 고른 번호를 확정한다.
	 * 토큰 행을 FOR UPDATE로 잠근 뒤 선택 번호는 S(사용), 나머지는 N(미사용)으로 바꾸고
	 * TR_NEWCAR.REQ_CAR_NO까지 한 트랜잭션으로 저장한다. 같은 번호의 재요청은 멱등 성공,
	 * 다른 번호로 다시 선택하는 요청은 거절한다.
	 */
	@Transactional
	public Map<String, Object> confirmCustomerNumplateSelection(Map<String, Object> param) {
		String token = normalizeCustomerNumplateToken(
				Objects.toString(param.get("TOKEN"), ""));
		String carNo = Objects.toString(param.get("CAR_NO"), "").trim();
		if (carNo.isEmpty() || carNo.length() > 20) {
			throw new BusinessException("선택한 번호판이 올바르지 않습니다.", 400);
		}
		// 더블 클릭이나 여러 브라우저의 동시 확정 요청이 한 번호만 선택하도록 배정 행을 잠근다.
		Map<String, Object> assignment = common.select(Map.of("TOKEN", token, "LOCK_YN", "Y"), "selectNumplateMessageForUpdate");
		if (assignment == null) {
			throw new BusinessException("유효하지 않은 번호판 선택 링크입니다.");
		}
		String selected = Objects.toString(assignment.get("REQ_CAR_NO"), "");
		if (!selected.isEmpty()) {
			if (selected.equals(carNo)) return Map.of("carNo", carNo, "alreadySelected", true);
			throw new BusinessException("이미 다른 번호가 선택되었습니다.");
		}
		Object selectedAt = assignment.get("NUMPLATE_SELECT_TIME");
		if (getNumplateSelectCount(assignment) < 1
				|| !(selectedAt instanceof java.util.Date)
				|| !((java.util.Date) selectedAt).toInstant().plusSeconds(300).isAfter(Instant.now())) {
			throw new BusinessException("번호판 선택 시간이 만료되었습니다.");
		}

		Map<String, Object> work = new HashMap<>();
		work.put("TOKEN", token);
		work.put("CAR_NO", carNo);
		work.put("CARID_NO", assignment.get("CARID_NO"));
		work.put("SERVICE_ID", assignment.get("SERVICE_ID"));
		work.put("SELECT_SERVICE_ID", assignment.get("SERVICE_ID") + "_S");
		work.put("NUMPLATE_GB", assignment.get("NUMPLATE_GB"));
		if (common.update(work, "selectCustomerNumplate") != 1) {
			throw new BusinessException("배정되지 않은 번호판입니다.");
		}
		if (common.update(work, "updateSelectedNumplateInstaller") != 1) {
			throw new BusinessException("번호판 탈부착 담당자 정보를 찾을 수 없습니다.");
		}
		common.update(work, "releaseOtherNumplateMessageList");
		work.put("REQ_CAR_NO", carNo);
		if (common.update(work, "updateReqCarNo") != 1) {
			throw new BusinessException("선택 번호 저장에 실패했습니다.");
		}
		return Map.of("carNo", carNo, "alreadySelected", false);
	}

	/**
	 * 1분 주기 스케줄러에서 5분이 지난 번호판 배정을 정리한다.
	 * CONFIRM_NO와 토큰을 지우기 전에 번호 목록을 메모에 남겨야 하므로 아래 실행 순서를 바꾸면 안 된다.
	 * 마지막 쿼리는 문자 토큰 없이 남은 오래된 P 상태까지 안전망으로 복구한다.
	 */
	@Transactional
	public int cleanupExpiredNumplateSelections2() {
		int count = common.update(Map.of(), "appendExpiredNumplateMessageMemo");
		count += common.update(Map.of(), "clearExpiredNumplateMessageDetach");
		count += common.update(Map.of(), "releaseExpiredNumplateMessageList");
		count += common.update(Map.of(), "releaseExpiredPendingNumplateList");
		return count;
	}
	
	@Transactional
	public int cleanupExpiredNumplateSelections() {

	    int memoCount = common.update(
	        Map.of(),
	        "appendExpiredNumplateMessageMemo"
	    );

	    int detachCount = common.update(
	        Map.of(),
	        "clearExpiredNumplateMessageDetach"
	    );

	    int messageCount = common.update(
	        Map.of(),
	        "releaseExpiredNumplateMessageList"
	    );

	    int pendingCount = common.update(
	        Map.of(),
	        "releaseExpiredPendingNumplateList"
	    );

	    logger.info(
	        "[번호판 만료정리] memo={}, detach={}, message={}, pending={}",
	        memoCount,
	        detachCount,
	        messageCount,
	        pendingCount
	    );

	    return memoCount + detachCount + messageCount + pendingCount;
	}

	// 번호판 상태 변경
	public void updateNumplateUseYn(Map<String, Object> param, UserDto user) {
		String serviceId = Objects.toString(param.get("serviceId"), "").trim();
		serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.CHANGE_STATUS);
		String carNo = Objects.toString(param.get("carNo"), "").trim();
		Map<String, Object> detail = newcarMapper.getNewCarDetail(serviceId);
		if (detail == null || !carNo.equals(Objects.toString(detail.get("REQ_CAR_NO"), "").trim())) {
			throw new BusinessException("신청건에 배정된 번호판이 아닙니다.", 409);
		}
		param.put("USE_YN", "N");
		param.put("CAR_NO", carNo);
		param.put("LOGIN_ID", user.getLOGIN_ID());

		int result = common.update(param, "updateNumplateUseYn");

		param.put("SERVICE_ID", serviceId);
		param.put("REQ_CAR_NO", "");
		result += common.update(param, "updateReqCarNo");
	
		if(result < 2) {
		    throw new BusinessException("번호판 미사용 처리 실패");
		}
	}

	public void sendSms(Map<String, Object> param, UserDto user) {
	    newcarMapper.createSms(param);
	}

	// 미사용 번호판 상태복구
	public boolean getNumPlateRelease(
			Map<String, Object> param, UserDto user, HttpSession session) {

	    try {
	        String serviceId = Objects.toString(param.get("SERVICE_ID"), "").trim();
	        serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.UPDATE_SERVICE);
	        String preCarNo = Objects.toString(param.get("PRE_CAR_NO"), "");

	        if (preCarNo.isBlank()) {
	            return true;
	        }

	        List<String> numList = Arrays.stream(preCarNo.split(","))
	                .filter(no -> !no.isBlank())
	                .collect(Collectors.toList());

	        if (numList.isEmpty()) {
	            return true;
	        }
	        List<String> queried = getNumplateSession(session, serviceId);
	        if (queried == null || !queried.containsAll(numList)) {
	            throw new BusinessException("현재 세션에서 조회하지 않은 번호판이 포함되어 있습니다.", 409);
	        }

	        param.put("NUM_LIST", numList);

	        common.update(param, "releaseNumplateList");

	        return true;

	    } catch (BusinessException e) {
	        throw e;
	    } catch (Exception e) {
	        logger.error("getNumPlateRelease fail", e, " param: ", param);
	        return false;
	    }
	}
	
}
