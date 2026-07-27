package com.dacos.newcar;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.StringJoiner;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.dacos.addservice.dto.AddServiceDto;
import com.dacos.attach.AttachService;
import com.dacos.auth.AuthService;
import com.dacos.auth.dto.UserDto;
import com.dacos.auth.mapper.AuthMapper;
import com.dacos.code.mapper.CodeMapper;
import com.dacos.common.ApiResponse;
import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;
import com.dacos.common.CommonService;
import com.dacos.common.util.CommonUtil;
import com.dacos.common.util.FieldMapper;
import com.dacos.common.util.FieldMaps;
import com.dacos.mortgage.mapper.MortgageMapper;
import com.dacos.newcar.dto.NewcarSearchRequest;
import com.dacos.newcar.mapper.NewcarMapper;
import com.dacos.payment.mapper.PaymentMapper;
import com.dacos.scheduler.dto.SchedulerDto;
import com.dacos.scheduler.mapper.SchedulerMapper;
import com.fasterxml.jackson.databind.JsonNode;

import lombok.RequiredArgsConstructor;


/**
 * 신차 등록 서비스
 * - getNewCarList: Map으로 반환하여 컬럼명 그대로 프론트에 전달 (직렬화 문제 방지)
 */
@RequiredArgsConstructor
@Service
public class NewcarService {

    private static final Logger logger = LoggerFactory.getLogger(NewcarService.class);
    private static final int WA_SEARCH_START_LIMIT_YEARS = 2;
    private static final DateTimeFormatter SEARCH_DATE_FORMATTER = DateTimeFormatter.BASIC_ISO_DATE;
    private static final ZoneId SEARCH_ZONE = ZoneId.of("Asia/Seoul");
    
    // 회사별 차량제원 조회 조건을 한곳에서 관리함. 신규 고객 추가 시 회사코드, Maker, 차종구분을 함께 등록함.
    private static final Map<String, CarSpecSearchConfig> CAR_SPEC_SEARCH_CONFIG_BY_COMPANY = Map.of(
            "WA001", new CarSpecSearchConfig("POLESTAR", "1", "e")
    );
    
    // 번호판대 계산 시 사용하는 번호판 구분 코드
	public static final String NORMAL = "7";
	public static final String FILM   = "F";
	public static final String ETC    = "X";

    private final NewcarMapper newcarMapper;
    private final MortgageMapper mortgageMapper;
    private final PaymentMapper paymentMapper;
    private final CommonService commonService;
    private final AuthService authService;
    private final CommonUtil commonUtil; // 자주 쓰는 메소드
    private final CommonRepository common; // DB 접근 역할
    private final CodeMapper codeMapper;
    private final AuthMapper authMapper;
    private final SchedulerMapper schedulerMapper;
    private final AttachService attachService;
    

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

    public List<Map<String, Object>> getWaNewCarList(NewcarSearchRequest request, UserDto user) {
        clampWaSearchStartDate(request);
        logger.info("[NewcarService] WA 신규신청현황 조회 - 기간: {} ~ {}", request.getSTART_DT(), request.getEND_DT());
        request.setCOMPANY_ID(user.getCOMPANY_ID());
        request.setBRANCH_ID(user.getBRANCH_ID());
        request.setMEMBER_GB(user.getMEMBER_GB());
        request.setMEMBER_ID(user.getLOGIN_ID());
        return newcarMapper.getWaNewCarList(request);
    }

    /**
     * 로그인 회사에 설정된 Maker와 차량명으로 TR_CAR_SPEC 차량제원을 조회함.
     * Maker와 차량명이 같은 첫 번째 차량제원을 사용함.
     */
    public Map<String, Object> getCarSpec(
            String companyId,
            String carName) {
        String normalizedCompanyId = Objects.toString(companyId, "").trim().toUpperCase();
        String normalizedCarName = Objects.toString(carName, "").trim();

        // 클라이언트 입력이 아닌 로그인 회사코드로 Maker를 결정함.
        CarSpecSearchConfig searchConfig = CAR_SPEC_SEARCH_CONFIG_BY_COMPANY.get(normalizedCompanyId);
        if (searchConfig == null) {
            throw new BusinessException("차량제원 Maker 설정이 없는 회사입니다: " + normalizedCompanyId, 400);
        }

        if (normalizedCarName.isEmpty()) {
            throw new BusinessException("차량명을 입력해주세요.", 400);
        }

        if (normalizedCarName.length() > 100) {
            throw new BusinessException("차량명은 100자 이하로 입력해주세요.", 400);
        }

        Map<String, Object> carSpec = newcarMapper.getCarSpec(
                searchConfig.maker(),
                normalizedCarName);

        if (carSpec == null || carSpec.isEmpty()) {
            throw new BusinessException("TR_CAR_SPEC에서 차량제원을 찾을 수 없습니다: " + normalizedCarName, 404);
        }

        // 회사별 차종구분과 연료구분을 세금 및 공채 감면 계산에 사용함.
        // WA001은 폴스타 전기차만 처리하므로 DB 연료값과 무관하게 e로 통일함.
        carSpec.put("VHCTY_ASORT_CODE", searchConfig.vehicleTypeCode());
        carSpec.put("FUEL_CD", searchConfig.fuelCode());
        return carSpec;
    }

    /**
     * 사용본거지 주소와 차량구분/비교값에 맞는 현재 공채 매입률 가져옴.
     * 다목적형 지역 분기로 결정된 CAR_GB와 비교값은 클라이언트 계산 후 제한된 값만 전달받음.
     */
    public Map<String, Object> getNewcarBondRate(String baseAddress, String carGb, double baseValue) {
        String normalizedBaseAddress = Objects.toString(baseAddress, "").trim();
        String normalizedCarGb = Objects.toString(carGb, "e").trim().toLowerCase();

        if (normalizedBaseAddress.isEmpty()) {
            throw new BusinessException("사용본거지 주소를 입력해주세요.", 400);
        }

        if (normalizedBaseAddress.length() > 500) {
            throw new BusinessException("사용본거지 주소는 500자 이하로 입력해주세요.", 400);
        }

        // 폴스타 승용/다목적 공채 분기에서 사용하는 차량구분만 허용함.
        if (!Set.of("e", "1", "2").contains(normalizedCarGb)) {
            throw new BusinessException("지원하지 않는 공채 차량구분입니다: " + normalizedCarGb, 400);
        }

        double normalizedBaseValue = Math.max(baseValue, 0);
        Map<String, Object> bondRate = newcarMapper.getBondRate(
                normalizedBaseAddress,
                normalizedCarGb,
                normalizedBaseValue);

        if (bondRate == null || bondRate.isEmpty()) {
            throw new BusinessException(
                    "TM_BOND에서 사용 가능한 공채 매입률을 찾을 수 없습니다: "
                            + normalizedBaseAddress + " / " + normalizedCarGb + " / " + normalizedBaseValue,
                    404);
        }

        // 실제 조회에 사용한 다목적 분기 기준을 화면 계산 결과에서 확인할 수 있게 반환함.
        bondRate.put("SEARCH_CAR_GB", normalizedCarGb);
        bondRate.put("SEARCH_BASE_VALUE", normalizedBaseValue);
        return bondRate;
    }
    /**
     * 신규등록 WORK_CD=010에 적용되는 현재 TM_TAX 세율정보 가져옴.
     * 사용여부, 적용기간, 최신 시작일 조건은 getTmTax 매퍼에서 처리함.
     */
    public Map<String, Object> getNewcarTaxInfo() {
        Map<String, Object> taxInfo = common.select("010", "getTmTax");

        if (taxInfo == null || taxInfo.isEmpty()) {
            throw new BusinessException("TM_TAX에서 사용 가능한 신규등록 세율정보를 찾을 수 없습니다: 010", 404);
        }

        return taxInfo;
    }
    private record CarSpecSearchConfig(String maker, String vehicleTypeCode, String fuelCode) {
    }
    private void clampWaSearchStartDate(NewcarSearchRequest request) {
        if (request == null) {
            return;
        }

        String startDt = normalizeSearchDate(request.getSTART_DT());

        if (startDt.length() != 8) {
            return;
        }

        try {
            LocalDate requestedStartDate = LocalDate.parse(startDt, SEARCH_DATE_FORMATTER);
            LocalDate minStartDate = LocalDate.now(SEARCH_ZONE).minusYears(WA_SEARCH_START_LIMIT_YEARS);

            request.setSTART_DT(requestedStartDate.isBefore(minStartDate)
                    ? minStartDate.format(SEARCH_DATE_FORMATTER)
                    : startDt);
        } catch (DateTimeParseException e) {
            logger.warn("[NewcarService] WA 신규신청현황 START_DT 형식 오류: {}", request.getSTART_DT());
        }
    }

    private String normalizeSearchDate(String value) {
        return value == null ? "" : value.replaceAll("[^0-9]", "");
    }

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

        Map<String, Object> taxReceipt =
            common.select(Map.of("SERVICE_ID", serviceId), "getTrTaxReceipt");

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
        result.put("dsTaxReceipt", taxReceipt != null ? taxReceipt : new HashMap<>());

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
	private List<String> validateExcelRow(Map<String, Object> row, Set<String> excelCarIds, Set<String> excelLinkId, Map<String, String> dlvMap, Map<String, Map<String, String>> suMap) {
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
				if (isDuplicateCar2(row)) {
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
			if (!suMap.containsKey(spaceNm)) {
		        errors.add("존재하지 않는 Specialist : " + spaceNm);
		    } else {
		        // 해당 SU login_id, branch_id 넣어주기
		    	Map<String, String> memberInfo = suMap.get(spaceNm);

		    	row.put("SU_LOGIN_ID", memberInfo.get("LOGIN_ID"));
		    	row.put("SU_BRANCH_ID", memberInfo.get("BRANCH_ID"));
		    }
		}


		String directYn = Objects.toString(row.get("DIRECT_YN"), "").trim();
		logger.info("직접등록여부 directYn 값 확인 중 : {}", directYn);
		if (isEmpty(directYn)) {
			errors.add("등록방법(대행등록/직접등록) 없음");
		} else {
			// 직접입력여부 체크
			if (!"직접등록".equals(directYn) && !"대행등록".equals(directYn)) {
				errors.add("등록방법(대행등록/직접등록) 아님");
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
				row.put("CAR_NM", getExcelCellValue(sheet.getRow(0), excelRow, formatter, -1,"모델") + " " + getExcelCellValue(sheet.getRow(0), excelRow, formatter, -1,"Engine")); //차명
				row.put("CARID_NO", getCellValue(excelRow.getCell(11), formatter));						//차대번호
				row.put("BUY_AMT", getCellValue(excelRow.getCell(28), formatter).replace(",", ""));		//공급가액
				row.put("REGIST_DATE", getCellValue(excelRow.getCell(41), formatter).replace("-", "").replace(".", ""));	//등록일자
				row.put("DIRECT_YN", getCellValue(excelRow.getCell(40), formatter));						//직접입력여부
				result.add(row);
			}
		} catch (Exception e) {
			throw new RuntimeException("엑셀 읽기 실패", e);
		}
		return result;
    }
	private String getExcelCellValue(Row headerRow, Row dataRow, DataFormatter formatter, int fallbackIndex, String... aliases) {
		int columnIndex = findHeaderIndex(headerRow, formatter, aliases);
		if (columnIndex < 0) {
			columnIndex = fallbackIndex;
		}
		return columnIndex >= 0 ? getCellValue(dataRow.getCell(columnIndex), formatter) : "";
	}

	private int findHeaderIndex(Row headerRow, DataFormatter formatter, String... aliases) {
		if (headerRow == null) {
			return -1;
		}

		Set<String> normalizedAliases = new HashSet<>();
		for (String alias : aliases) {
			normalizedAliases.add(normalizeExcelHeader(alias));
		}

		for (Cell cell : headerRow) {
			String header = normalizeExcelHeader(getCellValue(cell, formatter));
			if (normalizedAliases.contains(header)) {
				return cell.getColumnIndex();
			}
		}
		return -1;
	}

	private String normalizeExcelHeader(String value) {
		return Objects.toString(value, "")
				.replaceAll("[\\s_\\-./()\\[\\]]", "")
				.toUpperCase();
	}


	private String getCellValue(Cell cell, DataFormatter formatter) {
		if (cell == null) {
			return "";
		}
		return formatter.formatCellValue(cell).trim();
	}

	private void applyExcelCarSpec(Map<String, Object> row, UserDto user) {
		String carName = Objects.toString(row.get("CAR_NM"), "").trim();
		if (carName.isEmpty()) {
			throw new BusinessException("\uCC28\uBA85 \uC5C6\uC74C");
		}

		Map<String, Object> carSpec = getCarSpec(user.getCOMPANY_ID(), carName);
		row.put("CAR_NM", carName);
		row.put("VH_TY_CD", isYn(carSpec.get("MULTI_PURPOSE_YN")) ? "3" : "");
	}

	private boolean isYn(Object value) {
		return "Y".equalsIgnoreCase(Objects.toString(value, "").trim());
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
		List<Map<String, Object>> dlaCodes = codeMapper.findCodesByGroupId("DLADD");

		Map<String, String> dlvMap = new HashMap<>();
		Map<String, Map<String, String>> suMap = new HashMap<>();
		Map<String, String> dlaMap = new HashMap<>();

		for (Map<String, Object> code : dlvCodes) {
			dlvMap.put(Objects.toString(code.get("CODE_NM"), "").trim(), Objects.toString(code.get("CODE_ID"), ""));
		}
		for (Map<String, Object> code : suInfo) {
			Map<String, String> memberInfo = new HashMap<>();
		    memberInfo.put("LOGIN_ID", Objects.toString(code.get("LOGIN_ID"), ""));
		    memberInfo.put("BRANCH_ID", Objects.toString(code.get("BRANCH_ID"), ""));

		    suMap.put(
		        Objects.toString(code.get("MEMBER_NM"), "").trim(),
		        memberInfo
		    );
		}
		for (Map<String, Object> code : dlaCodes) {
			dlaMap.put(Objects.toString(code.get("CODE_ID"), "").trim(), Objects.toString(code.get("CODE_NM"), ""));
		}
		// =========================
		// 1. 검증 단계
		// =========================
		for (int i = 0; i < rows.size(); i++) {
			Map<String, Object> row = rows.get(i);
			List<String> errors = validateExcelRow(row, excelCarIds, excelLinkId, dlvMap, suMap);
			if (errors.isEmpty()) {
				try {
					applyExcelCarSpec(row, user);
				} catch (BusinessException e) {
					errors.add(e.getMessage());
				}
			}
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
			insertExcelRow(row, user, dlaMap);
			insertCount++;
		}

		return Map.of("success", true, "insertCount", insertCount, "errors", List.of());
	}

	/**
	 * 제작증 PDF 업로드
	 * - 엑셀 업로드와 동일하게 전체 검증 후 정상 건만 신규등록 저장한다.
	 */
	@Transactional
	public Map<String, Object> uploadPdf(List<Map<String, Object>> extractedRows, UserDto user, String registrationType) {
		PdfRegistrationType pdfRegistrationType = resolvePdfRegistrationType(registrationType);
		List<Map<String, Object>> rows = parsePdfRows(extractedRows);
		List<Map<String, Object>> errorList = new ArrayList<>();
		Set<String> pdfCarIds = new HashSet<>();

		for (int i = 0; i < rows.size(); i++) {
			Map<String, Object> row = rows.get(i);
			List<String> errors = validatePdfRow(row, pdfCarIds);
			if (!errors.isEmpty()) {
				Map<String, Object> error = new HashMap<>();
				error.put("row", i + 1);
				error.put("fileName", row.get("ORIGINAL_FILE_NAME"));
				error.put("carIdNo", row.get("CARID_NO"));
				error.put("errors", errors);
				errorList.add(error);
			}
		}

		if (!errorList.isEmpty()) {
			Map<String, Object> result = new HashMap<>();
			result.put("success", false);
			result.put("insertCount", 0);
			result.put("errors", errorList);
			result.put("rows", rows);
			return result;
		}

		int insertCount = 0;
		List<Map<String, Object>> inserted = new ArrayList<>();

		for (Map<String, Object> row : rows) {
			Map<String, Object> processResult = insertPdfRow(row, user, pdfRegistrationType);
			row.put("SERVICE_ID", processResult.get("SERVICE_ID"));
			row.put("REGISTRATION_TYPE", pdfRegistrationType.requestValue());
			row.put("REGISTRATION_TYPE_NM", pdfRegistrationType.label());
			row.put("TASK_CD", pdfRegistrationType.taskCd());
			row.put("REG_GB", pdfRegistrationType.regGb());
			inserted.add(row);
			insertCount++;
		}

		Map<String, Object> result = new HashMap<>();
		result.put("success", true);
		result.put("insertCount", insertCount);
		result.put("errors", List.of());
		result.put("rows", inserted);
		return result;
	}

	private PdfRegistrationType resolvePdfRegistrationType(String registrationType) {
		String value = Objects.toString(registrationType, "").trim().toUpperCase();

		return switch (value) {
			case "PERSONAL" -> new PdfRegistrationType("PERSONAL", "개인", "NORML", "R");
			case "CORPORATE" -> new PdfRegistrationType("CORPORATE", "법인", "NORML", "B");
			case "LEASE" -> new PdfRegistrationType("LEASE", "리스", "LEASE", "B");
			default -> throw new BusinessException("제작증 업로드 구분 값이 올바르지 않습니다.", 400);
		};
	}

	private List<Map<String, Object>> parsePdfRows(List<Map<String, Object>> extractedRows) {
		List<Map<String, Object>> rows = new ArrayList<>();

		if (extractedRows == null || extractedRows.isEmpty()) {
			throw new BusinessException("업로드할 PDF 파일이 없습니다.", 400);
		}
		for (Map<String, Object> extracted : extractedRows) {
			Map<String, Object> row = new HashMap<>();
			boolean extractSuccess = Boolean.TRUE.equals(extracted.get("success"));
			String manufactureDate = onlyNumber(extracted.get("manufactureDate"));
			String firstTransferDate = onlyNumber(extracted.get("firstTransferDate"));

			row.put("EXTRACT_SUCCESS", extractSuccess);
			row.put("EXTRACT_MESSAGE", Objects.toString(extracted.get("message"), ""));
			row.put("ORIGINAL_FILE_NAME", Objects.toString(extracted.get("originalFileName"), ""));
			row.put("FILENAME1", Objects.toString(extracted.get("storedPath"), ""));
			row.put("CARID_NO", Objects.toString(extracted.get("carIdNo"), "").trim());
			row.put("CAR_NM", Objects.toString(extracted.get("carName"), "").trim());
			row.put("BUY_AMT", onlyNumber(extracted.get("supplyAmount")));
			row.put("OWNER_NM", Objects.toString(extracted.get("ownerName"), "").trim());
			row.put("REG_NO", onlyNumber(extracted.get("ownerRegNo")));
			row.put("ADDRESS", Objects.toString(extracted.get("ownerAddress"), "").trim());
			row.put("BASE_ADDRESS", Objects.toString(extracted.get("ownerAddress"), "").trim());
			row.put("MADE_DT", manufactureDate);
			row.put("MADE_YY", manufactureDate.length() >= 4 ? manufactureDate.substring(0, 4) : "");
			row.put("LAST_DT", firstTransferDate);
			row.put("REGIST_DATE", firstTransferDate);
			rows.add(row);
		}

		return rows;
	}

	private List<String> validatePdfRow(Map<String, Object> row, Set<String> pdfCarIds) {
		List<String> errors = new ArrayList<>();

		if (!Boolean.TRUE.equals(row.get("EXTRACT_SUCCESS"))) {
			errors.add("PDF 추출 실패: " + Objects.toString(row.get("EXTRACT_MESSAGE"), ""));
			return errors;
		}

		String carIdNo = Objects.toString(row.get("CARID_NO"), "").trim();
		if (isEmpty(carIdNo)) {
			errors.add("차대번호 없음");
		} else {
			if (carIdNo.length() != 17) {
				errors.add("차대번호 확인 필요");
			}
			if (!pdfCarIds.add(carIdNo)) {
				errors.add("PDF 내 중복된 차대번호");
			}
			if (isDuplicateCar2(row)) {
				errors.add("이미 등록된 차대번호");
			}
		}

		if (isEmpty(row.get("BUY_AMT"))) {
			errors.add("공급가액 없음");
		}
		if (isEmpty(row.get("OWNER_NM"))) {
			errors.add("소유자명 없음");
		}
		if (isEmpty(row.get("REG_NO"))) {
			errors.add("주민/법인등록번호 없음");
		}
		if (isEmpty(row.get("ADDRESS"))) {
			errors.add("소유자 주소 없음");
		}
		if (isEmpty(row.get("FILENAME1"))) {
			errors.add("제작증 파일 저장 실패");
		}

		return errors;
	}

	private Map<String, Object> insertPdfRow(Map<String, Object> row, UserDto user, PdfRegistrationType registrationType) {
		Map<String, Object> request = new HashMap<>();
		Map<String, Object> result = initNewCar(user);
		Map<String, Object> dsService = commonUtil.getMap(result, "dsService");
		Map<String, Object> dsNewCar = new HashMap<>();
		Map<String, Object> dsCarNoDetach = new HashMap<>();
		Map<String, Object> dsOwnerInfo = new HashMap<>();
		Map<String, Object> dsOwnerInfo1 = new HashMap<>();

		dsService.put("WORK_CD", "010");
		dsService.put("PROC_ST", "C_REQ");
		dsService.put("MEMBER_ID", user.getLOGIN_ID());

		dsNewCar.put("PROC_CD", "I");
		dsNewCar.put("TASK_CD", registrationType.taskCd());
		dsNewCar.put("CARID_NO", row.get("CARID_NO"));
		dsNewCar.put("REG_GB", registrationType.regGb());
		dsNewCar.put("REG_NO", row.get("REG_NO"));
		dsNewCar.put("OWNER_NM", row.get("OWNER_NM"));
		dsNewCar.put("ADDRESS", row.get("ADDRESS"));
		dsNewCar.put("BASE_ADDRESS", row.get("BASE_ADDRESS"));
		dsNewCar.put("RATIO_NO", "100");
		dsNewCar.put("MADE_DT", row.get("MADE_DT"));
		dsNewCar.put("MADE_YY", row.get("MADE_YY"));
		dsNewCar.put("LAST_DT", row.get("LAST_DT"));
		dsNewCar.put("CAR_NM", row.get("CAR_NM"));
		dsNewCar.put("BUY_AMT", row.get("BUY_AMT"));
		dsNewCar.put("REGIST_DATE", row.get("REGIST_DATE"));
		dsNewCar.put("NUMPLATE_GB", "7");
		dsNewCar.put("IMSINUM_YN", "N");
		dsNewCar.put("PAY_GB", "B");
		dsNewCar.put("PAY_ME", "B");
		dsNewCar.put("PAY_ST", "N");
		dsNewCar.put("CARD_YN", "N");
		dsNewCar.put("BOND_YN", "N");
		dsNewCar.put("FUEL_CD", "");
		dsNewCar.put("CAR_US", "2");
		dsNewCar.put("STAMP_GB", "TOTAL");
		dsNewCar.put("NTAX_TRGET_GR_CD", "0");
		dsNewCar.put("NTAX_APPLC_CD", "0");
		dsNewCar.put("NTAX_WHO", "REPRE");

		dsCarNoDetach.put("FILENAME1", row.get("FILENAME1"));
		dsCarNoDetach.put("CUSTOMER_NM", row.get("OWNER_NM"));
		dsCarNoDetach.put("HOLE_YN", "02");
		dsCarNoDetach.put("SEAL_YN", "02");

		dsOwnerInfo.put("SEQ", "0");
		dsOwnerInfo1.put("SEQ", "1");

		request.put("dsService", dsService);
		request.put("dsNewCar", dsNewCar);
		request.put("dsCarNoDetach", dsCarNoDetach);
		request.put("dsOwnerInfo", dsOwnerInfo);
		request.put("dsOwnerInfo1", dsOwnerInfo1);
		request.put("dsPaymentList", getPaymentList(user));

		return processNewCar(request, user);
	}

	private record PdfRegistrationType(String requestValue, String label, String taskCd, String regGb) {
	}

	private String onlyNumber(Object value) {
		return Objects.toString(value, "").replaceAll("[^0-9]", "");
	}
	private void insertExcelRow(Map<String, Object> row, UserDto user, Map<String, String> dlaMap) {

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
	    dsService.put("LINK_ID", row.get("LINK_ID")); 							   // 주문번호
	    dsService.put("MEMBER_ID", row.get("SU_LOGIN_ID"));						   // SU 담당자 login_id
	    dsService.put("BRANCH_ID", row.get("SU_BRANCH_ID"));						   // SU 담당자 branch_id
	    dsService.put("LOGIN_ID", user.getLOGIN_ID());							   // CA 업로드한 사용자 login_id

	    // =========================
	    // NEWCAR
	    // =========================
	    dsNewCar.put("CARID_NO", row.get("CARID_NO"));
	    //dsNewCar.put("OWNER_NM", row.get("OWNER_NM"));									  // 대표소유자명 공란
	    dsNewCar.put("CAR_NM", row.get("CAR_NM"));
	    dsNewCar.put("VH_TY_CD", row.get("VH_TY_CD"));
	    dsNewCar.put("BUY_AMT", row.get("BUY_AMT"));
	    dsNewCar.put("REGIST_DATE", row.get("REGIST_DATE")); 						   // 등록일자
	    dsNewCar.put("STAMP_GB", "TOTAL"); 			  	 	 					   // 인지세
		String directYnText = Objects.toString(row.get("DIRECT_YN"), "");				
		String directyn = "N";
		if ("직접등록".equals(directYnText) || "Y".equalsIgnoreCase(directYnText)) {
			directyn = "Y";
			dsService.put("PROC_ST", "INPUT");  // 직접등록이면 상태값 INPUT으로 변경
		}
	    dsNewCar.put("DIRECT_YN", directyn);	// 직접등록여부		
	    // =========================
	    // 스페이스(배송지)
	    // =========================
	    dsCarNoDetach.put("DELIVERY_GB", row.get("SPACE_GB"));
	    dsCarNoDetach.put("CUSTOMER_NM", row.get("OWNER_NM")); 						// 계약자명

	    // 배송지주소 코드값 가져와서 넣어주기
		String codeNm = dlaMap.get(row.get("SPACE_GB"));

		String address = "";
		String detailAddress = "";
		String manager = "";
		String phone = "";

		// "/" 기준 전체 분리 (빈 값 유지 중요)
		String[] parts = codeNm.split("/", -1);

		// 공통 trim 처리
		for (int i = 0; i < parts.length; i++) {
		    parts[i] = parts[i].trim();
		}

		// 0: 주소
		if (parts.length > 0) {
		    address = parts[0];
		}

		// 1: 상세주소
		if (parts.length > 1) {
		    detailAddress = parts[1];
		}

		// 2: 담당자
		if (parts.length > 2) {
		    manager = parts[2];
		}

		// 3: 전화번호
		if (parts.length > 3) {
		    phone = parts[3];
		}

		dsCarNoDetach.put("DELIVERY_ADDR", address);
		dsCarNoDetach.put("DELIVERY_ADDR_DT", detailAddress);
		dsCarNoDetach.put("RECEIVE_NM", manager);
		dsCarNoDetach.put("RECEIVE_TEL_NO", phone);
		dsCarNoDetach.put("HOLE_YN", "02");  // 비천공
	    dsCarNoDetach.put("SEAL_YN", "02");  // 비봉인

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
	            
	            SchedulerDto specialistInfo = schedulerMapper.selectNewcarSpecialistInfo(row.get("SU_ID").toString());
                String specialistPhone = specialistInfo == null ? "" : specialistInfo.getSPECIALIST_HP_NO();
                if (specialistPhone != null && !specialistPhone.contains("-")) {
                    if (specialistPhone.length() == 11) {
                        specialistPhone = specialistPhone.replaceAll("(\\d{3})(\\d{4})(\\d{4})", "$1-$2-$3");
                    } else if (specialistPhone.length() == 10) {
                        specialistPhone = specialistPhone.replaceAll("(\\d{3})(\\d{3})(\\d{4})", "$1-$2-$3");
                    }
                }
                String smsText = "안녕하세요. 폴스타 고객 지원 시스템입니다.\n\n"
                		+ "■ 신차 등록 접수 및 세제 혜택 유지 안내\n"
                        + "고객님의 소중한 차량(" + safeValue(row.get("CAR_NO").toString()) + ") 등록 서류가 관청에 정상 접수되었습니다. 고객님께서 적용받으신 '취득세 감면 혜택'과 관련하여 필수 유의사항을 안내해 드립니다.\n\n"
                        + "[취득세 감면 유지 유의사항]\n"
                        + "감면 혜택을 받은 차량은 정해진 법적 요건(의무 보유 기간 등)을 유지해 주셔야 합니다. 요건 변동(조기 매각 등) 사유가 발생할 경우, 감면받은 지방세가 환수될 수 있으며 발생일로부터 60일 이내 미신고 시 가산세가 부과될 수 있으니 유의해 주시기 바랍니다.\n\n"
                        + "저공해 차량 등록 정보는 신규 등록 절차가 모두 완료된 후 전산에서 확인 가능합니다.\n\n"
                        + "※ 본 메시지는 시스템 발신 전용으로 회신이 어렵습니다. 관련 문의 사항은 담당 스페셜리스트에게 문의해 주시면 자세히 안내해 드리겠습니다."
                        + (isBlank(specialistPhone) ? "" : "\n담당 스페셜리스트 : " + specialistPhone); 
                
                // 심사요청 문자 발송
                param.put("PAY_HP_NO", row.get("MPHONE_NO").toString()); // 고객 연락처
                param.put("TEXT", smsText);                   			 // 문자 내용
                param.put("MSG_TYPE", "3");                  			 // 문자메세지 유형 1:SMS, 3:LMS

                commonService.sendSms(param);
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

		        // 로그인 회사의 신규등록 서비스 설정에서 등록수수료 가져옴.
		        if ("FEE".equals(kd)) {
		            amt = mWorkCd == null ? 0 : commonUtil.toInt(mWorkCd.get("FEE"));
		            logger.info("등록수수료 : {}", amt);
		        }

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

	    // // 공통 dsService 가져오기
	    // Map<String, Object> dsService =
	    //     (Map<String, Object>) result.get("dsService");

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
            Map<String, Object> mTaxReceipt = commonUtil.getMap(request, "dsTaxReceipt");
            // 감면 신청서 정보
            Map<String, Object> mExemption = commonUtil.getMap(request, "dsExemption");

		    List<Map<String, Object>> lPaymentList = commonUtil.getList(request, "dsPaymentList");
		    List<Map<String, Object>> lOwnerInfoList = commonUtil.getList(request, "dsOwnerInfo");
		    List<Map<String, Object>> lOwnerInfoList1 = commonUtil.getList(request, "dsOwnerInfo1");
	    	
			// 공동동소유자 컬럼명 변환
			lOwnerInfoList = FieldMapper.convert(lOwnerInfoList, FieldMaps.OWNER_INFO);
			lOwnerInfoList1 = FieldMapper.convert(lOwnerInfoList1, FieldMaps.OWNER_INFO);

		    // 데이터 병합
		    Map<String, Object> input = commonUtil.mergeMaps(mService, mNewCar, mCarNoDetach);

		    // 로그인 사용자
		    input.put("UPD_USER", user.getLOGIN_ID());

		    // 서비스번호
		    String serviceId = (String) input.get("SERVICE_ID");
		    
		    // 처리상태
		    String procSt = String.valueOf(mService.get("PROC_ST"));
		    // 현재 DB 처리상태 (Update 건만 조회)
		    String beforeProcSt = "";

		    if (!commonUtil.isEmpty(serviceId)) {
		        Map<String, Object> resultProc = common.select(input, "selectProcSt"); // 상태 조회
		        beforeProcSt = (String) resultProc.get("PROC_ST");
		    }

			// 공동소유자 데이터 정리 (하이픈, 공백, 줄바꿈, 쉼표 제거)
		    normalizeOwnerInfoList(lOwnerInfoList, lOwnerInfoList1);
            normalizeTaxReceipt(mTaxReceipt);

		    // insert
		    if (commonUtil.isEmpty(serviceId)) {
			insertNewCar(input, mService, lOwnerInfoList, lOwnerInfoList1, lPaymentList, mTaxReceipt);
		    }

		    // update
		    else {
			updateNewCar(input, mService, lOwnerInfoList, lOwnerInfoList1, lPaymentList, mTaxReceipt);
		    }

		    result.put("SERVICE_ID", input.get("SERVICE_ID"));
		    result.put("MESSAGE", "저장완료");
		    result.put("RESULT_CD", "0");

		    logger.info("DB PROC_ST: {}", beforeProcSt);
			logger.info("REQUEST PROC_ST: {}", procSt);
			
			// 감면신청서 생성 및 PDF 병합이 필요한 경우
			if (
			    !"W_REQ".equals(beforeProcSt)
			    && "W_REQ".equals(procSt)
			    && !commonUtil.isEmpty(mExemption)
			) {
		    	
		        attachService.mergePdf(serviceId, mExemption);
		    }
		    
		    // 신청 여부 확인
		    // 신청 상태: S_WAIT(심사대기), P_REQ(납부요청)
		    boolean isRequest = "S_WAIT".equals(procSt)|| "P_REQ".equals(procSt);
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

			}


			// 선납, 후납 바로 관청 서버 연계
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
	            //String sMessage = commonService.getListData(lResultList, 0, "message");

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


	/**
	 * 공동소유자 정보 정규화
	 * - 문자열: 공백 제거 후 빈값이면 null
	 * - 숫자형 문자열: 숫자만 남기고 빈값이면 null
	 */
	private void normalizeOwnerInfo(Map<String, Object> owner) {

	    if (owner == null) {
	        return;
	    }

	    // 일반 문자열 컬럼
	    String[] stringFields = {
	        "DEBTOR_NM",
	        "DEBTOR_GB",
	        "DEBTOR_ADDR",
	        "DEBTOR_RATIO",
	        "DEBTOR_ADDR",
	        "DSIGN_GB",
	        "DSIGN_TX",
	        "CONFIRM_NO",
	        "DSIGN_ST",
	        "IDEN_ST",
	        "DSIGN_DT",
	        "IDEN_DT"
	    };

	    for (String field : stringFields) {
	        String value = Objects.toString(owner.get(field), "").trim();
	        owner.put(field, value.isEmpty() ? null : value);
	    }

	    // 숫자형 문자열 컬럼
	    String[] numberFields = {
	        "REG_NO",
	        "BIZ_NO",
	        "DEBTOR_RATIO",
	        "DSIGN_HP_NO"
	    };

	    for (String field : numberFields) {
	        String value = Objects.toString(owner.get(field), "")
	                .trim()
	                .replaceAll("[^0-9]", "");

	        owner.put(field, value.isEmpty() ? null : value);
	    }
	}
	@SafeVarargs
	private void normalizeOwnerInfoList(List<Map<String, Object>>... lists) {

	    for (List<Map<String, Object>> list : lists) {
	        if (list == null) {
	            continue;
	        }

	        list.forEach(this::normalizeOwnerInfo);
	    }
	}

    private void normalizeTaxReceipt(Map<String, Object> taxReceipt) {
        if (taxReceipt == null) {
            return;
        }

        String[] stringFields = {
            "GUBUN",
            "NAME",
            "COMPANY_NM",
            "ADDR",
            "ADDR_DT",
            "POST_NO",
            "BUSINESS_TYPE",
            "INDUSTRY_TYPE",
            "MAIL1",
            "MAIL2"
        };

        for (String field : stringFields) {
            String value = Objects.toString(taxReceipt.get(field), "").trim();
            taxReceipt.put(field, value.isEmpty() ? null : value);
        }

        normalizeNumberFields(taxReceipt, "REG_NO", "PHONE_NO");
    }

    private boolean hasTaxReceipt(Map<String, Object> taxReceipt) {
        return taxReceipt != null && !isEmpty(taxReceipt.get("GUBUN"));
    }

    private void replaceTaxReceipt(String serviceId, Map<String, Object> taxReceipt) {
        Map<String, Object> param = new HashMap<>();
        param.put("SERVICE_ID", serviceId);
        common.delete(param, "deleteTrTaxReceipt");

        if (!hasTaxReceipt(taxReceipt)) {
            return;
        }

        taxReceipt.put("SERVICE_ID", serviceId);
        common.insert(taxReceipt, "insertTrTaxReceipt");
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
            Map<String, Object> mTaxReceipt = commonUtil.getMap(mNewCarDetail, "dsTaxReceipt");

		    List<Map<String, Object>> lPaymentList = commonUtil.getList(mNewCarDetail, "dsPaymentList");
		    List<Map<String, Object>> lOwnerInfoList = commonUtil.getList(mNewCarDetail, "dsOwnerInfo");
		    List<Map<String, Object>> lOwnerInfoList1 = commonUtil.getList(mNewCarDetail, "dsOwnerInfo1");

			// 공동동소유자 컬럼명 변환
			lOwnerInfoList = FieldMapper.convert(lOwnerInfoList, FieldMaps.OWNER_INFO);
			lOwnerInfoList1 = FieldMapper.convert(lOwnerInfoList1, FieldMaps.OWNER_INFO);

			normalizeOwnerInfoList(lOwnerInfoList, lOwnerInfoList1);
            normalizeTaxReceipt(mTaxReceipt);

		    logger.info("lOwnerInfoList >>> " + lOwnerInfoList);
		    logger.info("lOwnerInfoList1 >>> " + lOwnerInfoList1);


		    // 데이터 병합
		    Map<String, Object> input = commonUtil.mergeMaps(mService, mNewCar, mCarNoDetach);

		    // 로그인 사용자
		    input.put("UPD_USER", user.getLOGIN_ID());

			String payGb = Objects.toString(mNewCar.get("PAY_GB"), "");

			if ("B".equals(payGb)) {
				
				/*
				 * 
				Sp담당자가 정보입력할 때 계산되므로 계산 로직 생략
				// 금액 계산
			    // 공급가액
			    BigDecimal buyAmt = new BigDecimal(Objects.toString(mNewCar.get("BUY_AMT"), "0").replaceAll("[^0-9]", ""));

				// 1. 취득세 (7%)
				long acqTax = buyAmt.multiply(new BigDecimal("0.07")).divide(new BigDecimal("10"), 0, RoundingMode.DOWN).multiply(new BigDecimal("10")).longValue();

				// 2. 채권 실부담금 (20% * 10%)
				long bond = buyAmt.multiply(new BigDecimal("0.20")).multiply(new BigDecimal("0.10")).divide(new BigDecimal("10"), 0, RoundingMode.DOWN).multiply(new BigDecimal("10")).longValue();

			    // 3. 채권 대행 수수료 ((매입금액 * 0.003) + 600)
				long bondFee = buyAmt.multiply(new BigDecimal("0.20")).multiply(new BigDecimal("0.003")).add(new BigDecimal("600")).divide(new BigDecimal("10"), 0, RoundingMode.DOWN).multiply(new BigDecimal("10")).longValue();

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

				updateNewCar(input, mService, lOwnerInfoList, lOwnerInfoList1, lPaymentList, mTaxReceipt);
				*/

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

			} else {
				input.put("PROC_ST", "REQ");
				input.put("JUDGE_ST", "S_REQ");

				updateNewCar(input, mService, lOwnerInfoList, lOwnerInfoList1, lPaymentList, mTaxReceipt);
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
            //String sMessage = commonService.getListData(lResultList, 0, "message");

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
			List<Map<String, Object>> lOwnerInfoList1, List<Map<String, Object>> paymentList, Map<String, Object> mTaxReceipt) {

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
        replaceTaxReceipt(serviceId, mTaxReceipt);

	    return Map.of("SERVICE_ID", serviceId,"MESSAGE", "");
	}

	// 신규등록 update
	@Transactional
	private Map<String, String> updateNewCar(Map<String, Object> input,
	        Map<String, Object> mService, List<Map<String, Object>> lOwnerInfoList,
	        List<Map<String, Object>> lOwnerInfoList1, List<Map<String, Object>> paymentList, Map<String, Object> mTaxReceipt) {

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
        replaceTaxReceipt(serviceId, mTaxReceipt);

	    return Map.of("SERVICE_ID", input.get("SERVICE_ID").toString(),"MESSAGE", "");
	}

	// 중복된 차대번호 조회
	private boolean isDuplicateCar(Map<String, Object> input) {
	    var where = Map.of("CARID_NO", input.get("CARID_NO"));
	    return !common.selectList(where, "selectDuplicateCarIdNO").isEmpty();
	}

	// 중복된 차대번호 조회 (엑셀업로드 시)
	private boolean isDuplicateCar2(Map<String, Object> input) {
	    var where = Map.of("CARID_NO", input.get("CARID_NO"));
	    return !common.selectList(where, "selectDuplicateCarIdNO2").isEmpty();
	}

	/**
	 * 선택 가능한 번호판 조회
	 *
	 * 최초 조회 시 번호판 조회 패키지를 2회 호출하여
	 * 총 20개의 번호판을 조회한 후 반환한다.
	 */
	@Transactional
	public List<String> getNumplateList(Map<String, Object> param, UserDto user) {

	    // 로그인 사용자 정보 설정
	    param.put("LOGIN_ID", user.getLOGIN_ID());

	    // 조회된 번호판 목록
	    List<String> result = new ArrayList<>();

	    // 번호판 조회 패키지를 2회 호출하여 총 20건 조회
	    for (int i = 0; i < 2; i++) {

	        // 번호판 조회 패키지 호출
	        callNumplateProcedure(param);

	        // 조회 결과를 목록에 추가
	        mergeResult(result, (String) param.get("pReturn"));

	        // 다음 조회 시 이미 조회한 번호판은 제외하도록 설정
	        param.put("PRE_CAR_NO", String.join(",", result));
	    }

	    // 총 20개의 번호판 반환
	    return result;
	}

	/**
	 * 업무구분에 따라 번호판 조회 패키지를 호출한다.
	 * - ADD : 증차배정 번호판 조회
	 * - 그 외 : 일반 번호판 조회
	 */
	private void callNumplateProcedure(Map<String, Object> param) {

	    String taskCd = Objects.toString(param.get("TASK_CD"), "");

	    common.call(
	        param,
	        "ADD".equals(taskCd)
	            ? "procedureNewCarAvailNumplateRent"
	            : "procedureNewCarAvailNumplateHole"
	    );
	}

	/**
	 * 패키지에서 조회된 번호판을 결과 목록에 추가한다.
	 */
	private void mergeResult(List<String> result, String pReturn) {

	    // 조회 결과가 없는 경우 종료
	    if (pReturn == null || pReturn.isBlank()) {
	        return;
	    }

	    Arrays.stream(pReturn.split("/"))
	            .filter(s -> !s.isBlank())
	            .forEach(result::add);
	}

	// 번호판 선택
	@Transactional
	public ApiResponse<Object> selectNumplate(Map<String, Object> param, UserDto user) {
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

	// 번호판 상태 변경
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
	
	public void updateChangeSu(Map<String, Object> param, UserDto user) {

		param.put("SERVICE_ID", param.get("SERVICE_ID"));
		param.put("MEMBER_ID", param.get("CHAGE_SU_ID"));
		param.put("UPD_USER", user.getLOGIN_ID());
	
		int result = common.update(param, "updateTrService");
		
		if(result < 1) {
		    throw new BusinessException("담당자 변경 실패");
		}
	}
	
    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String safeValue(String value) {
        return value == null ? "" : value;
    }
   
}



