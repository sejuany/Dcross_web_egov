package com.dacos.newcar;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.StringJoiner;
import java.util.UUID;
import java.util.stream.Collectors;

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
import com.dacos.common.SearchLogInterceptor;
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

import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
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
    private static final Set<String> NTAX_NO_UPLOAD_GRADES = Set.of(
            "7", "8", "9", "10", "11", "12", "13", "14");

    // 회사별 차량제원 조회 조건을 한곳에서 관리함. 신규 고객 추가 시 회사코드, Maker, 차종구분을 함께 등록함.
    private static final Map<String, CarSpecSearchConfig> CAR_SPEC_SEARCH_CONFIG_BY_COMPANY = Map.of(
            "WA001", new CarSpecSearchConfig("POLESTAR", "1", "e"),
            "WA999", new CarSpecSearchConfig("BMW", "1", "h")
    );
    
    // 번호판대 계산 시 사용하는 번호판 구분 코드
	public static final String NORMAL = "7";
	public static final String FILM   = "F";
	public static final String ETC    = "X";
	
	// 번호판 조회 세션 Key
	private static final String NUMPLATE_SESSION_KEY = "NUMPLATE_LIST";

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
    private final SearchLogInterceptor searchLogInterceptor;

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
        List<Map<String, Object>> rows = newcarMapper.getWaNewCarList(request);
        rows.forEach(this::applyWaAttachStatus);
        return rows;
    }

    public boolean verifyWaExcelPassword(UserDto user, String password) {
        validateWaPrivacyExcelAccess(user);

        if (password == null || password.isBlank()) {
            return false;
        }

        // The authentication SELECT should not leave the login ID in CONDITION_TX.
        return searchLogInterceptor.withoutAutoLog(
                () -> authService.verifyPassword(user.getLOGIN_ID(), password)
        );
    }

    public List<Map<String, Object>> getWaPrivacyExcelList(NewcarSearchRequest request, UserDto user) {
        validateWaPrivacyExcelAccess(user);

        return searchLogInterceptor.withoutAutoLog(() -> {
            List<Map<String, Object>> rows = getWaNewCarList(request, user);
            List<String> serviceIds = new ArrayList<>();
            Set<String> uniqueServiceIds = new HashSet<>();

            for (Map<String, Object> row : rows) {
                String serviceId = Objects.toString(row.get("SERVICE_ID"), "").trim();

                if (!serviceId.isEmpty() && uniqueServiceIds.add(serviceId)) {
                    serviceIds.add(serviceId);
                }
            }

            List<Map<String, Object>> privacyRows = new ArrayList<>();
            final int chunkSize = 900;

            for (int start = 0; start < serviceIds.size(); start += chunkSize) {
                int end = Math.min(start + chunkSize, serviceIds.size());
                privacyRows.addAll(newcarMapper.getWaPrivacyExcelInfoList(
                        serviceIds.subList(start, end),
                        "010"
                ));
            }

            searchLogInterceptor.insertManualSearchLog(
                    user,
                    "WA_CA_PRIVACY_EXCEL_DOWNLOAD",
                    "010",
                    buildWaPrivacyExcelLogCondition(request)
            );

            return privacyRows;
        });
    }

    private String buildWaPrivacyExcelLogCondition(NewcarSearchRequest request) {
        return "WaNewcarExcelSearchCondition("
                + "DATE_CD=" + logValue(request.getDATE_CD())
                + ", START_DT=" + logValue(request.getSTART_DT())
                + ", END_DT=" + logValue(request.getEND_DT())
                + ", SPACE_TYPE=" + logValue(request.getSPACE_TYPE())
                + ", PROC_ST=" + logValue(request.getPROC_ST())
                + ", NUM_PROC_ST=" + logValue(request.getNUM_PROC_ST())
                + ", CUSTOMER_NM=" + logValue(request.getCUSTOMER_NM())
                + ", CAR_NO=" + logValue(request.getCAR_NO())
                + ", LINK_ID=" + logValue(request.getLINK_ID())
                + ")";
    }

    private String logValue(String value) {
        return value == null ? "null" : value;
    }

    private void validateWaPrivacyExcelAccess(UserDto user) {
        if (user == null
                || !"WA001".equals(user.getCOMPANY_ID())
                || !"CA".equalsIgnoreCase(user.getMEMBER_GB())) {
            throw new BusinessException("개인정보 엑셀 다운로드 권한이 없습니다.", 403);
        }
    }

    /**
     * 프런트의 attachPolicy.js와 동일한 기준으로 첨부 필요/완료 여부를 계산한다.
     * ATTACH_YN은 실제 업로드 서류가 필요한 경우에만 Y이며,
     * ATTACH_COMPLETE_YN은 필요한 모든 문서 코드가 등록된 경우에만 Y이다.
     */
    private void applyWaAttachStatus(Map<String, Object> row) {
        Set<String> requiredCodes = resolveWaRequiredAttachCodes(row);
        Set<String> uploadedCodes = parseAttachCodes(row.get("ATTACH_CODES"));

        row.put("ATTACH_YN", requiredCodes.isEmpty() ? "" : "Y");
        row.put("ATTACH_COMPLETE_YN",
                !requiredCodes.isEmpty() && uploadedCodes.containsAll(requiredCodes) ? "Y" : "");

        row.remove("ATTACH_TASK_CD");
        row.remove("ATTACH_REG_GB");
        row.remove("ATTACH_RATIO_NO");
        row.remove("ATTACH_NTAX_TRGET_CD");
        row.remove("ATTACH_NTAX_TRGET_GR_CD");
        row.remove("ATTACH_NTAX_WHO");
        row.remove("ATTACH_CODES");
    }

    private Set<String> resolveWaRequiredAttachCodes(Map<String, Object> row) {
        Set<String> requiredCodes = new HashSet<>();
        String taskCd = attachValue(row, "ATTACH_TASK_CD");
        String procCd = attachValue(row, "PROC_CD");
        String regGb = attachValue(row, "ATTACH_REG_GB");
        String ratioNo = attachValue(row, "ATTACH_RATIO_NO");

        if (("NORML".equals(taskCd) || ("LEASE".equals(taskCd) && "C".equals(procCd)))
                && "F".equals(regGb)) {
            requiredCodes.add("FOREIGN_ID");
        }

        if (isJointOwnershipRatio(ratioNo)) {
            addCodes(requiredCodes, "OWNER_ID", "JOINT_OWNER_ID", "JOINT_OWNER_AGREEMENT");
        }

        if ("LEASE".equals(taskCd) && "C".equals(procCd)) {
            requiredCodes.add("LEASE_AGREEMENT");
        }

        addWaNtaxRequiredCodes(row, requiredCodes);
        return requiredCodes;
    }

    private void addWaNtaxRequiredCodes(Map<String, Object> row, Set<String> requiredCodes) {
        String targetCode = attachValue(row, "ATTACH_NTAX_TRGET_CD");
        String gradeCode = attachValue(row, "ATTACH_NTAX_TRGET_GR_CD");
        String targetWho = attachValue(row, "ATTACH_NTAX_WHO");

        if (targetCode.isEmpty() || "00".equals(targetCode) || NTAX_NO_UPLOAD_GRADES.contains(gradeCode)) {
            return;
        }

        boolean repre = "REPRE".equals(targetWho);
        boolean union = "UNION".equals(targetWho);

        switch (targetCode) {
            case "01", "02" -> {
                if (repre || union) requiredCodes.add("PATRIOT_CERT");
                if (union) addCodes(requiredCodes, "RESIDENT_CERT", "FAMILY_CERT");
            }
            case "03" -> {
                if (repre || union) {
                    addCodes(requiredCodes, "AGENT_ORANGE_TARGET_CERT", "AGENT_ORANGE_CERT");
                }
                if (union) addCodes(requiredCodes, "RESIDENT_CERT", "FAMILY_CERT");
            }
            case "04" -> {
                if (repre || union) requiredCodes.add("DISABILITY_CERT");
                if (union) {
                    addCodes(requiredCodes, "RESIDENT_CERT", "FAMILY_CERT",
                            "LEGAL_REPRESENTATIVE_AGREEMENT", "GUARDIAN_CERT", "BASIC_CERT");
                }
            }
            case "05" -> {
                if (repre || union) requiredCodes.add("DISABILITY_CERT");
                if (union) addCodes(requiredCodes, "RESIDENT_CERT", "FAMILY_CERT");
                if ("4".equals(gradeCode)) requiredCodes.add("DISABILITY_LEVEL_CERT");
            }
            case "06", "15" -> {
                if (repre || union) addCodes(requiredCodes, "FAMILY_CERT", "RESIDENT_CERT");
            }
            case "09" -> {
                if (repre) addCodes(requiredCodes, "DEFECT_CERT", "DEREGISTRATION_CERT", "MANUFACTURER_CERT");
            }
            case "11" -> {
                if (repre) addCodes(requiredCodes, "BUSINESS_CERT", "SALES_CONTRACT", "VEHICLE_REGISTRATION");
            }
            case "13" -> {
                if (repre) addCodes(requiredCodes, "UNIQUE_NUMBER_CERT", "OFFICIAL_VEHICLE_APPROVAL");
            }
            case "14" -> {
                if (repre || union) requiredCodes.add("PATRIOT_CONFIRM");
                if (union) addCodes(requiredCodes, "RESIDENT_CERT", "FAMILY_CERT");
            }
            default -> {
                // 첨부 정책이 없는 감면 유형은 필요한 문서를 추가하지 않는다.
            }
        }
    }

    private void addCodes(Set<String> target, String... codes) {
        target.addAll(Arrays.asList(codes));
    }

    private Set<String> parseAttachCodes(Object value) {
        Set<String> codes = new HashSet<>();
        String joinedCodes = Objects.toString(value, "").trim();

        if (!joinedCodes.isEmpty()) {
            Arrays.stream(joinedCodes.split("\\|"))
                    .map(String::trim)
                    .filter(code -> !code.isEmpty())
                    .forEach(codes::add);
        }

        return codes;
    }

    private boolean isJointOwnershipRatio(String ratioNo) {
        if (ratioNo.isEmpty()) {
            return false;
        }

        try {
            return Double.compare(Double.parseDouble(ratioNo), 100D) != 0;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private String attachValue(Map<String, Object> row, String key) {
        return Objects.toString(row.get(key), "").trim();
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
            throw new BusinessException(normalizedCarName + " 차량제원을 찾을 수 없습니다.", 404);
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
        if (!Set.of("e", "1", "2", "3").contains(normalizedCarGb)) {
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

        Map<String, Object> result = new HashMap<>(taxInfo);
        Map<String, Object> codeConfig = newcarMapper.getEstimateCodeConfig();
        if (codeConfig != null) {
            result.putAll(codeConfig);
        }
        return result;
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
	private List<String> validateExcelRow(Map<String, Object> row, Set<String> excelCarIds, Set<String> excelLinkId, Map<String, String> dlvMap, String companyId) {
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
			// SPACE_GB에 해당하는 Specialist만 허용
			Map<String, Object> memberInfo = authMapper.selectMemberSuInfo(companyId, spaceGb, spaceNm);
			if (memberInfo == null) {
		        errors.add("Space 명과 담당 Specialist 정보 매칭 불가");
		    } else {
		        // 해당 SU login_id, branch_id 넣어주기
		    	row.put("SU_LOGIN_ID", memberInfo.get("LOGIN_ID"));
		    	row.put("SU_BRANCH_ID", memberInfo.get("BRANCH_ID"));
		    }
		}

		String directYn = Objects.toString(row.get("DIRECT_YN"), "").trim();
		logger.info("차량 등록 방법 directYn 값 확인 중 : {}", directYn);
		if (isEmpty(directYn)) {
			errors.add("등록방법(Agency/자가등록) 없음");
		} else {
			if (!"자가등록".equals(directYn) && !"Agency".equalsIgnoreCase(directYn)) {
				errors.add("등록방법(Agency/자가등록) 아님");
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
			Row headerRow = sheet.getRow(0);
			DataFormatter formatter = new DataFormatter();
			var evaluator = workbook.getCreationHelper().createFormulaEvaluator();
			for (int i = 1; i <= sheet.getLastRowNum(); i++) {
				Row excelRow = sheet.getRow(i);
				if (excelRow == null) {
					continue;
				}
				Map<String, Object> row = new HashMap<>();
				row.put("LINK_ID", getCellValue(excelRow.getCell(0), formatter)); // A: 주문번호
				row.put("CARID_NO", getCellValue(excelRow.getCell(1), formatter)); // B: 차대번호
				row.put("CAR_NM", (getCellValue(excelRow.getCell(2), formatter) + " "
						+ getCellValue(excelRow.getCell(4), formatter)).trim()); // C + E: 차명
				String carPackage = getExcelCellValue(
						headerRow, excelRow, formatter, -1, "Package", "CAR_PACKAGE", "패키지");
				String engine = getExcelCellValue(
						headerRow, excelRow, formatter, -1, "Engine", "CAR_ENGINE", "엔진");
				row.put("CAR_PACKAGE", carPackage);
				row.put("ECO_YN", resolveExcelEcoYn(row.get("CAR_NM"), carPackage, engine));
				row.put("REGIST_DATE", getCellValue(excelRow.getCell(7), formatter)
						.replace("-", "").replace(".", "")); // H: 차량등록예정일
				row.put("DIRECT_YN", getCellValue(excelRow.getCell(8), formatter)); // I: 차량 등록 방법
				row.put("SPACE_GB", getCellValue(excelRow.getCell(9), formatter)); // J: SPACE 명
				row.put("SPACE_NM", getCellValue(excelRow.getCell(10), formatter)); // K: 담당 Specialist
				row.put("OWNER_NM", getCellValue(excelRow.getCell(11), formatter)); // L: 계약자(고객명)
				row.put("BUY_AMT", formatter.formatCellValue(excelRow.getCell(13), evaluator)
						.trim().replace(",", "")); // N: 차량 세금 계산서 금액
				result.add(row);
			}
		} catch (Exception e) {
			throw new RuntimeException("엑셀 읽기 실패", e);
		}
		return result;
    }

	static String resolveExcelEcoYn(Object carName, String carPackage, String engine) {
		String model = Objects.toString(carName, "").replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
		if (model.contains("POLESTAR4")) {
			return carPackage.toUpperCase(Locale.ROOT).contains("PERFORMANCE") ? "N" : "Y";
		}
		if (model.contains("POLESTAR3")) {
			return engine.toUpperCase(Locale.ROOT).contains("REAR") ? "Y" : "N";
		}
		return "Y";
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
		List<Map<String, Object>> dlaCodes = codeMapper.findCodesByGroupId("DLADD");

		Map<String, String> dlvMap = new HashMap<>();
		Map<String, String> dlaMap = new HashMap<>();

		for (Map<String, Object> code : dlvCodes) {
			dlvMap.put(Objects.toString(code.get("CODE_NM"), "").trim(), Objects.toString(code.get("CODE_ID"), ""));
		}

		for (Map<String, Object> code : dlaCodes) {
			dlaMap.put(Objects.toString(code.get("CODE_ID"), "").trim(), Objects.toString(code.get("CODE_NM"), ""));
		}
		// =========================
		// 1. 검증 단계
		// =========================
		for (int i = 0; i < rows.size(); i++) {
			Map<String, Object> row = rows.get(i);
			List<String> errors = validateExcelRow(
					row, excelCarIds, excelLinkId, dlvMap, user.getCOMPANY_ID());
			if (errors.isEmpty()) {
				try {
					applyExcelCarSpec(row, user);
				} catch (BusinessException e) {
				    logger.warn("[엑셀 업로드] 차량 제원 적용 오류", e);
				    errors.add("처리 중 오류가 발생하였습니다.");
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
	 * 엑셀 업로드 양식 다운로드
	 */
	public void downloadExcelTemplate(
	        String fileName,
	        HttpServletResponse response) throws Exception {

	    File file = new File(attachService.getFormRoot(), fileName);

	    if (!file.exists()) {
	        throw new FileNotFoundException("엑셀 업로드 양식 파일이 없습니다.");
	    }

	    String encodedFileName = URLEncoder.encode(fileName, "UTF-8")
	            .replace("+", "%20");

	    response.setContentType(
	            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	    );

	    response.setHeader(
	            "Content-Disposition",
	            "attachment; filename=\"" + encodedFileName + "\""
	    );

	    response.setContentLength((int) file.length());

	    try (
	        FileInputStream fis = new FileInputStream(file);
	        OutputStream os = response.getOutputStream()
	    ) {
	        byte[] buffer = new byte[8192];
	        int length;

	        while ((length = fis.read(buffer)) != -1) {
	            os.write(buffer, 0, length);
	        }

	        os.flush();
	    }
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
	    dsNewCar.put("CAR_PACKAGE", row.get("CAR_PACKAGE"));
	    dsNewCar.put("ECO_YN", row.get("ECO_YN"));
	    dsNewCar.put("VH_TY_CD", row.get("VH_TY_CD"));
	    dsNewCar.put("BUY_AMT", row.get("BUY_AMT"));
	    dsNewCar.put("REGIST_DATE", row.get("REGIST_DATE")); 						   // 등록일자
	    dsNewCar.put("STAMP_GB", "TOTAL"); 			  	 	 					   // 인지세
		String directYnText = Objects.toString(row.get("DIRECT_YN"), "").trim();
		String directyn = "N";
		if ("자가등록".equals(directYnText) || "Y".equalsIgnoreCase(directYnText)) {
			directyn = "Y";
			dsService.put("PROC_ST", "INPUT");  // 자가등록이면 상태값 INPUT으로 변경
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
                // 서비스 정보
                Map<String, Object> service =
        		mortgageMapper.getTrService(serviceId);

                if (service == null || service.isEmpty()) {
                    throw new BusinessException("서비스 정보 없음: " + serviceId, 404);
                }

                // 신차 정보
                Map<String, Object> detail =
        		newcarMapper.getNewCarDetail(serviceId);
                
                String smsText = "안녕하세요. 폴스타 차량의 등록 신청이 관청에 접수되었습니다.\n\n"
                		+ "주문번호 : " + service.get("LINK_ID") + "\r\n차대번호 : " + detail.get("CARID_NO") + "\r\n\r\n" 
                        + "[취득세 감면 대상자 유의사항]\n"
                        + "1. 감면 혜택을 받은 차량은 정해진 법적 요건(의무 보유 기간 등)을 유지해야 합니다. 요건 변동(조기 매각 등) 사유가 발생할 경우, 감면받은 지방세가 환수될 수 있으며 사유 발생일로부터 60일 이내 미신고 시 가산세가 부과될 수 있으니 유의해 주시기 바랍니다.\n"
                        + "2. 기존 감면과 동일한 감면은 적용할 수 없습니다. 대체 취득의 경우 신규 차량 등록일부터 60일 내에 기존 감면 차량을 말소하거나 소유권을 이전해야 합니다. \r\n\r\n"
                        + "[저공해 차량 대상자 안내사항]\n"
                        + "저공해 차량 등록 정보는 신규 등록을 마친 다음 날부터 무공해차 통합누리집에서 확인하실 수 있습니다.\n\n"
                        + "[외부 장치용 번호판 수요자 안내사항]\n"
                        + "외부 장치용 번호판은 신규등록 완료 후 가까운 차량등록관청에 방문하여 외부 장치용 번호판을 신청하실 수 있습니다.\n\n"
                        + "※ 본 메시지는 자동 발송되는 발신전용 메시지입니다. 차량 등록과 관련하여 문의사항이 있으신 고객님은 담당 스페셜리스트에게 문의 부탁 드립니다."
                        + (isBlank(specialistPhone) ? "" : "\n담당 스페셜리스트 : " + specialistPhone); 
                
                // 심사요청 문자 발송
                param.put("PAY_HP_NO", row.get("PAY_HP_NO").toString()); // 결제자 연락처
                param.put("TEXT", smsText);                   			 // 문자 내용
                param.put("MSG_TYPE", "3");                  			 // 문자메세지 유형 1:SMS, 3:LMS
                param.put("SUBJECT", "등록 접수 안내");                  // 문자메세지 제목

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

			// 기본값 보정
			normalizeNewCar(mNewCar);
			
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
		    normalizeTaxReceipt(mTaxReceipt, mNewCar);

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
			logger.info("mExemption: {}", mExemption);
			
			if (!"W_REQ".equals(beforeProcSt) && "W_REQ".equals(procSt)) {
			
				// 감면서류 PDF 생성 및 병합
				// - CREATE_YN : 감면신청서 생성 후 병합
				// - MERGE_YN  : 감면신청서 없이 증빙서류만 병합
			    if ("Y".equals(mExemption.get("CREATE_YN")) ||
			    	"Y".equals(mExemption.get("MERGE_YN"))) {
			        attachService.mergePdf(serviceId, mExemption);
			    }
			    // 미성년자 확인서류 PDF 병합
			    if ("Y".equals(mExemption.get("MINOR_YN"))) {
			        attachService.mergeMinorPdf(serviceId);
			    }
			}
			
		    // 신청 여부 확인
		    // 신청 상태: S_WAIT(심사대기), S_REQ(심사요청), P_REQ(납부요청)
		    boolean isRequest = "S_WAIT".equals(procSt) || "S_REQ".equals(procSt) || "P_REQ".equals(procSt);
		    logger.info("isRequest : {}",isRequest);

		    if(isRequest) {

				logger.info("PAY_GB : {}", mNewCar.get("PAY_GB"));
				// 선납건(폴스타 등)은 가상계좌 생성 후 입금 대기 처리
				if("B".equals(mNewCar.get("PAY_GB")) && "P_REQ".equals(procSt)) {
	
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
		    result.put("MESSAGE", "처리 중 오류가 발생하였습니다");

		} catch (Exception e) {
		    logger.error("신규등록 처리 중 시스템 오류", e);
		    result.put("RESULT_CD", "-3");
		    result.put("MESSAGE", "처리 중 오류가 발생하였습니다.");

		}

		return ApiResponse.withKey("data", result);
	}
	
	// 값이 비어 있는 경우 이곳을 타게 한다.
	private void normalizeNewCar(Map<String, Object> mNewCar) {

	    if (commonUtil.isEmpty(mNewCar.get("NTAX_TRGET_CD"))) {
	        mNewCar.put("NTAX_TRGET_CD", "00");
	    }

	    if (commonUtil.isEmpty(mNewCar.get("NTAX_APPLC_CD"))) {
	        mNewCar.put("NTAX_APPLC_CD", "0");
	    }

	    if (!"00".equals(mNewCar.get("NTAX_TRGET_CD"))
	            && !"11".equals(mNewCar.get("NTAX_APPLC_CD"))) {
	        mNewCar.put("NTAX_APPLC_CD", "11");
	    }

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

    private void normalizeTaxReceipt(
            Map<String, Object> taxReceipt,
            Map<String, Object> newCar) {
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

        String taskCd = Objects.toString(newCar != null ? newCar.get("TASK_CD") : null, "")
                .trim()
                .toUpperCase();
        String procCd = Objects.toString(newCar != null ? newCar.get("PROC_CD") : null, "")
                .trim()
                .toUpperCase();
        String regGb = Objects.toString(newCar != null ? newCar.get("REG_GB") : null, "")
                .trim()
                .toUpperCase();
        String privateBusinessYn = Objects.toString(taxReceipt.get("ETC1"), "")
                .trim()
                .toUpperCase();
        boolean isEligibleTask = (
                "NORML".equals(taskCd) && "I".equals(procCd)
        ) || (
                "LEASE".equals(taskCd) && "C".equals(procCd)
        );
        boolean isPersonalOwner = "R".equals(regGb) || "F".equals(regGb);

        taxReceipt.put(
                "ETC1",
                isEligibleTask && isPersonalOwner && "Y".equals(privateBusinessYn) ? "Y" : "N"
        );
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
            normalizeTaxReceipt(mTaxReceipt, mNewCar);

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

			// 08시 스케줄을 타지 못하는 당일 신청 건은 CA 신청 완료 시 보험 접수함.
			if (isTodayRegistration(mNewCar.get("REGIST_DATE"))) {
				try {
					insertAndSendNewcarInsurance(
						serviceId,
						Objects.toString(mService.get("COMPANY_ID"), ""),
						user.getLOGIN_ID()
					);
				} catch (Exception e) {
					// 보험 연계 실패가 기존 신규등록 신청을 중단시키지 않도록 분리함.
					logger.error("[보험접수] CA 당일 신청 처리 실패 - serviceId: {}", serviceId, e);
				}
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
	        	// 리스건은 계약자 정보 관청 DB에 안 들어가게 초기화
	            if ("LEASE".equals(input.get("TASK_CD")) && !"C".equals(input.get("PROC_CD"))) {
	            	owner.put("DEBTOR_NM", null);
	                owner.put("DEBTOR_GB", null);
	                owner.put("REG_NO", null);
	                owner.put("DSIGN_HP_NO", null);
	            }
	            
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
	 * 신규등록 보험 요청을 우리 DB에 저장하고 관청 연계 서버에 접수함.
	 * 호출할 때마다 새 I020 요청을 생성하여 동일 신규등록 건의 복수 조회 이력을 허용함.
	 */
	public boolean insertAndSendNewcarInsurance(
			String newcarServiceId,
			String companyId,
			String memberId) {

		Map<String, Object> target =
			newcarMapper.selectNewcarInsuranceTarget(newcarServiceId);

		if (target == null || target.isEmpty()) {
			logger.warn("[보험접수] 대상 정보 없음 - serviceId: {}", newcarServiceId);
			return false;
		}

		String carNo = Objects.toString(target.get("CARID_NO"), "").trim();
		String regNo = Objects.toString(target.get("REG_NO"), "").trim();
		String bizNo = Objects.toString(target.get("BIZ_NO"), "").trim();
		String buyNm = Objects.toString(target.get("BUY_NM"), "").trim();

		if (carNo.isBlank() || (regNo.isBlank() && bizNo.isBlank()) || buyNm.isBlank()) {
			logger.warn(
				"[보험접수] 필수 정보 부족 - serviceId: {}, carNoExists: {}, identifierExists: {}, buyNmExists: {}",
				newcarServiceId,
				!carNo.isBlank(),
				!regNo.isBlank() || !bizNo.isBlank(),
				!buyNm.isBlank()
			);
			return false;
		}

		String insuranceServiceId =
			commonUtil.toServiceId(Map.of("WORK_CD", "I020"));

		Map<String, Object> insurance = new HashMap<>();
		insurance.put("SERVICE_ID", insuranceServiceId);
		insurance.put("LINKED_ID", newcarServiceId);
		insurance.put("CAR_NO", carNo);
		insurance.put("BUY_NM", buyNm);
		insurance.put("REG_NO", regNo);
		insurance.put("BIZ_NO", bizNo);
		insurance.put("COMPANY_ID", companyId);
		insurance.put("GOVT_ID", "HAMYA");
		insurance.put("MEMBER_ID", isBlank(memberId) ? "SYSTEM" : memberId);

		newcarMapper.insertNewcarInsurance(insurance);

		return sendNewcarInsurance(insurance);
	}

	/** 관청 연계 서버에 보험가입접수 요청을 전달함. */
	private boolean sendNewcarInsurance(Map<String, Object> insurance) {
		Map<String, Object> insuranceData = new HashMap<>();
		insuranceData.put("SERVICE_ID", insurance.get("SERVICE_ID"));
		insuranceData.put("CAR_NO", insurance.get("CAR_NO"));
		insuranceData.put("REG_NO", insurance.get("REG_NO"));
		insuranceData.put("BIZ_NO", insurance.get("BIZ_NO"));

		Map<String, Object> linkData = new HashMap<>();
		linkData.put("SID", "보험가입접수");
		linkData.put("GOVT_ID", insurance.get("GOVT_ID"));
		linkData.put("SEND_DATA", List.of(insuranceData));

		JsonNode response = commonService.linkServer(linkData);
		String errorCode = response.path("errorCode").asText();

		if (!"0".equals(errorCode)) {
			logger.error(
				"[보험접수] 관청 전송 실패 - insuranceServiceId: {}, errorCode: {}",
				insurance.get("SERVICE_ID"),
				errorCode
			);
			return false;
		}

		logger.info(
			"[보험접수] 관청 전송 완료 - insuranceServiceId: {}, linkedId: {}",
			insurance.get("SERVICE_ID"),
			insurance.get("LINKED_ID")
		);
		return true;
	}

	/** 신규등록 예정일이 한국 시간 기준 오늘인지 확인함. */
	private boolean isTodayRegistration(Object registDateValue) {
		String digits = Objects.toString(registDateValue, "").replaceAll("[^0-9]", "");
		if (digits.length() < 8) {
			return false;
		}

		try {
			LocalDate registDate = LocalDate.parse(
				digits.substring(0, 8),
				DateTimeFormatter.BASIC_ISO_DATE
			);
			return LocalDate.now(SEARCH_ZONE).equals(registDate);
		} catch (DateTimeParseException e) {
			logger.warn("[보험접수] 등록예정일 형식 오류 - value: {}", registDateValue);
			return false;
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

		/*
		// 저장시 차대번호 체크?
		// 주석 풀 때 확인. isDuplicateCar안에 'SAV'있어서 오류
	    if (!Objects.equals("RET", input.get("JUDGE_ST")) && isDuplicateCar(input)) {
	        throw new RuntimeException("중복된 차대번호입니다.");
	    }*/

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
	
	// 중복된 차대번호 조회
	private boolean isDuplicateCar3(Map<String, Object> input) {
	    var where = Map.of("CARID_NO", input.get("CARID_NO"));
	    return !common.selectList(where, "selectDuplicateCarIdNO3").isEmpty();
	}

	// 중복된 차대번호 조회 (엑셀업로드 시)
	private boolean isDuplicateCar2(Map<String, Object> input) {
	    var where = Map.of("CARID_NO", input.get("CARID_NO"));
	    return !common.selectList(where, "selectDuplicateCarIdNO2").isEmpty();
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

	    String serviceId =
	        Objects.toString(param.get("SERVICE_ID"), "");

	    List<String> sessionList =
	        getNumplateSession(session, serviceId);

	    if (sessionList == null) {
	        sessionList = new ArrayList<>();
	    }

	    String condition =
	        Objects.toString(param.get("CONDITION"), "NOT");

	    int sessionCount = sessionList.size();

	    List<String> result = new ArrayList<>();


	    // =====================================================
	    // 이전 조회에서 표시중(P)이었던 세션 번호판 원복
	    // =====================================================
	    if (!sessionList.isEmpty()) {

	        param.put("NUM_LIST", sessionList);

	        common.update(
	            param,
	            "releaseNumplateList"
	        );
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
	public ApiResponse<Object> selectNumplate(Map<String, Object> param, UserDto user) {
		String serviceId = Objects.toString(param.get("SERVICE_ID"), "");
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

	/**
	 * SP가 조회한 번호판을 고객에게 5분간 배정하고 선택 링크를 문자로 발송한다.
	 *
	 * 처리 순서:
	 * 1. 로그인 권한과 현재 세션에서 실제 조회한 번호인지 검증한다.
	 * 2. 서비스의 탈부착 행을 잠가 같은 건의 동시 발송/재발송을 직렬화한다.
	 * 3. 재발송이면 이전 토큰의 P(표시중) 번호를 N(미사용)으로 돌린다.
	 * 4. 새 토큰을 번호판 목록과 탈부착 건에 함께 저장하고 조회 이력을 메모에 남긴다.
	 * 5. 토큰이 포함된 공개 고객 URL을 문자 큐에 등록한다.
	 */
	@Transactional
	public Map<String, Object> sendNumplateSelectionMessage(Map<String, Object> param, UserDto user, HttpSession session) {
		if (!"SU".equals(user.getMEMBER_GB())) {
			throw new BusinessException("SP 계정만 번호판 선택 문자를 발송할 수 있습니다.");
		}

		String serviceId = Objects.toString(param.get("SERVICE_ID"), "").trim();
		String phone = Objects.toString(param.get("PAY_HP_NO"), "").replaceAll("\\D", "");
		String baseUrl = Objects.toString(param.get("BASE_URL"), "").replaceAll("/+$", "");
		List<String> carNos = normalizeNumplateMessageList(param.get("CAR_NOS"));
		if (serviceId.isEmpty() || !phone.matches("\\d{10,11}") || !baseUrl.matches("https?://.+")) {
			throw new BusinessException("서비스, 수신번호 또는 접속 주소를 확인해 주세요.");
		}

		// 브라우저가 임의 번호를 추가해 보내더라도 현재 SP 세션에서 조회한 번호만 허용한다.
		List<String> queried = getNumplateSession(session, serviceId);
		if (queried == null || !queried.containsAll(carNos)) {
			throw new BusinessException("현재 세션에서 조회하지 않은 번호판이 포함되어 있습니다.");
		}

		Map<String, Object> work = new HashMap<>();
		work.put("SERVICE_ID", serviceId);
		work.put("NUM_LIST", carNos);
		// 재발송과 고객 선택이 엇갈려 서로 다른 토큰을 덮어쓰지 않도록 서비스 행을 잠근다.
		if (common.select(work, "lockNumplateMessageDetach") == null) {
			throw new BusinessException("번호판 배정 정보를 찾을 수 없습니다.");
		}
		Integer pendingCount = common.select(work, "countPendingNumplateMessageList");
		if (pendingCount == null || pendingCount != carNos.size()) {
			throw new BusinessException("이미 사용되었거나 조회 상태가 아닌 번호판이 포함되어 있습니다.");
		}

		// 기존 링크를 먼저 무효화하고, 이전 링크에 묶였던 미선택 번호를 재사용 가능 상태로 복구한다.
		common.update(work, "releasePreviousNumplateMessage");
		common.update(work, "clearNumplateMessageDetach");
		String token = UUID.randomUUID().toString().replace("-", "");
		String confirmNo = String.join(",", carNos);
		work.put("TOKEN", token);
		work.put("CONFIRM_NO", confirmNo);
		if (common.update(work, "assignNumplateMessageList") != carNos.size()
				|| common.update(work, "updateNumplateMessageDetach") != 1) {
			throw new BusinessException("번호판 문자 배정에 실패했습니다.");
		}
		if (common.update(work, "appendNumplateMessageMemo") != 1) {
			throw new BusinessException("신규등록 메모 저장에 실패했습니다.");
		}

		String url = baseUrl + "/customer/WaNewcarNumplateSelect?t=" + token;
		Map<String, Object> sms = new HashMap<>();
		sms.put("PAY_HP_NO", phone);
		sms.put("MSG_TYPE", "3");
		sms.put("SUBJECT", "차량 번호 선택");
		sms.put("TEXT", "안녕하세요. 폴스타 차량번호 선택을 위하여 아래 링크에서 5분 이내에 차량 번호를 선택해 주세요.\r\n" + url + "\r\n※ 본 메시지는 자동 발송되는 발신전용 메시지입니다. 차량 등록과 관련하여 문의사항이 있으신 고객님은 담당 스페셜리스트에게 문의 부탁 드립니다. \n" + //
						"담당 스페셜리스트 : " + Objects.toString(user.getMPHONE_NO(), ""));
		commonService.sendSms(sms);

		return Map.of("token", token, "confirmNo", confirmNo, "carNos", carNos, "expiresInSeconds", 300);
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
		Map<String, Object> row = common.select(Map.of("SERVICE_ID", serviceId), "selectNumplateMessageStatus");
		if (row == null || row.get("NUMPLATE_MSG_TOKEN") == null) {
			return Map.of("state", "NONE");
		}
		String selected = Objects.toString(row.get("REQ_CAR_NO"), "");
		Map<String, Object> result = new HashMap<>(row);
		String state = !selected.isEmpty() ? "SELECTED" : "Y".equals(row.get("ACTIVE_YN")) ? "ACTIVE" : "EXPIRED";
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
	public Map<String, Object> getCustomerNumplateSelection(String token) {
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

	/**
	 * 고객이 고른 번호를 확정한다.
	 * 토큰 행을 FOR UPDATE로 잠근 뒤 선택 번호는 S(사용), 나머지는 N(미사용)으로 바꾸고
	 * TR_NEWCAR.REQ_CAR_NO까지 한 트랜잭션으로 저장한다. 같은 번호의 재요청은 멱등 성공,
	 * 다른 번호로 다시 선택하는 요청은 거절한다.
	 */
	@Transactional
	public Map<String, Object> confirmCustomerNumplateSelection(Map<String, Object> param) {
		String token = Objects.toString(param.get("TOKEN"), "").trim();
		String carNo = Objects.toString(param.get("CAR_NO"), "").trim();
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
		Object appearedAt = assignment.get("APPEAR_DT");
		if (!(appearedAt instanceof java.util.Date)
				|| ((java.util.Date) appearedAt).toInstant().plusSeconds(300).isBefore(Instant.now())) {
			throw new BusinessException("번호판 선택 시간이 만료되었습니다.");
		}

		Map<String, Object> work = new HashMap<>();
		work.put("TOKEN", token);
		work.put("CAR_NO", carNo);
		work.put("CARID_NO", assignment.get("CARID_NO"));
		work.put("SERVICE_ID", assignment.get("SERVICE_ID"));
		work.put("SELECT_SERVICE_ID", assignment.get("SERVICE_ID") + "_S");
		if (common.update(work, "selectCustomerNumplate") != 1) {
			throw new BusinessException("배정되지 않은 번호판입니다.");
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
	public int cleanupExpiredNumplateSelections() {
		int count = common.update(Map.of(), "appendExpiredNumplateMessageMemo");
		count += common.update(Map.of(), "clearExpiredNumplateMessageDetach");
		count += common.update(Map.of(), "releaseExpiredNumplateMessageList");
		count += common.update(Map.of(), "releaseExpiredPendingNumplateList");
		return count;
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

		param.put("SERVICE_ID", param.get("serviceId"));
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
	public boolean getNumPlateRelease(Map<String, Object> param) {

	    try {
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

	        param.put("NUM_LIST", numList);

	        common.update(param, "releaseNumplateList");

	        return true;

	    } catch (Exception e) {
	        logger.error("getNumPlateRelease fail", e, " param: ", param);
	        return false;
	    }
	}
	
	public void updateChangeSu(Map<String, Object> param, UserDto user) {
		
		List<Map<String,Object>> list = (List<Map<String,Object>>) param.get("LIST");
		
		for(Map<String,Object> row : list) {

	        row.put("MEMBER_ID", param.get("CHAGE_SU_ID"));
	        row.put("RECEIVE_NM", param.get("CHAGE_SU_NM"));
	        row.put("RECEIVE_TEL_NO", param.get("CHAGE_SU_HP"));
	        row.put("UPD_USER", user.getLOGIN_ID());

	        common.update(row, "updateTrService");
	        common.update(row, "updateTrCarNoDetach");
	    }
		
	}

	public void cancel(Map<String, Object> param, UserDto user) {
		
		param.put("UPD_USER", user.getLOGIN_ID());
		// 처리상태 변경
		common.update(param, "updateTrService");
		// 알림 띄우기
		commonService.procedureTmBoard(param);
		
	}
	
    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String safeValue(String value) {
        return value == null ? "" : value;
    }
   
}



