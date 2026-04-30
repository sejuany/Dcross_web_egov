package com.dacos.newcar;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.addservice.dto.AddServiceDto;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.commonmenu.dto.CommonMenuSearchRequest;
import com.dacos.commonmenu.mapper.CommonMenuMapper;
import com.dacos.newcar.dto.NewcarSearchRequest;
import com.dacos.newcar.mapper.NewcarMapper;
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
    private PaymentMapper paymentMapper;
    
    @Autowired
    private CommonMenuMapper commonMapper;

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
        
        // 신규등록정보 조회
        Map<String, Object> detail = newcarMapper.getNewCarDetail(serviceId);
        // 결제정보 조회
        List<Map<String, Object>> payment = paymentMapper.getPaymentList(serviceId);
        
        if (detail == null || detail.isEmpty()) {
            throw new BusinessException("해당 서비스 ID의 데이터를 찾을 수 없습니다: " + serviceId, 404);
        }
        
        detail.put("dsPaymentList", payment); // 결제정보 추가
        
        return detail;
    }
    
    /**
     * 결제정보 초기값
     */
	List<Map<String, Object>> getPaymentList(UserDto user) {
		String companyId = user.getCOMPANY_ID();
		
		List<Map<String, Object>> list = new ArrayList<>();
		
		if(companyId != null) {
			
		    // 순서대로 [ 취득세 채권취급수수료 채권 등록수수료 인지세 예비비 증지대 번호판대 번호판대행 등록면허세 ]
		    String[] aPayKd = {"ACQ", "BFEE", "BOND", "FEE", "INJI", "SPARE", "STAMP", "TNUM", "UNUM", "UREG"};
		
		    for (String kd : aPayKd) {
		        Map<String, Object> row = new HashMap<>();
		        row.put("PAY_KD", kd);
		        row.put("PAY_OP", "Y");
		        row.put("PAY_ST", "N");

		        int amt = 0;
		        
		        // 인지세 초기값 
		        if("INJI".equals(kd)) {
				    // 세금 정보 조회
				    Map<String, Object> mTaxInfo = commonMapper.getTmTax("010");
		        	amt = toInt(mTaxInfo.get("REGIST_AMT"));
		        	logger.info("인지세 : ", amt);
		        }
		        
		        // 예비비
		        if("SPARE".equals(kd)) {
		        	AddServiceDto req = new AddServiceDto(); 
					req.setWORK_CD("010");
					req.setCOMPANY_ID(companyId);
					
		        	// 서비스 사용 조회
				    Map<String, Object> mWorkCd = commonMapper.getWorkCp(req);
		        	amt = toInt(mWorkCd.get("FEE"));
		        	logger.info("예비비 : ", amt);
		        }
		        
		        // 증지대
		        if ("STAMP".equals(kd)) {
		        	// 세금 정보 조회
				    Map<String, Object> mTaxInfo = commonMapper.getTmTax("010");
				    amt = toInt(mTaxInfo.get("STAMP_AMT"));
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
	
	// int형으로 캐스팅
	private int toInt(Object obj) {
	    return obj == null ? 0 : ((BigDecimal) obj).intValue();
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
