package com.dacos.newcar;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.annotation.Transactional;

import com.dacos.addservice.dto.AddServiceDto;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;
import com.dacos.common.util.CommonUtil;
import com.dacos.commonmenu.dto.CommonMenuSearchRequest;
import com.dacos.commonmenu.mapper.CommonMenuMapper;
import com.dacos.mortgage.mapper.MortgageMapper;
import com.dacos.newcar.dto.NewcarSearchRequest;
import com.dacos.newcar.mapper.NewcarMapper;
import com.dacos.payment.mapper.PaymentMapper;
import com.ibm.icu.text.SimpleDateFormat;

import lombok.RequiredArgsConstructor;

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
    private CommonMenuMapper commonMapper;
    @Autowired
    private CommonUtil commonUtil;
    @Autowired
    private CommonRepository common;
    
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

        // ===== 서비스 정보 =====
        Map<String, Object> service = mortgageMapper.getTrService(serviceId);
        if (service == null || service.isEmpty()) {
            throw new BusinessException("서비스 정보 없음: " + serviceId, 404);
        }

        // ===== 신차 정보 =====
        Map<String, Object> detail = newcarMapper.getNewCarDetail(serviceId);
        if (detail == null || detail.isEmpty()) {
            throw new BusinessException("신차 정보 없음: " + serviceId, 404);
        }

        // ===== 공통 파라미터 =====
        Map<String, Object> param = new HashMap<>();
        param.put("SERVICE_ID", serviceId);
        param.put("CompanyID", service.get("COMPANY_ID"));
        param.put("WORK_CD", service.get("WORK_CD"));
        param.put("AssoID", service.get("ASSOCIATION_ID"));

        // ===== 기타 정보 =====
        List<Map<String, Object>> paymentList = paymentMapper.getPaymentList(serviceId);
        List<Map<String, Object>> ownerList = newcarMapper.getOwnerInfoList(param);

        // 🔥 branch / base는 LIST가 맞다
        List<Map<String, Object>> branchList = newcarMapper.getBranchList(param);
        List<Map<String, Object>> baseList = newcarMapper.getBaseList(param);

        List<Map<String, Object>> workCp = mortgageMapper.getWorkCp(param);
        Map<String, Object> carNoDetach = newcarMapper.getTrCarNoDetach(param);

        // ===== 공동 소유자 분리 =====
        Map<String, Object> owner0 = new HashMap<>();
        Map<String, Object> owner1 = new HashMap<>();

        if (ownerList != null && ownerList.size() > 0) {
            owner0 = ownerList.get(0);
        }

        if (ownerList != null && ownerList.size() > 1) {
            owner1 = ownerList.get(1);
        }

        // ===== 결과 구성 =====
        result.put("dsService", service);
        result.put("dsNewCar", detail);
        result.put("dsPaymentList", paymentList);
        result.put("dsBranchList", branchList);
        result.put("dsBaseList", baseList);
        result.put("dsOwnerInfo", owner0);
        result.put("dsOwnerInfo1", owner1);
        result.put("dsCarNoDetach", carNoDetach != null ? carNoDetach : new HashMap<>());
        result.put("dsWorkCp", workCp != null ? workCp : new HashMap<>());

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
			Map<String, Object> mWorkCd = commonMapper.getWorkCp(req);
			
		    // 순서대로 [ 취득세 채권취급수수료 채권 등록수수료 인지세 예비비 증지대 번호판대 번호판대행 등록면허세 ]
		    String[] aPayKd = {"ACQ", "BFEE", "BOND", "FEE", "INJI", "SPARE", "STAMP", "TNUM", "UNUM", "UREG"};
		    
		    // 세금 정보 조회
	        Map<String, Object> mTaxInfo = common.selectOne("010", "getTmTax");

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
	

	@Transactional
	public Map<String, String> processNewCar(Map<String, Object> mNewCar, 
			Map<String, Object> mService, Map<String, Object> mCarNoDetach, 
			List<Map<String, Object>> lOwnerInfoList, List<Map<String, Object>> paymentList) {
		logger.info("mService11 >>>" + mService);
		
		Map<String, Object> input = commonUtil.mergeMap(mService, mNewCar, mCarNoDetach);
	
	    String serviceId = (String) input.get("SERVICE_ID");
	
	    if (commonUtil.isEmpty(serviceId)) {
	        return insertNewCar(input, mService, lOwnerInfoList, paymentList);
	    }
	
	    return updateNewCar(input, mService, lOwnerInfoList, paymentList);
	}
	
	// 신규등록 insert
	private Map<String, String> insertNewCar(Map<String, Object> input,
	        Map<String, Object> mService, List<Map<String, Object>> lOwnerInfoList,
	        List<Map<String, Object>> paymentList) {
	
		// 중복된 차대번호 조회
	    if (isDuplicateCar(input)) {
	        throw new RuntimeException("중복된 차대번호입니다.");
	    }
	
	    String serviceId = commonUtil.toServiceId(mService);
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
	    return !common.commonSelectList(where, "selectDuplicateCarIdNO").isEmpty();
	}

	public List<String> getNumplateList(Map<String, Object> param, UserDto user) {
	    param.put("LOGIN_ID", user.getLOGIN_ID());
	    return newcarMapper.getNumplateList(param);
	}

	public void selectNumplate(Map<String, Object> param, UserDto user) {
	    param.put("LOGIN_ID", user.getLOGIN_ID());

	    // 패키지 실행
	    newcarMapper.callAvailNumplate(param);

	    // 선택 처리
	    newcarMapper.updateNumplate(param);
	}

	public void sendSms(Map<String, Object> param, UserDto user) {
	    newcarMapper.createSms(param);
	}
}
