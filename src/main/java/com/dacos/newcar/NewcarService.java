package com.dacos.newcar;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dacos.addservice.dto.AddServiceDto;
import com.dacos.auth.AuthService;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.ApiResponse;
import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;
import com.dacos.common.CommonService;
import com.dacos.common.mapper.CommonMapper;
import com.dacos.common.util.CommonUtil;
import com.dacos.company.mapper.CompanyMapper;
import com.dacos.mortgage.mapper.MortgageMapper;
import com.dacos.newcar.dto.NewcarSearchRequest;
import com.dacos.newcar.mapper.NewcarMapper;
import com.dacos.numplate.mapper.NumPlateMapper;
import com.dacos.payment.mapper.PaymentMapper;

/**
 * 신차 등록 서비스
 * - getNewCarList: Map으로 반환하여 컬럼명 그대로 프론트에 전달 (직렬화 문제 방지)
 */
@Service
public class NewcarService {

    private static final Logger logger = LoggerFactory.getLogger(NewcarService.class);
    
    // 번호판대 계산 시 사용하는 번호판 구분 코드
	public static final String NORMAL = "7";
	public static final String FILM   = "F";
	public static final String ETC    = "X";

    @Autowired
    private NewcarMapper newcarMapper;
    @Autowired
    private MortgageMapper mortgageMapper;
    @Autowired
    private PaymentMapper paymentMapper;
    @Autowired
    private NumPlateMapper numplateMapper;
    @Autowired
    private CommonMapper commonMapper;
    @Autowired
    private CompanyMapper companyMapper;
    @Autowired
    private CommonService commonService;
    @Autowired
    private AuthService authService;
    @Autowired
    private CommonUtil commonUtil; // 자주 쓰는 메소드
    @Autowired
    private CommonRepository common; // DB 접근 역할
    
    /**
     * 신차 등록 목록 조회
     * - resultType을 Map으로 사용하여 MyBatis 컬럼 별칭이 JSON 키로 그대로 사용됨
     */
    public List<Map<String, Object>> getNewCarList(NewcarSearchRequest request) {
        logger.info("[NewcarService] 신차 목록 조회 - 기간: {} ~ {}", request.getSTART_DT(), request.getEND_DT());
        return newcarMapper.getNewCarList(request);
    }

    /**
     * 신차 등록 상세 조회
     */
    public Map<String, Object> getNewCarDetail(String serviceId) {

        logger.info("[NewcarService] 신차 상세 조회 - serviceId: {}", serviceId);

        Map<String, Object> result = new HashMap<>();

        // 서비스 정보
        Map<String, Object> service = 
        		mortgageMapper.getTrService(serviceId);
        
        if (service == null || service.isEmpty()) {
            throw new BusinessException("서비스 정보 없음: " + serviceId, 404);
        }

        // 신차 정보
        Map<String, Object> detail = 
        		newcarMapper.getNewCarDetail(serviceId);
        
        if (detail == null || detail.isEmpty()) {
            throw new BusinessException("신차 정보 없음: " + serviceId, 404);
        }

        // 공통 데이터 조회
        result.putAll(
            authService.getCommonServiceData(service)
        );
        
        // 기타 정보
        List<Map<String, Object>> paymentList =
            paymentMapper.getPaymentList(serviceId);

        List<Map<String, Object>> ownerList =
            newcarMapper.getOwnerInfoList(service);

        Map<String, Object> carNoDetach =
            newcarMapper.getTrCarNoDetach(service);

        // 공동 소유자 분리
        Map<String, Object> owner0 = new HashMap<>();
        Map<String, Object> owner1 = new HashMap<>();

        if (ownerList != null && ownerList.size() > 0) {
            owner0 = ownerList.get(0);
        }

        if (ownerList != null && ownerList.size() > 1) {
            owner1 = ownerList.get(1);
        }
        
        // 결과 세팅
        result.put("dsNewCar", detail);
        result.put("dsPaymentList", paymentList);
        result.put("dsOwnerInfo", owner0);
        result.put("dsOwnerInfo1", owner1);
        result.put(
            "dsCarNoDetach",
            carNoDetach != null ? carNoDetach : new HashMap<>()
        );

        return result;
    }
    /**
     * 결제정보 초기값
     */
	List<Map<String, Object>> getPaymentList(UserDto user) {
		String companyId = user.getCOMPANY_ID();
		
		List<Map<String, Object>> list = new ArrayList<>();
		
		if(companyId != null) {

			// 서비스 사용 조회
			AddServiceDto req = new AddServiceDto();
			req.setWORK_CD("010");
			req.setCOMPANY_ID(companyId);
			
			Map<String, Object> mWorkCd = common.select(req, "getWorkCp");
					
		    // 순서대로 [ 취득세 채권취급수수료 채권 등록수수료 인지세 예비비 증지대 번호판대 번호판대행 등록면허세 ]
		    String[] aPayKd = {"ACQ", "BFEE", "BOND", "FEE", "INJI", "SPARE", "STAMP", "TNUM", "UNUM", "UREG"};
		    
		    // 세금 정보 조회
	        Map<String, Object> mTaxInfo = common.select("010", "getTmTax");

		    for (String kd : aPayKd) {
		        Map<String, Object> row = new HashMap<>();
		        row.put("PAY_KD", kd);
		        row.put("PAY_OP", "Y");
		        row.put("PAY_ST", "N");

		        int amt = 0;
		        
		        // 인지세 
		        if("INJI".equals(kd)) {
		        	amt = commonUtil.toInt(mTaxInfo.get("REGIST_AMT"));
		        	logger.info("인지세 : ", amt);
		        }
		        
		        // 예비비
		        if("SPARE".equals(kd)) {
		        	
					req.setWORK_CD("010");
					req.setCOMPANY_ID(companyId);
		        	
		        	amt = commonUtil.toInt(mWorkCd.get("FEE"));
		        	logger.info("예비비 : ", amt);
		        }
		        
		        // 증지대
		        if ("STAMP".equals(kd)) {
				    amt = commonUtil.toInt(mTaxInfo.get("STAMP_AMT"));
				    logger.info("증지대 : ", amt);
		        }
		        
		        // 취득세, 채권취급수수료, 채권, 등록수수료, 등록면허세, 번호판대, 번호판대행
		        if ("ACQ".equals(kd) || "BFEE".equals(kd) || "BOND".equals(kd) || "UREG".equals(kd) || "TNUM".equals(kd) || "UNUM".equals(kd)) {
		            amt = 0; // deliveryGb 없으니까 0
		            logger.info("나머지 : ", amt);
		        }

		        row.put("PAY_AMT", amt);
		        row.put("PRE_PAY_AMT", amt);

		        list.add(row);
		    }

	    }
	
	    return list;
	}
	

	// 신규등록 기본정보 초기화
    // 접수번호 없는 경우 이쪽으로 들어온다.
	public Map<String, Object> initNewCar(UserDto user) {

	    // 화면 초기 데이터
	    Map<String, Object> result = new HashMap<>();
	    
	    // 공통 파라미터
	    Map<String, Object> param = authService.toMap(user, "010");
	    
	    // 공통 데이터 조회
	    result.putAll(
	        authService.getCommonServiceData(param)
	    );
	    
	    // 회사별 초기값 조회
	    List<Map<String, Object>> configList =
	        companyMapper.selectCompanyConfigList(param);

	    // 데이터셋 초기화
	    Map<String, Object> dsNewCar = new HashMap<>();
	    Map<String, Object> dsOwnerInfo = new HashMap<>();
	    Map<String, Object> dsOwnerInfo1 = new HashMap<>();
	    Map<String, Object> dsCarNoDetach = new HashMap<>();
	    
	    // 공통 dsService 가져오기
	    Map<String, Object> dsService =
	        (Map<String, Object>) result.get("dsService");
	    
	    // DEFAULT 설정 적용
	    for(Map<String, Object> config : configList) {

	        String dataset = String.valueOf(config.get("DATASET"));
	        String fieldId = String.valueOf(config.get("FIELD_ID"));
	        String ruleType = String.valueOf(config.get("RULE_TYPE"));
	        String ruleValue = String.valueOf(config.get("RULE_VALUE"));

	        if(!"DEFAULT".equals(ruleType)) {
	            continue;
	        }

	        if("dsService".equals(dataset)) {
	            dsService.put(fieldId, ruleValue);

	        } else if("dsNewCar".equals(dataset)) {
	            dsNewCar.put(fieldId, ruleValue);

	        } else if("dsOwnerInfo".equals(dataset)) {
	            dsOwnerInfo.put(fieldId, ruleValue);

	        } else if("dsCarNoDetach".equals(dataset)) {
	            dsCarNoDetach.put(fieldId, ruleValue);
	        }
	    }

	    // 결제정보
	    List<Map<String, Object>> dsPaymentList =
	        getPaymentList(user);

	    // 결과 세팅
	    result.put("dsNewCar", dsNewCar);
	    result.put("dsOwnerInfo", dsOwnerInfo);
	    result.put("dsOwnerInfo1", dsOwnerInfo1);
	    result.put("dsCarNoDetach", dsCarNoDetach);
	    result.put("dsPaymentList", dsPaymentList);

	    return result;
	}
	
	/**
	 * 신규등록 저장 및 신청 프로세스
	 * - 저장/수정 공통 처리
	 * - 일반 신청건은 관청 서버 연계 처리
	 * - 폴스타 선납건은 가상계좌 생성 및 납부 요청 처리
	 */
	@Transactional
	public Map<String, Object> processNewCar(Map<String, Object> request, UserDto user) {
	    // 성공 반환
	    Map<String, Object> result = new HashMap<>();
	   
		try {
			logger.info("[NewcarService] 신규등록 저장 및 신청 프로세스");
			
			 // 데이터 파싱
		    Map<String, Object> mService = commonUtil.getMap(request, "dsService");
		    Map<String, Object> mNewCar = commonUtil.getMap(request, "dsNewCar");
		    Map<String, Object> mCarNoDetach = commonUtil.getMap(request, "dsCarNoDetach");
		    
		    List<Map<String, Object>> lPaymentList = commonUtil.getList(request, "dsPaymentList");
		    List<Map<String, Object>> lOwnerInfoList = commonUtil.getList(request, "dsOwnerInfo");
		    
		    // 처리상태
		    String procSt = String.valueOf(mService.get("PROC_ST"));
		    
		    boolean isRequest = "REQ".equals(procSt)|| "B_REQ".equals(procSt);
		    
		    // 데이터 병합
		    Map<String, Object> input = commonUtil.mergeMaps(mService, mNewCar, mCarNoDetach);
		    
		    logger.info("mNewCar >>> " + mNewCar);
		    logger.info("input >>> " + input);
		    
		    // 로그인 사용자
		    input.put("UPD_USER", user.getLOGIN_ID());
		    
		    // 서비스번호
		    String serviceId = (String) input.get("SERVICE_ID");
		    
		    // insert
		    if (commonUtil.isEmpty(serviceId)) {
		    	insertNewCar(input, mService, lOwnerInfoList, lPaymentList);
		    } 
		    
		    // update
		    else {
		    	updateNewCar(input, mService, lOwnerInfoList, lPaymentList);
		    }

		    result.put("SERVICE_ID", input.get("SERVICE_ID"));
		    result.put("MESSAGE", "저장완료");
		    result.put("", "저장완료");
		    
		    logger.info("isRequest : {}",isRequest);
		    if(isRequest) {
		    	
		    	logger.info("PAY_GB : {}", mNewCar.get("PAY_GB"));
				
		    	// 선납건(폴스타 등)은 가상계좌 생성 후 입금 대기 처리
		    	if("B".equals(mNewCar.get("PAY_GB"))) {
		    		// TODO 가상계좌 생성 및 입금 확인 로직 필요
		    		// 가상계좌 방식일 경우엔 가상계좌 발급 프로시져 호출
	 	    		try {
						logger.debug("프로시져 호출 전");
	 	    			
	 	    			input.put("pInput",  input.get("SERVICE_ID"));
						input.put("pReturn",  "");
	 	    			
						common.call(input, "processVBank");

					} catch (Exception ex) {
						logger.error("processVBank 호출 예외", ex);
						// 예외를 던지면 @Transactional 메서드에서 롤백됩니다.
						throw new RuntimeException("가상계좌 발급 프로시저 호출 실패", ex);
					}
					
					// OUT 파라미터 확인
					String pReturn = input.get("pReturn") != null ? input.get("pReturn").toString() : "";
					if (pReturn == null || pReturn.isBlank() || "FAIL".equalsIgnoreCase(pReturn)) {
						throw new RuntimeException("가상계좌 발급 실패: " + pReturn);
					}
		    	}
		    	
		    	/*
		    	// 후납건은 바로 관청 서버 연계
		        Map<String, Object> linkData = commonUtil.filterMap(input,
		                "SERVICE_ID, WORK_CD, PROC_CD, TASK_CD, CARID_NO,"
		                + " REQUEST_DT, COMPANY_ID, COMPANY_NM, COMPANY_NO,"
		                + " ADDRESS, ADDRESS_DT, POST_NO, BASE_ADDRESS, BASE_ADDRESS_DT, BASE_POST_NO,"
		                + " OWNER_NM, REG_GB, REG_NO, BIZ_NO, BUBJUNG_CD, BASE_BUBJUNG_CD,"
		                + " REQ_CAR_NO, GOVT_ID, NTAX_TRGET_CD, NTAX_WHO, NTAX_TRGET_GR_CD, NTAX_APPLC_CD,"
		                + " MEMBER_ID, PROC_ST, PAY_GB, PAY_ME, TEL_NO, MPHONE_NO,"
		                + " BOND_DC, BOND_LINK_YN, BOND_BANK_CD, ADDR_INFO, ADDR_INFO2");
		        
		        logger.info("linkData >>" + linkData);
		        
		        // 공동소유자 정보
		        StringBuilder ownerInfo = new StringBuilder();

		        for (Map<String, Object> owner : lOwnerInfoList) {
		            StringJoiner joiner = new StringJoiner("ß");
		            
		            joiner.add("SERVICE_ID»"  + getVal(mService, "SERVICE_ID"));
		            joiner.add("SEQ»"         + getVal(owner, "SEQ"));
		            joiner.add("DEBTOR_NM»"   + getVal(owner, "DEBTOR_NM"));
		            joiner.add("DEBTOR_GB»"   + getVal(owner, "DEBTOR_GB"));
		            joiner.add("REG_NO»"      + getVal(owner, "REG_NO"));
		            joiner.add("DEBTOR_RATIO»"+ getVal(owner, "DEBTOR_RATIO"));
		            joiner.add("DEBTOR_ADDR»" + (getVal(owner, "DEBTOR_ADDR") + " " 
		            						  + getVal(owner, "DEBTOR_ADDR_DT")).trim());
		            joiner.add("DSIGN_GB»"    + getVal(owner, "DSIGN_GB"));
		            joiner.add("DSIGN_HP_NO»" + getVal(owner, "DSIGN_HP_NO"));
		            joiner.add("DSIGN_TX»"    + getVal(owner, "DSIGN_TX"));
		            joiner.add("CONFIRM_NO»"  + getVal(owner, "CONFIRM_NO"));
		            joiner.add("DSIGN_ST»"    + getVal(owner, "DSIGN_ST"));
		            joiner.add("IDEN_ST»"     + getVal(owner, "IDEN_ST"));

		            // 관청별 마감 분기 처리
		            if ("BUSAN".equals(input.get("GOVT_ID"))) {
		                ownerInfo.append(joiner.toString()).append("þ");
		            } else {
		                joiner.add("DSIGN_DT»" + getVal(owner, "DSIGN_DT"));
		                joiner.add("IDEN_DT»"  + getVal(owner, "IDEN_DT"));
		                ownerInfo.append(joiner.toString()).append("þ");
		            }
		        }

		        linkData.put("OWNER_INFO", ownerInfo.toString()); // 공동소유데이터
		        linkData.put("SID", "신규등록신청");

		        // 원부 조회 처리
		        JsonNode jsonResponse = commonService.linkServer(linkData);

		        // errorCode = 0(성공), -1(실패)
		        String sErrorCode = jsonResponse.path("errorCode").asText();

		        // 통신 오류
		        if ("-1".equals(sErrorCode)) {
		            result.put("MESSAGE", "관청서버와 통신 중 오류가 발생하였습니다.");
		            throw new RuntimeException("관청 서버 통신 오류");
		            
		        }

	            JsonNode returnMsg = jsonResponse.path("returnMSG");

	            List<Map<String, Object>> lResultList = commonService.setJsonObjectToList(returnMsg);
	            String sCode = commonService.getListData(lResultList, 0, "code");
	            String sMessage = commonService.getListData(lResultList, 0, "message");

	            // 관청 오류
				if ("-1".equals(sCode)) {
				
				    result.put("RESULT_CD", "-1");
				    result.put("MESSAGE", "관청오류");
				
				} else {
				    result.put("RESULT_CD", "0");
				    result.put("MESSAGE", "신청완료");
				}*/
		    }
		} catch (RuntimeException e) {
		
		    logger.error("신규등록 처리 오류", e);
		    result.put("RESULT_CD", "-2");
		    result.put("MESSAGE", e.getMessage());
		
		} catch (Exception e) {
		    logger.error("신규등록 처리 중 시스템 오류", e);
		    result.put("RESULT_CD", "-3");
		    result.put("MESSAGE", "처리 중 오류가 발생하였습니다.");
		
		}
		
		return ApiResponse.withKey("data", result);
	}
	
	// 
	
	/**
	 * Map에서 값을 꺼내 문자열로 반환 (null이면 빈 값)
	 */
	private String getVal(Map<String, Object> map, String key) {
	    Object val = map.get(key);
	    return val != null ? val.toString() : "";
	}
	
	// 신규등록 insert
	@Transactional
	private Map<String, String> insertNewCar(Map<String, Object> input,
	        Map<String, Object> mService, List<Map<String, Object>> lOwnerInfoList,
	        List<Map<String, Object>> paymentList) {
	
		// 중복된 차대번호 조회
	    if (isDuplicateCar(input)) {
	        throw new RuntimeException("중복된 차대번호입니다.");
	    }
	
	    String serviceId = "N" + commonUtil.toServiceId(mService);
	    input.put("SERVICE_ID", serviceId);
	    
	    common.insert(input, "insertTrService");
	    common.insert(input, "insertTrNewCar");
	    common.insert(input, "insertTrCarNoDetach");
	    // 공동소유
	    common.insertList(lOwnerInfoList, "insertTrOwnerInfo", serviceId, true);
	    // 결제정보
	    common.insertList(paymentList, "insertTrPayment", serviceId, true);
	
	    return Map.of("SERVICE_ID", serviceId,"MESSAGE", "");
	}
	
	// 신규등록 update
	@Transactional
	private Map<String, String> updateNewCar(Map<String, Object> input,
	        Map<String, Object> mService, List<Map<String, Object>> lOwnerInfoList,
	        List<Map<String, Object>> paymentList) {
		
		String serviceId = input.get("SERVICE_ID").toString();
		
	    if (!Objects.equals("RET", input.get("JUDGE_ST")) && isDuplicateCar(input)) {
	        throw new RuntimeException("중복된 차대번호입니다.");
	    }
	
	    common.update(input, "updateTrService");
	    common.update(input, "updateTrNewCar");
	    common.update(input, "updateTrCarNoDetach");
	    common.replaceList(lOwnerInfoList, "deleteTrOwnerInfo", "insertTrOwnerInfo", serviceId, true);
	    common.replaceList(paymentList, "deleteTrPayment", "insertTrPayment", serviceId, true);
	
	    return Map.of("SERVICE_ID", input.get("SERVICE_ID").toString(),"MESSAGE", "");
	}
	
	// 중복된 차대번호 조회
	private boolean isDuplicateCar(Map<String, Object> input) {
	    var where = Map.of("CARID_NO", input.get("CARID_NO"));
	    return !common.selectList(where, "selectDuplicateCarIdNO").isEmpty();
	}

	// 선택 가능한 번호판 조회
	@Transactional
	public List<String> getNumplateList(Map<String, Object> param, UserDto user) {
		
	    param.put("LOGIN_ID", user.getLOGIN_ID());
	    
	    String taskCd = param.get("TASK_CD") != null 
	    				? param.get("TASK_CD").toString() : "";
	    
	    logger.info("taskCd >>" + taskCd);
	    
	    // 증차배정
	    if("ADD".equals(taskCd)) {
	    	logger.info("ADD 들어옴");
	    	common.call(param, "procedureNewCarAvailNumplateRent");
	    }
	    
	    else {
	    	logger.info("ADD 아님");
	    	common.call(param, "procedureNewCarAvailNumplateHole");
	    }
	    
	    String pReturn = String.valueOf(param.get("pReturn"));
	    
	    List<String> list = new ArrayList<>();
	    
	    if(pReturn != null && !pReturn.isBlank()) {
	    	
	    	for(String s : pReturn.split("/")) {
	    		list.add(s);
	    	}
	    }
	    return list;
	}

	// 번호판 선택
	@Transactional
	public ApiResponse<Object> selectNumplate(Map<String, Object> param, UserDto user) {
	    // 선택한 번호판 중복 체크
	    Map<String, Object> dupCar = common.select(param, "checkDuplicateCarNo");
	    
	    if( dupCar != null ) {
	    	return ApiResponse.fail("이미 등록된 차량번호입니다.");
	    }
	    
		// 선택한 번호판 변경
		param.put("SERVICE_ID", param.get("SERVICE_ID") + "_S");
		param.put("LOGIN_ID", user.getLOGIN_ID());
		param.put("USE_YN", "S");
		
	    // 선택 처리
	    int udpateCar = common.update(param, "updateNumplateUseYn");
	    
	    if(udpateCar <= 0) {
	    	return ApiResponse.fail("번호판 상태 변경에 실패했습니다.");
	    }
	    return ApiResponse.ok();
	}
	
	
	public void updateNumplateUseYn(Map<String, Object> param, UserDto user) {

		param.put("USE_YN", "N");
    	param.put("CAR_NO", param.get("carNo"));
    	param.put("LOGIN_ID", user.getLOGIN_ID());
    	
    	System.out.println(param);
    	int result = common.update(param, "updateNumplateUseYn");
    	
		if(result < 1) {
		    throw new BusinessException("번호판 미사용 처리 실패");
		}
	}
	
	public void sendSms(Map<String, Object> param, UserDto user) {
	    newcarMapper.createSms(param);
	}

	// 미사용 번호판 상태복구
	public boolean getNumPlateRelease(Map<String, Object> param) {
		
	    try {
	        common.call(param, "procedureAvailNumplate");
	        return true;

	    } catch (Exception e) {
	        logger.error("getNumPlateRelease fail", e, " param: ", param);
	        return false;
	    }
	    
	}

}
