package com.dacos.newcar;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.StringJoiner;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.dacos.addservice.dto.AddServiceDto;
import com.dacos.auth.AuthService;
import com.dacos.auth.dto.UserDto;
import com.dacos.auth.mapper.AuthMapper;
import com.dacos.common.ApiResponse;
import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;
import com.dacos.common.CommonService;
import com.dacos.common.mapper.CommonMapper;
import com.dacos.common.util.CommonUtil;
import com.dacos.common.util.FieldMapper;
import com.dacos.common.util.FieldMaps;
import com.dacos.commonmenu.dto.CommonMenuSearchRequest;
import com.dacos.commonmenu.mapper.CommonMenuMapper;
import com.dacos.company.mapper.CompanyMapper;
import com.dacos.mortgage.mapper.MortgageMapper;
import com.dacos.newcar.dto.NewcarSearchRequest;
import com.dacos.newcar.mapper.NewcarMapper;
import com.dacos.numplate.mapper.NumPlateMapper;
import com.dacos.payment.mapper.PaymentMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.ibm.icu.text.SimpleDateFormat;
import com.dacos.code.mapper.CodeMapper;

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
    @Autowired
    private CodeMapper codeMapper;
    @Autowired
    private AuthMapper authMapper;
    
    /**
     * 신차 등록 목록 조회
     * - resultType을 Map으로 사용하여 MyBatis 컬럼 별칭이 JSON 키로 그대로 사용됨
     */
    public List<Map<String, Object>> getNewCarList(NewcarSearchRequest request, UserDto user) {
        logger.info("[NewcarService] 신차 목록 조회 - 기간: {} ~ {}", request.getSTART_DT(), request.getEND_DT());
        request.setMEMBER_GB(user.getMEMBER_GB());
        request.setMEMBER_ID(user.getLOGIN_ID());
        return newcarMapper.getNewCarList(request);
    }

    /**
     * 신차 등록 상세 조회
     */
    public Map<String, Object> getNewCarDetail(UserDto user, String serviceId) {

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
        result.put("dsUserInfo", commonUtil.toUpperCaseMap(user));
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
     * 다건 상태 변경
     */
    public int changeProcSt(List<String> serviceIds, String procSt) {
        return newcarMapper.updateProcSt(serviceIds, procSt);
    }
    
    /**
     * 엑셀 검증 - 필수값, 형식, 중복 등
     */
	private List<String> validateExcelRow(Map<String, Object> row, Set<String> excelCarIds, Set<String> excelLinkId, Map<String, String> dlvMap, Map<String, String> suMap) {
		List<String> errors = new ArrayList<>();
		String registDate = Objects.toString(row.get("REGIST_DATE"), "").trim();

		if (isEmpty(registDate)) {
		    errors.add("등록 일자 없음");
		} else {
		    try {
		    	// 등록일자 금일 이후 체크
		        LocalDate regDate = LocalDate.parse(registDate,DateTimeFormatter.ofPattern("yyyyMMdd"));

		        LocalDate today = LocalDate.now();

		        if (regDate.isBefore(today)) {
		            errors.add("등록일자는 금일 이후만 신청가능");
		        }

		    } catch (DateTimeParseException e) {
		        errors.add("등록일자 형식 오류(yyyyMMdd)");
		    }
		}
		
		String carIdNo = Objects.toString(row.get("CARID_NO"), "").trim();
		if (isEmpty(carIdNo)) {
			errors.add("차대번호 없음");
		} else {
			// 자릿수 체크
			if (carIdNo.length() != 17) {
				errors.add("차대번호 확인 필요");
			}
			// 차대번호 엑셀 내 중복 체크
			if (!carIdNo.isBlank()) {
				if (!excelCarIds.add(carIdNo)) {
					errors.add("엑셀 내 중복된 차대번호");
				}
				// DB 중복 체크
				if (isDuplicateCar(row)) {
					errors.add("이미 등록된 차대번호");
				}
			}
			
		}
		
		if (isEmpty(row.get("BUY_AMT"))) {
			errors.add("차량 세금 계산서 금액 없음");
		}
		if (isEmpty(row.get("OWNER_NM"))) {
			errors.add("고객명 없음");
		}
		
		String linkIdNo = Objects.toString(row.get("LINK_ID"), "").trim();
		if (isEmpty(linkIdNo)) {
			errors.add("주문번호 없음");
		} else {
			if (linkIdNo.length() != 8) {
				errors.add("주문번호 확인 필요");
			}
			// 주문번호 엑셀 내 중복
			if (!linkIdNo.isBlank()) {
				if (!excelLinkId.add(linkIdNo)) {
					errors.add("엑셀 내 중복된 주문번호");
				}
				// DB 중복 체크
			    if(!common.selectList(row, "selectDuplicateLinkIdNO").isEmpty()) {
			    	errors.add("이미 등록된 주문번호");
			    }
			}
		}
		
		String spaceGb = Objects.toString(row.get("SPACE_GB"), "").trim();
		if (isEmpty(spaceGb)) {
			row.put("SPACE_GB", "INPUT"); // Space명 없는경우 직접 입력
		} else {
			// 배송지 확인
			String codeId = dlvMap.get(spaceGb);

		    if (codeId == null) {
		        errors.add("존재하지 않는 Space : " + spaceGb);
		    } else {
		        // INSERT 전에 CODE_ID로 치환
		        row.put("SPACE_GB", codeId);
		    }
		}
		
		String spaceNm = Objects.toString(row.get("SPACE_NM"), "").trim();
		if (isEmpty(spaceNm)) {
			errors.add("담당 Specialist 없음");
		} else {
			// 담당 SP확인
			String suId = suMap.get(spaceNm);

		    if (suId == null) {
		        errors.add("존재하지 않는 Specialist : " + spaceNm);
		    } else {
		        // 해당 SU login_id 넣어주기
		        row.put("SPACE_ID", suId);
		    }
		}
		
		return errors;
	}
    
    private boolean isEmpty(Object value) {
        return value == null || value.toString().trim().isEmpty();
    }
    
    private List<Map<String, Object>> parseExcel(MultipartFile file) {
		List<Map<String, Object>> result = new ArrayList<>();
		try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
			Sheet sheet = workbook.getSheetAt(0);
			DataFormatter formatter = new DataFormatter();
			for (int i = 1; i <= sheet.getLastRowNum(); i++) {
				Row excelRow = sheet.getRow(i);
				if (excelRow == null) {
					continue;
				}
				Map<String, Object> row = new HashMap<>();
				row.put("SPACE_GB", getCellValue(excelRow.getCell(2), formatter)); 						//Space명(배송지)
				row.put("SPACE_NM", getCellValue(excelRow.getCell(3), formatter));						//담당 Specialist명
				row.put("LINK_ID", getCellValue(excelRow.getCell(5), formatter));						//주문번호
				row.put("OWNER_NM", getCellValue(excelRow.getCell(6), formatter));						//소유자명
				row.put("CARID_NO", getCellValue(excelRow.getCell(11), formatter));						//차대번호
				row.put("BUY_AMT", getCellValue(excelRow.getCell(28), formatter).replace(",", ""));		//공급가액
				row.put("REGIST_DATE", getCellValue(excelRow.getCell(41), formatter).replace("-", "").replace(".", ""));	//등록일자
				result.add(row);
			}
		} catch (Exception e) {
			throw new RuntimeException("엑셀 읽기 실패", e);
		}
		return result;
    }
    
	private String getCellValue(Cell cell, DataFormatter formatter) {
		if (cell == null) {
			return "";
		}
		return formatter.formatCellValue(cell).trim();
	}
    
    /**
     * 엑셀 업로드
     */
	@Transactional
	public Map<String, Object> uploadExcel(MultipartFile file, UserDto user) throws Exception {
		List<Map<String, Object>> rows = parseExcel(file);
		List<Map<String, Object>> errorList = new ArrayList<>();
		Set<String> excelCarIds = new HashSet<>();
		Set<String> excelLinkId = new HashSet<>();
		
		List<Map<String, Object>> dlvCodes = codeMapper.findCodesByGroupId("DLVGB");
		List<Map<String, Object>> suInfo = authMapper.selectMemberSuInfo(user.getCOMPANY_ID());

		Map<String, String> dlvMap = new HashMap<>();
		Map<String, String> suMap = new HashMap<>();

		for (Map<String, Object> code : dlvCodes) {
			dlvMap.put(Objects.toString(code.get("CODE_NM"), "").trim(), Objects.toString(code.get("CODE_ID"), ""));
		}
		for (Map<String, Object> code : suInfo) {
			suMap.put(Objects.toString(code.get("MEMBER_NM"), "").trim(), Objects.toString(code.get("LOGIN_ID"), ""));
		}
		// =========================
		// 1. 검증 단계
		// =========================
		for (int i = 0; i < rows.size(); i++) {
			Map<String, Object> row = rows.get(i);
			List<String> errors = validateExcelRow(row, excelCarIds, excelLinkId, dlvMap, suMap);
			if (!errors.isEmpty()) {
				errorList.add(Map.of("row", i + 2, "carIdNo", row.get("CARID_NO"), "errors", errors));
			}
		}

		// =========================
		// 2. 에러 있으면 INSERT 중단
		// =========================
		if (!errorList.isEmpty()) {
			return Map.of("success", false, "insertCount", 0, "errors", errorList);
		}

		// =========================
		// 3. INSERT 단계
		// =========================
		int insertCount = 0;

		for (Map<String, Object> row : rows) {
			insertExcelRow(row, user);
			insertCount++;
		}

		return Map.of("success", true, "insertCount", insertCount, "errors", List.of());
	}
	
	private void insertExcelRow(Map<String, Object> row, UserDto user) {

	    Map<String, Object> request = new HashMap<>();
	    Map<String, Object> dsService = new HashMap<>();
	    Map<String, Object> dsNewCar = new HashMap<>();
	    Map<String, Object> dsCarNoDetach = new HashMap<>();
	    Map<String, Object> dsOwnerInfo = new HashMap<>();
	    Map<String, Object> dsOwnerInfo1 = new HashMap<>();
	    
	    // =========================
	    // SERVICE
	    // =========================
	    Map<String, Object> result = initNewCar(user);
	    dsService = (Map<String, Object>) result.get("dsService");
	    dsService.put("WORK_CD", "010");
	    dsService.put("PROC_ST", "C_REQ");
	    dsService.put("LINK_ID", row.get("LINK_ID")); 		// 주문번호
	    dsService.put("MEMBER_ID", row.get("SPACE_ID"));	    // SU 담당자 login_id

	    // =========================
	    // NEWCAR
	    // =========================
	    dsNewCar.put("CARID_NO", row.get("CARID_NO"));
	    dsNewCar.put("OWNER_NM", row.get("OWNER_NM"));
	    dsNewCar.put("BUY_AMT", row.get("BUY_AMT"));
	    dsNewCar.put("REGIST_DATE", row.get("REGIST_DATE")); // 등록일자

	    // =========================
	    // 스페이스(배송지)
	    // =========================
	    dsCarNoDetach.put("DELIVERY_GB", row.get("SPACE_GB"));
	    dsCarNoDetach.put("CUSTOMER_NM", row.get("OWNER_NM")); // 고객명
	    
	    // =========================
	    // OWNERINFO 2Row 넣어줘야함
	    // =========================
	    dsOwnerInfo.put("SEQ", "0");
	    dsOwnerInfo1.put("SEQ", "1");
	    
	    // =========================
	    // PAYMENT
	    // =========================
	    List<Map<String, Object>> dsPaymentList = getPaymentList(user);

	    // =========================
	    // REQUEST 조립
	    // =========================
	    request.put("dsService", dsService);
	    request.put("dsNewCar", dsNewCar);
	    request.put("dsCarNoDetach", dsCarNoDetach);
	    request.put("dsOwnerInfo", dsOwnerInfo);
	    request.put("dsOwnerInfo1", dsOwnerInfo1);
	    request.put("dsPaymentList", dsPaymentList);

	    // =========================
	    // 실제 저장
	    // =========================
	    processNewCar(request, user);
	}
	
	@Transactional
	public int paymentProcess(List<Map<String, Object>> request, UserDto user) {
	    int updateCount = 0;
	    for (Map<String, Object> row : request) {

	        String serviceId = String.valueOf(row.get("SERVICE_ID"));
	        String procSt = String.valueOf(row.get("PROC_ST"));

	        // 상태값 검증
	        if (!"PBEND".equals(procSt) && !"P_END".equals(procSt) && !"S_REQ".equals(procSt)) {
	            throw new BusinessException("잘못된 상태값입니다.");
	        }

	        Map<String, Object> param = new HashMap<>();
	        param.put("SERVICE_ID", serviceId);
	        param.put("PROC_ST", procSt);
	        if ("S_REQ".equals(procSt)) {
	            param.put("JUDGE_ST", "S_REQ");
	        }
	        param.put("UPD_USER", user.getLOGIN_ID());
	        
	        updateCount += common.update(param, "updateTrService");
	        updateCount += common.update(param, "updateBpayYn");
	    }

	    return updateCount;
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
		        	amt = 0;
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
	    
	    // 데이터셋 초기화
	    Map<String, Object> dsNewCar = new HashMap<>();
	    Map<String, Object> dsOwnerInfo = new HashMap<>();
	    Map<String, Object> dsOwnerInfo1 = new HashMap<>();
	    Map<String, Object> dsCarNoDetach = new HashMap<>();
	    
	    // 공통 dsService 가져오기
	    Map<String, Object> dsService =
	        (Map<String, Object>) result.get("dsService");
	    
	    // 결제정보
	    List<Map<String, Object>> dsPaymentList =
	        getPaymentList(user);

	    // 결과 세팅
	    result.put("dsUserInfo", commonUtil.toUpperCaseMap(user));
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
		    List<Map<String, Object>> lOwnerInfoList1 = commonUtil.getList(request, "dsOwnerInfo1");

			// 공동동소유자 컬럼명 변환
			lOwnerInfoList = FieldMapper.convert(lOwnerInfoList, FieldMaps.OWNER_INFO);
			lOwnerInfoList1 = FieldMapper.convert(lOwnerInfoList1, FieldMaps.OWNER_INFO);
			
		    // 처리상태
		    String procSt = String.valueOf(mService.get("PROC_ST"));
		    
		    // 데이터 병합
		    Map<String, Object> input = commonUtil.mergeMaps(mService, mNewCar, mCarNoDetach);
		    

		    // 주민번호 정리 (하이픈, 공백, 줄바꿈, 쉼표 제거)
		    normalizeNumberFields(input, "REG_NO", "BIZ_NO");

		    lOwnerInfoList.forEach(owner ->
		        normalizeNumberFields(owner, "REG_NO", "BIZ_NO")
		    );

		    lOwnerInfoList1.forEach(owner ->
		        normalizeNumberFields(owner, "REG_NO", "BIZ_NO")
		    );
		    
		    logger.info("mNewCar >>> " + mNewCar);
		    logger.info("input >>> " + input);
		    
		    // 로그인 사용자
		    input.put("UPD_USER", user.getLOGIN_ID());
		    
		    // 서비스번호
		    String serviceId = (String) input.get("SERVICE_ID");
		    
		    // insert
		    if (commonUtil.isEmpty(serviceId)) {
		    	insertNewCar(input, mService, lOwnerInfoList, lOwnerInfoList1, lPaymentList);
		    } 
		    
		    // update
		    else {
		    	updateNewCar(input, mService, lOwnerInfoList, lOwnerInfoList1, lPaymentList);
		    }

		    result.put("SERVICE_ID", input.get("SERVICE_ID"));
		    result.put("MESSAGE", "저장완료");
		    result.put("RESULT_CD", "0");
		    
		    // 신청 여부 확인
		    // 신청 상태: REQ(신청), P_REQ(납부요청)
		    boolean isRequest = "REQ".equals(procSt)|| "P_REQ".equals(procSt);
		    logger.info("isRequest : {}",isRequest);
		    
		    if(isRequest) {
		    	
		    	logger.info("PAY_GB : {}", mNewCar.get("PAY_GB"));
		    	// 선납건(폴스타 등)은 가상계좌 생성 후 입금 대기 처리
		    	if("B".equals(mNewCar.get("PAY_GB"))) {
		    		
		    		// 가상계좌 방식일 경우엔 가상계좌 발급 프로시져 호출
	 	    		try {
						logger.debug("프로시져 호출 전");
	 	    			
	 	    			input.put("pInput",  input.get("SERVICE_ID"));
						input.put("pReturn",  "");
	 	    			
						common.call(input, "processVBank");
						
						// OUT 파라미터 확인
						String pReturn = Objects.toString(input.get("pReturn"), "");
						
						logger.debug("프로시져 호출 후 pReturn >> " + pReturn);
						
				        if (pReturn.isBlank() || "FAIL".equalsIgnoreCase(pReturn)) {
				            throw new RuntimeException("가상계좌 발급 실패 : " + pReturn);
				        }

					} catch (Exception ex) {
						logger.error("processVBank 호출 예외", ex);
						// 예외를 던지면 @Transactional 메서드에서 롤백됩니다.
						throw new RuntimeException("가상계좌 발급 프로시저 호출 실패", ex);
					}
		    		
		    		result.put("RESULT_CD", "0");
		    		result.put("MESSAGE", "처리완료");
		    		
		    		return ApiResponse.withKey("data", result);
		    	}
		    	
		    	
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
		            joiner.add("DEBTOR_NM»"   + (owner.get("DEBTOR_NM") == null ? "null" : owner.get("DEBTOR_NM")));
		            joiner.add("DEBTOR_GB»"   + (owner.get("DEBTOR_GB") == null ? "null" : owner.get("DEBTOR_GB")));
		            joiner.add("REG_NO»"      + (owner.get("REG_NO") == null ? "null" : owner.get("REG_NO")));
		            joiner.add("DEBTOR_RATIO»"+ (owner.get("DEBTOR_RATIO") == null ? "null" : owner.get("DEBTOR_RATIO")));
		            joiner.add("DEBTOR_ADDR»" + (owner.get("DEBTOR_ADDR") == null ? "null" : owner.get("DEBTOR_ADDR")) + " " 
		            						  + (owner.get("DEBTOR_ADDR_DT") == null ? "null" : owner.get("DEBTOR_ADDR_DT")));
		            joiner.add("DSIGN_GB»"    + (owner.get("DSIGN_GB") == null ? "null" : owner.get("DSIGN_GB")));
		            joiner.add("DSIGN_HP_NO»" + (owner.get("DSIGN_HP_NO") == null ? "null" : owner.get("DSIGN_HP_NO")));
		            joiner.add("DSIGN_TX»"    + (owner.get("DSIGN_TX") == null ? "null" : owner.get("DSIGN_TX")));
		            joiner.add("CONFIRM_NO»"  + (owner.get("CONFIRM_NO") == null ? "null" : owner.get("CONFIRM_NO")));
		            joiner.add("DSIGN_ST»"    + (owner.get("DSIGN_ST") == null ? "null" : owner.get("DSIGN_ST")));
		            joiner.add("IDEN_ST»"     + (owner.get("IDEN_ST") == null ? "null" : owner.get("IDEN_ST")));

		            // 관청별 마감 분기 처리
		            if ("BUSAN".equals(input.get("GOVT_ID"))) {
		                ownerInfo.append(joiner.toString()).append("þ");
		            } else {
		            	// date 타입 : 값이 없을 땐 null 
						joiner.add("DSIGN_DT»" + (owner.get("DSIGN_DT") == null ? "null" : owner.get("DSIGN_DT")));
						joiner.add("IDEN_DT»" + (owner.get("IDEN_DT") == null ? "null" : owner.get("IDEN_DT")));
		                ownerInfo.append(joiner.toString()).append("þ");
		            }
		        }
		        
		        logger.info("ownerInfo 공동소유자 >>> " + ownerInfo);

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
				}
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
	
	/**
	 * 지정한 컬럼의 숫자가 아닌 문자 제거
	 */
	private void normalizeNumberFields(Map<String, Object> data, String... fields) {
	    if (data == null) {
	        return;
	    }
	
	    for (String field : fields) {
	        data.put(
	            field,
	            Objects.toString(data.get(field), "")
	                .replaceAll("[^0-9]", "")
	        );
	    }
	}
	
	@Transactional
	public void requestProcess(List<Map<String, Object>> request, UserDto user) {
		// 성공 반환
	    Map<String, Object> result = new HashMap<>();
	    
		for (Map<String, Object> row : request) {
			String serviceId = String.valueOf(row.get("SERVICE_ID"));
			Map<String, Object> mNewCarDetail = getNewCarDetail(user, serviceId);
			
			logger.info("mNewCarDetail >>> " + mNewCarDetail);
			
			 // 데이터 파싱
		    Map<String, Object> mService = commonUtil.getMap(mNewCarDetail, "dsService");
		    Map<String, Object> mNewCar = commonUtil.getMap(mNewCarDetail, "dsNewCar");
		    Map<String, Object> mCarNoDetach = commonUtil.getMap(mNewCarDetail, "dsCarNoDetach");
		    
		    List<Map<String, Object>> lPaymentList = commonUtil.getList(mNewCarDetail, "dsPaymentList");
		    List<Map<String, Object>> lOwnerInfoList = commonUtil.getList(mNewCarDetail, "dsOwnerInfo");
		    List<Map<String, Object>> lOwnerInfoList1 = commonUtil.getList(mNewCarDetail, "dsOwnerInfo1");

			// 공동동소유자 컬럼명 변환
			lOwnerInfoList = FieldMapper.convert(lOwnerInfoList, FieldMaps.OWNER_INFO);
			lOwnerInfoList1 = FieldMapper.convert(lOwnerInfoList1, FieldMaps.OWNER_INFO);
			
		    // 데이터 병합
		    Map<String, Object> input = commonUtil.mergeMaps(mService, mNewCar, mCarNoDetach);
		    
		    // 주민번호 정리 (하이픈, 공백, 줄바꿈, 쉼표 제거)
		    normalizeNumberFields(input, "REG_NO", "BIZ_NO");

		    lOwnerInfoList.forEach(owner ->
		        normalizeNumberFields(owner, "REG_NO", "BIZ_NO")
		    );

		    lOwnerInfoList1.forEach(owner ->
		        normalizeNumberFields(owner, "REG_NO", "BIZ_NO")
		    );
		    
		    logger.info("mNewCar >>> " + mNewCar);
		    logger.info("input >>> " + input);
		    
		    // 로그인 사용자
		    input.put("UPD_USER", user.getLOGIN_ID());
		    
			String payGb = Objects.toString(mNewCar.get("PAY_GB"), "");

			if ("B".equals(payGb)) {
				// 금액 계산
			    // 공급가액
			    BigDecimal buyAmt = new BigDecimal(Objects.toString(mNewCar.get("BUY_AMT"), "0").replaceAll("[^0-9]", ""));
			    
				// 1. 취득세 (7%)
				long acqTax = buyAmt.multiply(new BigDecimal("0.07")).divide(new BigDecimal("10"), 0, RoundingMode.DOWN).multiply(new BigDecimal("10")).longValue();

				// 2. 채권 실부담금 (20% * 10%) 
				long bond = buyAmt.multiply(new BigDecimal("0.20")).multiply(new BigDecimal("0.10")).divide(new BigDecimal("10"), 0, RoundingMode.DOWN).multiply(new BigDecimal("10")).longValue();

			    // 3. 채권 대행 수수료 ((매입금액 * 0.003) + 800)
				long bondFee = buyAmt.multiply(new BigDecimal("0.003")).add(new BigDecimal("800")).divide(new BigDecimal("10"), 0, RoundingMode.DOWN).multiply(new BigDecimal("10")).longValue();
				
				// 4. 번호판대 (필름 28,600원 / 전기 31,400원)
				long tnum = 0;
				if ("F".equals(mNewCar.get("NUMPLATE_GB"))) {
					tnum = 28600;
				} else if ("7".equals(mNewCar.get("NUMPLATE_GB"))) {
					tnum = 31400;
				}
				
				// 서비스 사용 조회
				AddServiceDto req = new AddServiceDto();
				req.setWORK_CD("010");
				req.setCOMPANY_ID(mService.get("COMPANY_ID").toString());
				
				Map<String, Object> mWorkCd = common.select(req, "getWorkCp");
			    long fee = commonUtil.toInt(mWorkCd.get("FEE"));
			    long stamp = 2500;
			    long inji = 3000;

			    boolean isCardPay = "Y".equals(
			            Objects.toString(mNewCar.get("CARD_YN"), "")
			    );
			    
			    // 총금액
			    long totalAmt = isCardPay ? bond + fee + stamp + inji + bondFee + tnum : acqTax + bond + fee + stamp + inji + bondFee + tnum;
			    
			    input.put("PREREG_AMT", totalAmt);
			    input.put("TOTAL_AMT", totalAmt);
			    
				for (Map<String, Object> payment : lPaymentList) {
					String payKd = Objects.toString(payment.get("PAY_KD"), "");
					long amount = 0;
					switch (payKd) {
						case "ACQ":
							amount = acqTax;
							break;
						case "BOND":
							amount = bond;
							break;
						case "BFEE":
							amount = bondFee;
							break;
						case "FEE":
							amount = fee;
							break;
						case "INJI":
							amount = inji;
							break;
						case "STAMP":
							amount = stamp;
							break;
						case "TNUM":
							amount = tnum;
							break;
						default:
							continue;
					}
					payment.put("PRE_PAY_AMT", amount);
					payment.put("PAY_AMT", amount);
				}
				
				input.put("PROC_ST", "P_REQ");
				
				updateNewCar(input, mService, lOwnerInfoList, lOwnerInfoList1, lPaymentList);
				
				
				// 가상계좌 방식일 경우엔 가상계좌 발급 프로시져 호출
				// 선납건
				// 가상계좌 방식일 경우엔 가상계좌 발급 프로시져 호출
 	    		try {
					logger.debug("프로시져 호출 전");
 	    			
 	    			input.put("pInput",  input.get("SERVICE_ID"));
					input.put("pReturn",  "");
 	    			
					common.call(input, "processVBank");
					
					// OUT 파라미터 확인
					String pReturn = Objects.toString(input.get("pReturn"), "");
					
					logger.debug("프로시져 호출 후 pReturn >> " + pReturn);
					
			        if (pReturn.isBlank() || "FAIL".equalsIgnoreCase(pReturn)) {
			            throw new RuntimeException("가상계좌 발급 실패 : " + pReturn);
			        }

				} catch (Exception ex) {
					logger.error("processVBank 호출 예외", ex);
					// 예외를 던지면 @Transactional 메서드에서 롤백됩니다.
					throw new RuntimeException("가상계좌 발급 프로시저 호출 실패", ex);
				}
	    		
	    		result.put("RESULT_CD", "0");
	    		result.put("MESSAGE", "처리완료");
	    		
			}
			
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
	            joiner.add("DEBTOR_NM»"   + (owner.get("DEBTOR_NM") == null ? "null" : owner.get("DEBTOR_NM")));
	            joiner.add("DEBTOR_GB»"   + (owner.get("DEBTOR_GB") == null ? "null" : owner.get("DEBTOR_GB")));
	            joiner.add("REG_NO»"      + (owner.get("REG_NO") == null ? "null" : owner.get("REG_NO")));
	            joiner.add("DEBTOR_RATIO»"+ (owner.get("DEBTOR_RATIO") == null ? "null" : owner.get("DEBTOR_RATIO")));
	            joiner.add("DEBTOR_ADDR»" + (owner.get("DEBTOR_ADDR") == null ? "null" : owner.get("DEBTOR_ADDR")) + " " 
	            						  + (owner.get("DEBTOR_ADDR_DT") == null ? "null" : owner.get("DEBTOR_ADDR_DT")));
	            joiner.add("DSIGN_GB»"    + (owner.get("DSIGN_GB") == null ? "null" : owner.get("DSIGN_GB")));
	            joiner.add("DSIGN_HP_NO»" + (owner.get("DSIGN_HP_NO") == null ? "null" : owner.get("DSIGN_HP_NO")));
	            joiner.add("DSIGN_TX»"    + (owner.get("DSIGN_TX") == null ? "null" : owner.get("DSIGN_TX")));
	            joiner.add("CONFIRM_NO»"  + (owner.get("CONFIRM_NO") == null ? "null" : owner.get("CONFIRM_NO")));
	            joiner.add("DSIGN_ST»"    + (owner.get("DSIGN_ST") == null ? "null" : owner.get("DSIGN_ST")));
	            joiner.add("IDEN_ST»"     + (owner.get("IDEN_ST") == null ? "null" : owner.get("IDEN_ST")));

	            // 관청별 마감 분기 처리
	            if ("BUSAN".equals(input.get("GOVT_ID"))) {
	                ownerInfo.append(joiner.toString()).append("þ");
	            } else {
	            	// date 타입 : 값이 없을 땐 null 
					joiner.add("DSIGN_DT»" + (owner.get("DSIGN_DT") == null ? "null" : owner.get("DSIGN_DT")));
					joiner.add("IDEN_DT»" + (owner.get("IDEN_DT") == null ? "null" : owner.get("IDEN_DT")));
	                ownerInfo.append(joiner.toString()).append("þ");
	            }
	        }
	        
	        logger.info("ownerInfo 공동소유자 >>> " + ownerInfo);

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
			}
			
			mService.put("UPD_USER", user.getLOGIN_ID());

		    //common.update(mService, "updateTrServiceProcSt");
	    }
	}
	

	/**
	 * 신규등록 다건 신청(신청대기-> 신청, 납부요청)
	 * - 선납건은 가상계좌 발급 프로시져 호출
	 */
	@Transactional
	public Map<String, Object> processNewCars(Map<String, Object> request, UserDto user) {
		// 성공 반환
		Map<String, Object> result = new HashMap<>();
		
		try {
			// 데이터 파싱
			Map<String, Object> mService = commonUtil.getMap(request, "dsService");
			Map<String, Object> mNewCar = commonUtil.getMap(request, "dsNewCar");
			Map<String, Object> mCarNoDetach = commonUtil.getMap(request, "dsCarNoDetach");
			
			List<Map<String, Object>> lPaymentList = commonUtil.getList(request, "dsPaymentList");
			List<Map<String, Object>> lOwnerInfoList = commonUtil.getList(request, "dsOwnerInfo");
			List<Map<String, Object>> lOwnerInfoList1 = commonUtil.getList(request, "dsOwnerInfo1");
			
			// 공동동소유자 컬럼명 변환
			lOwnerInfoList = FieldMapper.convert(lOwnerInfoList, FieldMaps.OWNER_INFO);
			lOwnerInfoList1 = FieldMapper.convert(lOwnerInfoList1, FieldMaps.OWNER_INFO);
			
			// 처리상태
			String procSt = String.valueOf(mService.get("PROC_ST"));
			
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
				insertNewCar(input, mService, lOwnerInfoList, lOwnerInfoList1, lPaymentList);
			} 
			
			// update
			else {
				updateNewCar(input, mService, lOwnerInfoList, lOwnerInfoList1, lPaymentList);
			}
			
			result.put("SERVICE_ID", input.get("SERVICE_ID"));
			result.put("MESSAGE", "저장완료");
			result.put("RESULT_CD", "0");
			
			// 신청 여부 확인
			// 신청 상태: REQ(신청), P_REQ(납부요청)
			boolean isRequest = "REQ".equals(procSt)|| "P_REQ".equals(procSt);
			logger.info("isRequest : {}",isRequest);
			
			if(isRequest) {
				
				logger.info("PAY_GB : {}", mNewCar.get("PAY_GB"));
				// 선납건(폴스타 등)은 가상계좌 생성 후 입금 대기 처리
				if("B".equals(mNewCar.get("PAY_GB"))) {
					
					// 가상계좌 방식일 경우엔 가상계좌 발급 프로시져 호출
					try {
						logger.debug("프로시져 호출 전");
						
						input.put("pInput",  input.get("SERVICE_ID"));
						input.put("pReturn",  "");
						
						common.call(input, "processVBank");
						
						// OUT 파라미터 확인
						String pReturn = Objects.toString(input.get("pReturn"), "");
						
						logger.debug("프로시져 호출 후 pReturn >> " + pReturn);
						
						if (pReturn.isBlank() || "FAIL".equalsIgnoreCase(pReturn)) {
							throw new RuntimeException("가상계좌 발급 실패 : " + pReturn);
						}
						
					} catch (Exception ex) {
						logger.error("processVBank 호출 예외", ex);
						// 예외를 던지면 @Transactional 메서드에서 롤백됩니다.
						throw new RuntimeException("가상계좌 발급 프로시저 호출 실패", ex);
					}
					
					result.put("RESULT_CD", "0");
					result.put("MESSAGE", "처리완료");
					
					// TODO: 관청 신청 시기 조정 필요 
					return ApiResponse.withKey("data", result);
				}
				
				
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
						// date 타입 : 값이 없을 땐 null 
						joiner.add("DSIGN_DT»" + (owner.get("DSIGN_DT") == null ? "null" : owner.get("DSIGN_DT")));
						joiner.add("IDEN_DT»" + (owner.get("IDEN_DT") == null ? "null" : owner.get("IDEN_DT")));
						ownerInfo.append(joiner.toString()).append("þ");
					}
				}
				
				logger.info("ownerInfo 공동소유자 >>> " + ownerInfo);
				
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
				}
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
			List<Map<String, Object>> lOwnerInfoList1, List<Map<String, Object>> paymentList) {
	
		// 중복된 차대번호 조회
	    if (isDuplicateCar(input)) {
	        throw new RuntimeException("중복된 차대번호입니다.");
	    }
	
	    String serviceId = "N" + commonUtil.toServiceId(mService);
	    input.put("SERVICE_ID", serviceId);
	    
	    common.insert(input, "insertTrService");
	    common.insert(input, "insertTrNewCar");
	    common.insert(input, "insertTrCarNoDetach");
	    
	    logger.info("insertNewCar >>> " + lOwnerInfoList);
	    logger.info("insertNewCar1 >>> " + lOwnerInfoList1);
	    // 공동소유(1)
	    common.insertList(lOwnerInfoList, "insertTrOwnerInfo", serviceId, true);
	    // 공동소유(2)
	    common.insertList(lOwnerInfoList1, "insertTrOwnerInfo", serviceId, true);
	    // 결제정보
	    common.insertList(paymentList, "insertTrPayment", serviceId, true);
	
	    return Map.of("SERVICE_ID", serviceId,"MESSAGE", "");
	}
	
	// 신규등록 update
	@Transactional
	private Map<String, String> updateNewCar(Map<String, Object> input,
	        Map<String, Object> mService, List<Map<String, Object>> lOwnerInfoList,
	        List<Map<String, Object>> lOwnerInfoList1, List<Map<String, Object>> paymentList) {
		
		String serviceId = input.get("SERVICE_ID").toString();
		
	    if (!Objects.equals("RET", input.get("JUDGE_ST")) && isDuplicateCar(input)) {
	        throw new RuntimeException("중복된 차대번호입니다.");
	    }

		logger.info("ADDR_INFO={}", input.get("ADDR_INFO"));
		logger.info("ADDR_INFO2={}", input.get("ADDR_INFO2"));

	    common.update(input, "updateTrService");
	    common.update(input, "updateTrNewCar");
	    common.update(input, "updateTrCarNoDetach");
	    
	    logger.info("insertNewCar >>> " + lOwnerInfoList);
	    logger.info("insertNewCar1 >>> " + lOwnerInfoList1);
	    

		// 기존 데이터 전체 삭제
		common.delete(input, "deleteTrOwnerInfo");
		 // 공동소유1
		common.insertList(lOwnerInfoList, "insertTrOwnerInfo", serviceId, false);
		 // 공동소유2
		common.insertList(lOwnerInfoList1, "insertTrOwnerInfo", serviceId, false);
		// 결제정보
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
	
	// 채권 및 영수증 조회
	public Map<String, Object> selectBondInfo(String serviceId) {

	    Map<String, Object> param = new HashMap<>();
	    param.put("SERVICE_ID", serviceId);
	    
	    return ApiResponse.withKey("data", common.select(param, "selectBondInfo"));
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
	
	private String getCellValue(Cell cell) {

	    if (cell == null) return "";

	    cell.setCellType(CellType.STRING);

	    return cell.getStringCellValue().trim();
	}
	
	/**
     * YYMMDD 날짜 검증
     */
    private static boolean isValidDateYYMMDD(String yymmdd) {

        if (yymmdd == null || yymmdd.length() != 6) {
            return false;
        }

        try {

            int month =
                    Integer.parseInt(yymmdd.substring(2, 4));

            int day =
                    Integer.parseInt(yymmdd.substring(4, 6));

            if (month < 1 || month > 12) {
                return false;
            }

            if (day < 1 || day > 31) {
                return false;
            }

            return true;

        } catch (Exception e) {

            return false;
        }
    }

}
