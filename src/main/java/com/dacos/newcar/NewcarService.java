package com.dacos.newcar;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.OutputStream;
import java.net.URI;
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
import java.util.LinkedHashMap;
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
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

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
import com.dacos.common.ServiceAccessGuard;
import com.dacos.common.ServiceAccessGuard.ListAccessScope;
import com.dacos.common.ServiceAccessGuard.ServiceAction;
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
    private static final Set<String> SUPPLY_AMOUNT_PAY_KINDS = Set.of(
            "ACQ", "BFEE", "BOND", "FEE", "INJI", "SPARE", "STAMP", "TNUM", "UNUM", "UREG");

    // 회사별 차량제원 조회 조건을 한곳에서 관리함. 신규 고객 추가 시 회사코드, Maker, 차종구분을 함께 등록함.
    private static final Map<String, CarSpecSearchConfig> CAR_SPEC_SEARCH_CONFIG_BY_COMPANY = Map.of(
            "WA001", new CarSpecSearchConfig("POLESTAR", "1"),
            "WA999", new CarSpecSearchConfig("BMW", "1")
    );
    
    private final CommonService commonService;
    private final AuthService authService;
    private final CommonUtil commonUtil; // 자주 쓰는 메소드
    private final CommonRepository common; // DB 접근 역할
    private final AttachService attachService;
    private final SearchLogInterceptor searchLogInterceptor;
    private final NumplateSelectionService numplateService;
    private final ServiceAccessGuard serviceAccessGuard;
    
    private final NewcarMapper newcarMapper;
    private final MortgageMapper mortgageMapper;
    private final PaymentMapper paymentMapper;    
    private final CodeMapper codeMapper;
    private final AuthMapper authMapper;
    private final SchedulerMapper schedulerMapper;

    @Value("${self-newcar.url}")
    private String selfNewcarUrl;

    @Value("${self-newcar.encryption-key}")
    private long selfNewcarEncryptionKey;
    

    /**
     * 신차 등록 목록 조회
     * - resultType을 Map으로 사용하여 MyBatis 컬럼 별칭이 JSON 키로 그대로 사용됨
     */
    public List<Map<String, Object>> getNewCarList(NewcarSearchRequest request, UserDto user) {
        logger.info("[NewcarService] 신차 목록 조회 - 기간: {} ~ {}", request.getSTART_DT(), request.getEND_DT());
        applyListAccessScope(request, user);
        request.setMEMBER_GB(user.getMEMBER_GB());
        request.setMEMBER_ID(user.getLOGIN_ID());
        return newcarMapper.getNewCarList(request);
    }

    /**
     * 신규등록 업무 화면의 문자 발송.
     * 수신 번호와 문구는 화면 용도상 변경할 수 있지만, 발송 대상 업무에 대한 수정 권한을 먼저 확인한다.
     */
    public int sendNumplateSms(Map<String, Object> param, UserDto user) {
        String serviceId = requestValue(param, "SERVICE_ID", "서비스 ID가 필요합니다.");
        serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.UPDATE_SERVICE);

        String phone = Objects.toString(param.get("PAY_HP_NO"), "").replaceAll("[^0-9]", "");
        if (!phone.matches("01[0-9]{8,9}")) {
            throw new BusinessException("휴대폰 번호를 확인해 주세요.", 400);
        }

        String text = Objects.toString(param.get("TEXT"), "").trim();
        if (text.isEmpty() || text.length() > 2000) {
            throw new BusinessException("문자 내용을 확인해 주세요.", 400);
        }

        String msgType = Objects.toString(param.get("MSG_TYPE"), "3").trim();
        if (!Set.of("1", "3").contains(msgType)) {
            throw new BusinessException("문자 유형을 확인해 주세요.", 400);
        }

        String subject = Objects.toString(param.get("SUBJECT"), "").trim();
        if (subject.length() > 100) {
            throw new BusinessException("문자 제목을 확인해 주세요.", 400);
        }

        Map<String, Object> sms = new HashMap<>();
        sms.put("PAY_HP_NO", phone);
        sms.put("TEXT", text);
        sms.put("MSG_TYPE", msgType);
        if (!subject.isEmpty()) sms.put("SUBJECT", subject);
        return commonService.sendSms(sms);
    }

	@Transactional
	public Map<String, Object> sendSelfRegistrationSms(Map<String, Object> param, UserDto user) {
		String serviceId = Objects.toString(param.get("SERVICE_ID"), "").trim();
		if (serviceId.isBlank()) throw new BusinessException("서비스 ID가 필요합니다.");
		serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.UPDATE_SERVICE);

		String url = selfNewcarUrl + "/?t=" + encodeSelfServiceId(serviceId);
		Map<String, Object> sms = new HashMap<>(param);
		sms.put("MSG_TYPE", "3");
		sms.put("SUBJECT", "셀프신규등록정보입력");
		sms.put("TEXT", "셀프신규등록정보입력\r\n"
				+ "안녕하세요. " + Objects.toString(param.get("DEALER_NAME"), "") + " "
				+ Objects.toString(param.get("CARID_NO"), "")
				+ " 차량의 신규등록 진행을 위해 아래의 URL로 접속하시어 정보를 입력 바랍니다.\r\n"
				+ "문의사항은 1844-0801(내선번호 1)로 연락 바랍니다.\r\n" + url);

		int result = commonService.sendSms(sms);
		if (result < 1 || newcarMapper.updateSelfYn(serviceId) != 1) {
			throw new BusinessException("셀프등록 문자 발송 처리에 실패했습니다.");
		}
		Map<String, Object> response = new HashMap<>();
		response.put("result", result);
		if (isDevelopmentLink(url)) response.put("testUrl", url);
		return response;
	}

	static boolean isDevelopmentLink(String url) {
		String host = URI.create(url).getHost();
		return Set.of("localhost", "127.0.0.1", "tnc.dcross.kr").contains(host);
	}

	/**
	 * N010-YYMMDD-NNNNN 형식에서 고정값과 하이픈을 제외하고 짧은 URL용 값으로 변환한다.
	 * SELF 서버는 같은 키로 역변환한 뒤 N010- 접두어와 하이픈을 복원한다.
	 */
	private String encodeSelfServiceId(String serviceId) {
		if (!serviceId.matches("N010-\\d{6}-\\d{5}")) {
			throw new BusinessException("셀프등록 서비스 ID 형식이 올바르지 않습니다.");
		}

		long number = Long.parseLong(serviceId.substring(5).replace("-", ""));
		return Long.toString(number ^ selfNewcarEncryptionKey, Character.MAX_RADIX);
	}

    public List<Map<String, Object>> getWaNewCarList(NewcarSearchRequest request, UserDto user) {
        clampWaSearchStartDate(request);
        logger.info("[NewcarService] WA 신규신청현황 조회 - 기간: {} ~ {}", request.getSTART_DT(), request.getEND_DT());
        applyListAccessScope(request, user);
        request.setCOMPANY_ID(user.getCOMPANY_ID());
        request.setBRANCH_ID(user.getBRANCH_ID());
        request.setMEMBER_GB(user.getMEMBER_GB());
        request.setMEMBER_ID(user.getLOGIN_ID());
        List<Map<String, Object>> rows = newcarMapper.getWaNewCarList(request);
        rows.forEach(this::applyWaAttachStatus);
        return rows;
    }

    public List<Map<String, Object>> getDacosNewCarList(NewcarSearchRequest request, UserDto user) {
        validateDacosDealerUser(user);
        clampWaSearchStartDate(request);

        String companyId = Objects.toString(request.getCOMPANY_ID(), "").trim().toUpperCase(Locale.ROOT);
        if (!companyId.isEmpty() && !companyId.startsWith("WA")) {
            throw new BusinessException("WA 기업만 조회할 수 있습니다.");
        }

        request.setCOMPANY_ID(companyId.isEmpty() ? null : companyId);
        request.setBRANCH_ID(null);
        request.setMEMBER_GB("DACOS");
        request.setMEMBER_ID(user.getLOGIN_ID());
        applyListAccessScope(request, user);

        List<Map<String, Object>> rows = newcarMapper.getWaNewCarList(request);
        rows.forEach(this::applyWaAttachStatus);
        return rows;
    }

    /** 목록 조회 권한 범위는 요청값이 아니라 로그인 세션으로만 생성한다. */
    private void applyListAccessScope(NewcarSearchRequest request, UserDto user) {
        ListAccessScope scope = serviceAccessGuard.resolveListAccessScope(user);
        request.setAUTH_SCOPE(scope.scope());
        request.setAUTH_COMPANY_ID(scope.companyId());
        request.setAUTH_BRANCH_ID(scope.branchId());
        request.setAUTH_SANGSA_ID(scope.sangsaId());
        request.setAUTH_MEMBER_ID(scope.memberId());
        request.setAUTH_GOVT_ID(scope.govtId());
        request.setAUTH_COMPANY_IDS(scope.companyIds());
    }

    public List<Map<String, Object>> getDacosWaCompanyOptions(UserDto user) {
        validateDacosDealerUser(user);
        return newcarMapper.getWaCompanyOptions();
    }

    private void validateDacosDealerUser(UserDto user) {
        if (user == null || !"dacos".equalsIgnoreCase(Objects.toString(user.getCOMPANY_ID(), "").trim())) {
            throw new BusinessException("DACOS 딜러시스템 접근 권한이 없습니다.", 403);
        }
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
        // String ratioNo = attachValue(row, "ATTACH_RATIO_NO");

        if (("NORML".equals(taskCd) || ("LEASE".equals(taskCd) && "C".equals(procCd)))
                && "F".equals(regGb)) {
            requiredCodes.add("FOREIGN_ID");
        }

        // 공동명의만으로는 첨부서류를 요구하지 않는다.
        // if (isJointOwnershipRatio(ratioNo)) {
        //     addCodes(requiredCodes, "OWNER_ID", "JOINT_OWNER_ID", "JOINT_OWNER_AGREEMENT");
        // }

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

        // 회사별 차종구분을 세금 및 공채 감면 계산에 사용함.
        carSpec.put("VHCTY_ASORT_CODE", searchConfig.vehicleTypeCode());
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
    private record CarSpecSearchConfig(String maker, String vehicleTypeCode) {
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

    public boolean isPostNumplateCompany(UserDto user) {
        String companyId = requireLoginCompanyId(user);
        String configuredCompanies = Objects.toString(
                commonService.getCodeDetail("DEAL", "NUMPL"), "");

        return Arrays.stream(configuredCompanies.split("\\|"))
                .map(String::trim)
                .anyMatch(companyId::equalsIgnoreCase);
    }

    /** 로그인 회사의 지점에 설정된 ASSIGN_CD만 담당자 정보 조회를 허용한다. */
    public Map<String, Object> getWaNumplateAssignee(String assignCd, UserDto user) {
        String companyId = requireLoginCompanyId(user);
        String normalizedAssignCd = Objects.toString(assignCd, "").trim().toUpperCase(Locale.ROOT);

        if (!normalizedAssignCd.matches("[A-Z0-9]{7}")) {
            throw new BusinessException("번호판 담당자 코드가 올바르지 않습니다.", 400);
        }

        Map<String, Object> branchParam = new HashMap<>();
        branchParam.put("COMPANY_ID", companyId);
        List<Map<String, Object>> branches = newcarMapper.getBranchList(branchParam);
        String memberGb = Objects.toString(user.getMEMBER_GB(), "").trim().toUpperCase(Locale.ROOT);
        String loginBranchId = Objects.toString(user.getBRANCH_ID(), "").trim();

        boolean allowed = branches.stream().anyMatch(branch -> {
            String branchAssignCd = Objects.toString(branch.get("ASSIGN_CD"), "")
                    .trim().toUpperCase(Locale.ROOT);
            String branchId = Objects.toString(branch.get("BRANCH_ID"), "").trim();
            boolean branchInScope = "CA".equals(memberGb) || loginBranchId.equals(branchId);
            return branchInScope && normalizedAssignCd.equals(branchAssignCd);
        });

        if (!allowed) {
            throw new BusinessException("번호판 담당자 조회 권한이 없습니다.", 403);
        }

        Map<String, Object> assignee = newcarMapper.getNumplateAssignee(
                normalizedAssignCd.substring(0, 5),
                normalizedAssignCd.substring(5));

        if (assignee == null || assignee.isEmpty()) {
            throw new BusinessException("번호판 담당자 정보를 찾을 수 없습니다.", 404);
        }
        return assignee;
    }

    public Map<String, Object> checkWaDuplicateCarNo(Map<String, Object> request, UserDto user) {
        String serviceId = requestValue(request, "SERVICE_ID", "신청번호가 없습니다.");
        String requestedCarNo = requestValue(request, "REQ_CAR_NO", "선택한 번호판이 없습니다.");
        requireAccessibleService(user, serviceId);

        Map<String, Object> duplicate = newcarMapper.checkDuplicateCarNo(serviceId, requestedCarNo);
        if (duplicate == null || duplicate.isEmpty()) {
            return null;
        }

        String loginCompanyId = requireLoginCompanyId(user);
        String duplicateCompanyId = Objects.toString(duplicate.get("COMPANY_ID"), "").trim();
        String procSt = Objects.toString(duplicate.get("PROC_ST"), "").trim().toUpperCase(Locale.ROOT);
        boolean sameCompany = "dacos".equalsIgnoreCase(loginCompanyId)
                || loginCompanyId.equalsIgnoreCase(duplicateCompanyId);
        boolean releasable = sameCompany && Set.of("DEL", "RET").contains(procSt);

        Map<String, Object> response = new HashMap<>();
        response.put("PROC_ST", procSt);
        response.put("RELEASABLE", releasable ? "Y" : "N");
        if (sameCompany) {
            response.put("SERVICE_ID", duplicate.get("SERVICE_ID"));
        }
        return response;
    }

    @Transactional
    public int releaseWaRequestedCarNo(Map<String, Object> request, UserDto user) {
        String serviceId = requestValue(request, "SERVICE_ID", "해제할 신청번호가 없습니다.");
        String requestedCarNo = requestValue(request, "REQ_CAR_NO", "해제할 번호판이 없습니다.");
        Map<String, Object> service = serviceAccessGuard.requireAccess(
                user, serviceId, ServiceAction.CHANGE_STATUS);
        String procSt = Objects.toString(service.get("PROC_ST"), "").trim().toUpperCase(Locale.ROOT);

        if (!Set.of("DEL", "RET").contains(procSt)) {
            throw new BusinessException("삭제 또는 반려 신청건의 번호판만 해제할 수 있습니다.", 409);
        }

        Map<String, Object> param = new HashMap<>();
        param.put("SERVICE_ID", serviceId);
        param.put("REQ_CAR_NO", requestedCarNo);
        param.put("COMPANY_ID", Objects.toString(service.get("COMPANY_ID"), "").trim());
        param.put("UPD_USER", user.getLOGIN_ID());

        int updatedCount = newcarMapper.releaseRequestedCarNo(param);
        if (updatedCount != 1) {
            throw new BusinessException("번호판 정보가 변경되어 해제하지 못했습니다. 다시 조회해 주세요.", 409);
        }
        return updatedCount;
    }

    private Map<String, Object> requireAccessibleService(UserDto user, String serviceId) {
        return serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.READ_DETAIL);
    }

    private String requireLoginCompanyId(UserDto user) {
        String companyId = user == null ? "" : Objects.toString(user.getCOMPANY_ID(), "").trim();
        if (companyId.isEmpty()) {
            throw new BusinessException("로그인 회사 정보가 없습니다.", 401);
        }
        return companyId;
    }

    private String requestValue(Map<String, Object> request, String key, String message) {
        String value = request == null ? "" : Objects.toString(request.get(key), "").trim();
        if (value.isEmpty()) {
            throw new BusinessException(message, 400);
        }
        return value;
    }

    private void requireAllServiceAccess(
            List<Map<String, Object>> rows,
            UserDto user,
            ServiceAction action) {
        if (rows == null || rows.isEmpty()) {
            throw new BusinessException("처리할 신청건이 없습니다.", 400);
        }
        for (Map<String, Object> row : rows) {
            String serviceId = requestValue(row, "SERVICE_ID", "신청번호가 없습니다.");
            serviceAccessGuard.requireAccess(user, serviceId, action);
        }
    }

    public Map<String, Object> getNewCarDetail(UserDto user, String serviceId) {

        logger.info("[NewcarService] 신차 상세 조회 - serviceId: {}", serviceId);

        Map<String, Object> result = new HashMap<>();

        Map<String, Object> service = serviceAccessGuard.requireAccess(
                user, serviceId, ServiceAction.READ_DETAIL);

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
    @Transactional
    public int changeProcSt(List<String> serviceIds, String procSt, UserDto user) {
        List<String> distinctIds = serviceIds.stream().distinct().toList();
        for (String serviceId : distinctIds) {
            serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.CHANGE_STATUS);
        }
        return newcarMapper.updateProcSt(distinctIds, procSt);
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
				row.put("REGIST_DATE", getDateCellValue(excelRow.getCell(7), formatter)); // H: 차량등록예정일
				row.put("DIRECT_YN", getCellValue(excelRow.getCell(8), formatter)); // I: 차량 등록 방법
				row.put("SPACE_GB", getCellValue(excelRow.getCell(9), formatter)); // J: SPACE 명
				row.put("SPACE_NM", getCellValue(excelRow.getCell(10), formatter)); // K: 담당 Specialist
				row.put("OWNER_NM", getCellValue(excelRow.getCell(11), formatter)); // L: 계약자(고객명)
				
				// N: 차량 세금 계산서 금액
				// 쉼표(,) 제거 후 공백 제거, 비어있거나 -이면 0으로 처리
				// 숫자만 남기고, 숫자가 없는 경우 0으로 처리
				String originalBuyAmt = formatter.formatCellValue(excelRow.getCell(13), evaluator);

				String buyAmt = originalBuyAmt.replaceAll("[^0-9]", "");

				String finalBuyAmt = buyAmt.isEmpty() ? "0" : buyAmt;

				row.put("BUY_AMT", finalBuyAmt);

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
		row.put("LOW_POLLUTION_YN", carSpec.get("LOW_POLLUTION_YN"));
		row.put("FUEL_CD", carSpec.get("FUEL_CD"));
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
				    errors.add("차량 제원 처리 중 오류가 발생하였습니다.");
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

	/** 엑셀 행을 신청 건과 매칭만 한다. 계산이 끝나기 전에는 DB를 수정하지 않는다. */
	@Transactional(readOnly = true)
	public Map<String, Object> previewSupplyAmounts(MultipartFile file, UserDto user) {
		validateSupplyAmountAccess(user);

		List<Map<String, Object>> rows = parseSupplyAmountExcel(file);
		if (rows.isEmpty()) {
			throw new BusinessException("수정할 데이터가 없습니다.", 400);
		}

		Set<String> excelKeys = new HashSet<>();
		Map<String, String> dlvMap = new HashMap<>();
		for (Map<String, Object> code : codeMapper.findCodesByGroupId("DLVGB")) {
			dlvMap.put(Objects.toString(code.get("CODE_NM"), "").trim(), Objects.toString(code.get("CODE_ID"), ""));
		}
		List<Map<String, Object>> results = new ArrayList<>();
		int matchedCount = 0;

		for (Map<String, Object> row : rows) {
			String linkId = Objects.toString(row.get("LINK_ID"), "").trim();
			String carIdNo = Objects.toString(row.get("CARID_NO"), "").trim().toUpperCase(Locale.ROOT);
			Long buyAmt = parseSupplyAmountValue(row.get("BUY_AMT_TEXT"));
			List<String> errors = new ArrayList<>();

			boolean validLinkId = linkId.length() == 8;if (!validLinkId) errors.add("주문번호가 없습니다.");
			if (buyAmt == null) errors.add("공급가액이 0원입니다.");
			try {
				validateSupplyAmountRegistDate(row.get("REGIST_DATE"));
			} catch (BusinessException e) {
				errors.add(e.getMessage());
			}
			try {
				resolveSupplyAmountSpecialist(row.get("SPACE_GB"), row.get("SPACE_NM"), user, dlvMap);
			} catch (BusinessException e) {
				errors.add(e.getMessage());
			}
			if (!linkId.isEmpty() && !carIdNo.isEmpty()
					&& !excelKeys.add(linkId + "\u0000" + carIdNo)) {
				errors.add("엑셀 내 중복된 주문번호와 차대번호");
			}

			Object serviceId = null;
			Long beforeBuyAmt = null;
			Map<String, Object> before = new LinkedHashMap<>();
			if (validLinkId) {
				List<Map<String, Object>> targets = selectSupplyAmountTargets(user, linkId);
				if (targets.isEmpty()) {
					errors.add("해당하는 주문번호가 없습니다.");
				} else {
					if (targets.size() > 1) errors.add("일치하는 신청 건이 여러 건입니다.");
					else {
						beforeBuyAmt = parseNonNegativeAmount(targets.get(0).get("BUY_AMT"));
						Map<String, Object> target = targets.get(0);
						
						String existingCarIdNo = Objects.toString(target.get("CARID_NO"), "").trim().toUpperCase(Locale.ROOT);

						if (carIdNo.length() != 17) {
						    errors.add("차대번호 확인 필요");
						} else if (!carIdNo.equals(existingCarIdNo)
						        && isDuplicateCar2(Map.of("CARID_NO", carIdNo))) {
						    errors.add("이미 등록된 차대번호");
						}
						
						before.put("carIdNo", target.get("CARID_NO"));
						before.put("model", target.get("CAR_NM"));
						before.put("modelYear", target.get("MADE_YY"));
						before.put("engine", target.get("CAR_NM"));
						before.put("carPackage", target.get("CAR_PACKAGE"));
						before.put("registDate", target.get("REGIST_DATE"));
						before.put("directYn", displayDirectYn(target.get("DIRECT_YN")));
						before.put("spaceGb", target.get("SPACE_GB"));
						before.put("spaceNm", target.get("SPACE_NM"));
						before.put("ownerNm", target.get("OWNER_NM"));
						before.put("buyAmt", beforeBuyAmt);
						if (!Set.of("C_REQ", "SAV", "W_REQ").contains(Objects.toString(target.get("PROC_ST"), ""))) {
						    errors.add("요청, 저장, 신청대기 상태에서만 데이터 수정이 가능합니다.");
						} else {
						    serviceId = target.get("SERVICE_ID");
						}
					}
				}
			}

			boolean matched = errors.isEmpty();
			if (matched) matchedCount++;
			Map<String, Object> result = new HashMap<>();
			result.put("row", row.get("ROW_NO"));
			result.put("linkId", linkId);
			result.put("carIdNo", carIdNo);
			result.put("beforeBuyAmt", beforeBuyAmt);
			result.put("buyAmt", buyAmt);
			Map<String, Object> after = new LinkedHashMap<>();
			after.put("carIdNo", carIdNo);
			after.put("model", row.get("MODEL"));
			after.put("modelYear", row.get("MODEL_YEAR"));
			after.put("engine", row.get("ENGINE"));
			after.put("carPackage", row.get("CAR_PACKAGE"));
			after.put("registDate", row.get("REGIST_DATE"));
			after.put("directYn", row.get("DIRECT_YN"));
			after.put("spaceGb", row.get("SPACE_GB"));
			after.put("spaceNm", row.get("SPACE_NM"));
			after.put("ownerNm", row.get("OWNER_NM"));
			after.put("buyAmt", buyAmt);
			List<String> changedFields = matched ? resolveSupplyAmountChangedFields(before, after) : List.of();
			result.put("before", before);
			result.put("after", after);
			result.put("changedFields", changedFields);
			result.put("changed", !changedFields.isEmpty());
			result.put("serviceId", serviceId);
			result.put("success", matched);
			result.put("reason", String.join(", ", errors));
			results.add(result);
		}

		return Map.of(
				"success", matchedCount == rows.size(),
				"totalCount", rows.size(),
				"matchedCount", matchedCount,
				"failureCount", rows.size() - matchedCount,
				"results", results);
	}

	/** 모든 행의 계산 결과를 다시 검증한 뒤 한 트랜잭션으로 반영한다. */
	@Transactional
	public Map<String, Object> applySupplyAmountCalculations(
			List<Map<String, Object>> rows, UserDto user) {
		validateSupplyAmountAccess(user);
		return saveSupplyAmountCalculations(rows, user, true);
	}

	/** 검증된 계산 결과를 저장한다. 호출한 트랜잭션 안에서 실행된다. */
	private Map<String, Object> saveSupplyAmountCalculations(
			List<Map<String, Object>> rows, UserDto user, boolean dataModification) {
		if (rows == null || rows.isEmpty()) {
			throw new BusinessException("반영할 계산 결과가 없습니다.", 400);
		}
		
		List<Map<String, Object>> dlvCodes = codeMapper.findCodesByGroupId("DLVGB");
		Map<String, String> dlvMap = new HashMap<>();
		if (dataModification) {
			for (Map<String, Object> code : dlvCodes) {
				dlvMap.put(Objects.toString(code.get("CODE_NM"), "").trim(), Objects.toString(code.get("CODE_ID"), ""));
			}
		}
		
		Set<String> serviceIds = new HashSet<>();
		List<Map<String, Object>> updates = new ArrayList<>();
		
		Set<String> allowedProcStates = dataModification ? Set.of("C_REQ", "SAV", "W_REQ") : Set.of("W_REQ");
		
		// 신뢰 경계인 요청값을 전부 확인한 뒤에만 UPDATE를 시작한다.
		for (Map<String, Object> row : rows) {
			String serviceId = Objects.toString(row.get("serviceId"), "").trim();
			String linkId = Objects.toString(row.get("linkId"), "").trim();
			String carIdNo = Objects.toString(row.get("carIdNo"), "").trim().toUpperCase(Locale.ROOT);
			Long buyAmt = parseSupplyAmountValue(row.get("buyAmt"));
			Long standardAmt = parseNonNegativeAmount(row.get("standardAmt"));
			Long preregAmt = parseNonNegativeAmount(row.get("preregAmt"));
			Long totalAmt = parseNonNegativeAmount(row.get("totalAmt"));
			Long bondAmt = parseNonNegativeAmount(row.get("bondAmt"));

			if (serviceId.isEmpty() || linkId.length() != 8 || carIdNo.length() != 17
					|| buyAmt == null || standardAmt == null || preregAmt == null
					|| totalAmt == null || bondAmt == null || !serviceIds.add(serviceId)) {
				throw new BusinessException("[" + linkId + "] 공급가액 계산 결과를 확인해 주세요.", 400);
			}
			
			List<Map<String, Object>> targets = selectSupplyAmountTargets(user, linkId);
			if (targets.size() != 1 || !serviceId.equals(Objects.toString(targets.get(0).get("SERVICE_ID"), ""))
			        || !allowedProcStates.contains(Objects.toString(targets.get(0).get("PROC_ST"), ""))) {
			    throw new BusinessException("[" + linkId + "] 신청 대상 상태가 변경되었습니다. 목록을 다시 조회해 주세요.", 409);
			}
			
			Map<String, Object> update = new HashMap<>();
			update.put("SERVICE_ID", serviceId);
			
			if (dataModification) {
				update.put("LINK_ID", linkId);
				// 담당자가 수정되지 않았을 때 사용할 기존 담당자
				update.put("MEMBER_ID", Objects.toString(targets.get(0).get("MEMBER_ID"), ""));
				
				update.put("EXCEL_BEFORE", row.get("before"));
				update.put("EXCEL_AFTER", row.get("after"));
				update.put("EXCEL_CHANGED_FIELDS", row.get("changedFields"));
				try {
					applyExcelChangesToNewCar(update, user, dlvMap);
				} catch (BusinessException e) {
					throw new BusinessException("[" + linkId + "] " + e.getMessage(), e.getStatusCode());
				}
			}
			
			Object paymentValue = row.get("payments");
			if (!(paymentValue instanceof List<?> paymentRows)) {
				throw new BusinessException("[" + linkId + "] 결제항목 계산 결과를 확인해 주세요.", 400);
			}
			Map<String, Map<String, Object>> payments = new HashMap<>();
			for (Object paymentValueRow : paymentRows) {
				if (!(paymentValueRow instanceof Map<?, ?> paymentRow)) continue;
				String payKd = Objects.toString(paymentRow.get("payKd"), "").trim().toUpperCase(Locale.ROOT);
				Long prePayAmt = parseNonNegativeAmount(paymentRow.get("prePayAmt"));
				Long payAmt = parseNonNegativeAmount(paymentRow.get("payAmt"));
				Long realAloan = parseNonNegativeAmount(paymentRow.get("realAloan"));
				if (!SUPPLY_AMOUNT_PAY_KINDS.contains(payKd) || prePayAmt == null || payAmt == null
						|| ("BOND".equals(payKd) && realAloan == null) || payments.containsKey(payKd)) {
					throw new BusinessException("[" + linkId + "] 결제항목 계산 결과를 확인해 주세요.", 400);
				}
				Map<String, Object> payment = new HashMap<>();
				payment.put("SERVICE_ID", serviceId);
				payment.put("PAY_KD", payKd);
				payment.put("PRE_PAY_AMT", prePayAmt);
				payment.put("PAY_AMT", payAmt);
				payment.put("REAL_ALOAN", realAloan == null ? 0L : realAloan);
				payments.put(payKd, payment);
			}
			if (!payments.keySet().equals(SUPPLY_AMOUNT_PAY_KINDS)) {
				throw new BusinessException("[" + linkId + "] 결제항목 계산 결과가 누락되었습니다.", 400);
			}

			if (dataModification) {
			    update.put("PROC_ST", "SAV");
			}
			update.put("BUY_AMT", buyAmt);
			update.put("STANDARD_AMT", standardAmt);
			update.put("PREREG_AMT", preregAmt);
			update.put("TOTAL_AMT", totalAmt);
			update.put("BOND_AMT", bondAmt);
			update.put("NTAX_APPLC_CD", Objects.toString(row.get("ntaxApplyCode"), ""));
			update.put("UPD_USER", user.getLOGIN_ID());
			update.put("PAYMENTS", new ArrayList<>(payments.values()));
			// 기존 메모는 mapper에서 보존하고 전체 수정 성공 시 계산 이력을 한 줄 추가한다.
			Long oldBuyAmt = parseNonNegativeAmount(targets.get(0).get("BUY_AMT"));
			update.put("AMOUNT_MEMO_TX", String.format(Locale.KOREA,
					" / 공급가액 : %,d원 → %,d원 / 총금액 : %,d원 (취득세 %,d원 / 채권 %,d원 / 등록면허세 %,d원)",
					oldBuyAmt == null ? 0L : oldBuyAmt, buyAmt, totalAmt,
					payments.get("ACQ").get("PAY_AMT"), payments.get("BOND").get("PAY_AMT"),
					payments.get("UREG").get("PAY_AMT")));
			updates.add(update);
		}

		for (Map<String, Object> update : updates) {
			// 금액 저장은 두 경로에서 모두 실행
			if (common.update(update, "updateTrNewCar") != 1) {
				throw new BusinessException("[" + update.get("LINK_ID") + "] 데이터 수정 중 오류가 발생했습니다.", 500);
			}
			// 상태·담당자·배송지등 반영은 데이터 수정일 때만 실행
			if (dataModification) {
				if (common.update(update, "updateTrService") != 1) {
					throw new BusinessException("[" + update.get("LINK_ID") + "] 데이터 수정 중 오류가 발생했습니다.", 500);
				}
				if (common.update(update, "updateTrCarNoDetach") != 1) {
					throw new BusinessException("[" + update.get("LINK_ID") + "] 데이터 수정 중 오류가 발생했습니다.", 500);
				}
			}
			@SuppressWarnings("unchecked")
			List<Map<String, Object>> payments = (List<Map<String, Object>>) update.get("PAYMENTS");
			for (Map<String, Object> payment : payments) {
				if (common.update(payment, "updateSupplyAmountPayment") != 1) {
					throw new BusinessException("[" + update.get("LINK_ID") + "] 결제항목 반영 중 오류가 발생했습니다.", 500);
				}
			}
			
			// 변경 이력과 로우데이터 변경 문자는 데이터 수정일 때만 실행
		    if (dataModification) {
		    	recordChangeHistory(update, user);
		    	
		    	// 담당 sp 문자발송
		    	String memberId = Objects.toString(update.get("MEMBER_ID"), "").trim();
		    	
		    	SchedulerDto specialistInfo = schedulerMapper.selectNewcarSpecialistInfo(memberId);
		    	String specialistPhone = specialistInfo == null ? "" : specialistInfo.getSPECIALIST_HP_NO();
		    	String smsText = "주문번호 " + Objects.toString(update.get("LINK_ID"), "").trim() + " 의 로우데이터가 변경되었습니다. 변경 내용 확인 후 재요청 부탁드립니다.";
		    	
		    	Map<String, Object> smsParam = new HashMap<>();
		    	smsParam.put("PAY_HP_NO", specialistPhone);
		    	smsParam.put("TEXT", smsText);
		    	smsParam.put("MSG_TYPE", "3");
		    	smsParam.put("SUBJECT", "로우데이터 변경");
		    	commonService.sendSms(smsParam);
		    }
		}
		
		return Map.of("success", true, "updatedCount", updates.size());
	}

	/** 엑셀 비교 화면에서 변경된, TR_NEWCAR에 실제 존재하는 항목만 허용 목록으로 반영한다. */
	private void applyExcelChangesToNewCar(Map<String, Object> update, UserDto user, Map<String, String> dlvMap) {
		if (!(update.get("EXCEL_AFTER") instanceof Map<?, ?> after)
				|| !(update.get("EXCEL_CHANGED_FIELDS") instanceof List<?> fields)) return;
		Set<String> changedFields = fields.stream()
				.map(field -> Objects.toString(field, ""))
				.collect(Collectors.toSet());
		
		if (changedFields.contains("carIdNo")) {
			String carIdNo = Objects.toString(after.get("carIdNo"), "").trim();
			if (carIdNo.length() != 17) throw new BusinessException("차대번호를 확인해 주세요.", 400);
			
			// 차대번호 DB중복 확인
	        if (isDuplicateCar2(Map.of("CARID_NO", carIdNo))) {
	            throw new BusinessException("이미 등록된 차대번호", 400);
	        }
	        
			update.put("CARID_NO", carIdNo);
		}
		
		if (changedFields.contains("model") || changedFields.contains("engine")) {
			String carName = (Objects.toString(after.get("model"), "").trim() + " "
					+ Objects.toString(after.get("engine"), "").trim()).trim();
			if (carName.isEmpty()) throw new BusinessException("모델 또는 엔진 정보를 확인해 주세요.", 400);
			update.put("CAR_NM", carName);
		}
		
		if (changedFields.contains("carPackage")) update.put("CAR_PACKAGE", Objects.toString(after.get("carPackage"), "").trim());

		if (changedFields.contains("model") || changedFields.contains("engine") || changedFields.contains("carPackage")) {
			update.put("ECO_YN", resolveExcelEcoYn(Objects.toString(after.get("model"), "").trim(), Objects.toString(after.get("carPackage"), "").trim(), Objects.toString(after.get("engine"), "").trim()));
		}
		
		String registDate = validateSupplyAmountRegistDate(after.get("registDate"));
		if (changedFields.contains("registDate")) {
			update.put("REGIST_DATE", registDate);
		}
		
		
		if (changedFields.contains("directYn")) {
			String directValue = Objects.toString(after.get("directYn"), "").trim();
			if (!List.of("Y", "N", "자가등록", "Agency").contains(directValue)) {
				throw new BusinessException("차량 등록 방법 정보를 확인해 주세요.", 400);
			}
			update.put("DIRECT_YN", "Y".equalsIgnoreCase(directValue) || "자가등록".equals(directValue) ? "Y" : "N");
		}
		
		if (changedFields.contains("ownerNm")) update.put("CUSTOMER_NM", Objects.toString(after.get("ownerNm"), "").trim());
		
		Map<String, Object> memberInfo = resolveSupplyAmountSpecialist(after.get("spaceGb"), after.get("spaceNm"), user, dlvMap);
		if (changedFields.contains("spaceGb")) {
			update.put("DELIVERY_GB", dlvMap.get(Objects.toString(after.get("spaceGb"), "").trim()));
		}
		if (changedFields.contains("spaceGb") || changedFields.contains("spaceNm")) {
			update.put("MEMBER_ID", memberInfo.get("LOGIN_ID"));
			update.put("BRANCH_ID", memberInfo.get("BRANCH_ID"));
		}
	}

	/** 등록일은 실제 존재하는 날짜이며 한국 시간 기준 오늘 또는 이후여야 한다. */
	private String validateSupplyAmountRegistDate(Object value) {
		String registDate = Objects.toString(value, "").trim();
		if (registDate.isEmpty()) throw new BusinessException("차량 등록일 없음", 400);
		if (!registDate.matches("\\d{8}|\\d{4}([-./])\\d{2}\\1\\d{2}")) {
			throw new BusinessException("차량 등록일 형식 오류", 400);
		}
		String normalized = registDate.replaceAll("[-./]", "");
		LocalDate date;
		try {
			date = LocalDate.parse(normalized, DateTimeFormatter.BASIC_ISO_DATE);
		} catch (DateTimeParseException e) {
			throw new BusinessException("차량 등록일 형식 오류", 400);
		}
		if (date.isBefore(LocalDate.now(SEARCH_ZONE))) {
			throw new BusinessException("차량 등록일은 오늘 또는 이후 날짜만 가능합니다.", 400);
		}
		return normalized;
	}

	/** 비교 화면과 저장 시 동일한 기준으로 Space와 담당 Specialist를 확인한다. */
	private Map<String, Object> resolveSupplyAmountSpecialist(Object spaceValue, Object specialistValue,
			UserDto user, Map<String, String> dlvMap) {
		String spaceGb = Objects.toString(spaceValue, "").trim();
		String spaceNm = Objects.toString(specialistValue, "").trim();
		List<String> errors = new ArrayList<>();
		if (spaceGb.isEmpty()) {
			errors.add("Space 없음");
		} else if (!dlvMap.containsKey(spaceGb)) {
			errors.add("존재하지 않는 Space : " + spaceGb);
		}
		if (spaceNm.isEmpty()) errors.add("담당 Specialist 없음");
		if (!errors.isEmpty()) throw new BusinessException(String.join(", ", errors));

		Map<String, Object> memberInfo = authMapper.selectMemberSuInfo(
				Objects.toString(user.getCOMPANY_ID(), ""), spaceGb, spaceNm);
		if (memberInfo == null) throw new BusinessException("Space 명과 담당 Specialist 정보 매칭 불가");
		return memberInfo;
	}

	/** 변경된 로우데이터 이력 저장 */
	private void recordChangeHistory(Map<String, Object> update, UserDto user) {
		List<Map<String, Object>> items = new ArrayList<>();
		// 이력에는 엑셀 원본에서 변경된 항목만 기록한다.
		addExcelChangeHistoryItems(items, update);
		if (items.isEmpty()) return;

		Map<String, Object> sequenceParam = Map.of(
				"SERVICE_ID", update.get("SERVICE_ID"), "LINK_ID", update.get("LINK_ID"));
		Map<String, Object> sequenceResult = common.select(sequenceParam, "selectNextDataChangeSequence");
		int sequence = ((Number) sequenceResult.get("NEXT_SEQ")).intValue();
		Map<String, Object> header = new HashMap<>(sequenceParam);
		header.put("SEQ", sequence);
		header.put("INS_USER", user.getLOGIN_ID());
		common.insert(header, "insertDataChangeHistory");

		for (int index = 0; index < items.size(); index++) {
			Map<String, Object> detail = new HashMap<>(header);
			detail.putAll(items.get(index));
			detail.put("CHANGE_ITEM_SEQ", index + 1);
			common.insert(detail, "insertDataChangeHistoryDetail");
		}
	}

	private void addChangeHistoryItem(List<Map<String, Object>> items, String columnId, String columnName,
			Object before, Object after) {
		String beforeValue = Objects.toString(before, "0");
		String afterValue = Objects.toString(after, "0");
		if (beforeValue.equals(afterValue)) return;
		Map<String, Object> item = new HashMap<>();
		item.put("COLUMN_ID", columnId);
		item.put("COLUMN_NM", columnName);
		item.put("BEFORE_DATA", beforeValue);
		item.put("AFTER_DATA", afterValue);
		items.add(item);
	}

	@SuppressWarnings("unchecked")
	private void addExcelChangeHistoryItems(List<Map<String, Object>> items, Map<String, Object> update) {
		if (!(update.get("EXCEL_BEFORE") instanceof Map<?, ?> before)
				|| !(update.get("EXCEL_AFTER") instanceof Map<?, ?> after)
				|| !(update.get("EXCEL_CHANGED_FIELDS") instanceof List<?> fields)) return;
		Map<String, String[]> metadata = Map.ofEntries(
				Map.entry("carIdNo", new String[] { "CARID_NO", "차대번호" }),
				Map.entry("modelYear", new String[] { "MADE_YY", "연식" }),
				Map.entry("carPackage", new String[] { "CAR_PACKAGE", "패키지" }),
				Map.entry("registDate", new String[] { "REGIST_DATE", "차량 등록일" }),
				Map.entry("directYn", new String[] { "DIRECT_YN", "차량 등록 방법" }),
				Map.entry("spaceGb", new String[] { "SPACE_GB", "스페이스" }),
				Map.entry("spaceNm", new String[] { "SPACE_NM", "담당 Specialist" }),
				Map.entry("ownerNm", new String[] { "OWNER_NM", "계약자" }),
				Map.entry("buyAmt", new String[] { "BUY_AMT", "공급가액" }));
		boolean carNameChanged = fields.stream()
				.map(field -> Objects.toString(field, ""))
				.anyMatch(field -> "model".equals(field) || "engine".equals(field));
		if (carNameChanged) {
			String beforeCarName = Objects.toString(before.get("model"), "").trim();
			String afterCarName = (Objects.toString(after.get("model"), "").trim() + " "
					+ Objects.toString(after.get("engine"), "").trim()).trim();
			addChangeHistoryItem(items, "CAR_NM", "차량명(모델+엔진)", beforeCarName, afterCarName);
		}
		for (Object field : fields) {
			String key = Objects.toString(field, "");
			if ("model".equals(key) || "engine".equals(key)) continue;
			String[] info = metadata.get(key);
			if (info != null) addChangeHistoryItem(items, info[0], info[1], before.get(key), after.get(key));
		}
	}


	/** 엑셀의 등록방법 표기와 DB의 Y/N 값을 동일한 화면 값으로 맞춘다. */
	private static String displayDirectYn(Object value) {
		String directYn = Objects.toString(value, "").trim();
		return "Y".equalsIgnoreCase(directYn) || "자가등록".equals(directYn) ? "자가등록" : "Agency";
	}

	private static boolean sameSupplyValue(Object before, Object after) {
		String beforeValue = Objects.toString(before, "").trim().replaceAll("[-./]", "");
		String afterValue = Objects.toString(after, "").trim().replaceAll("[-./]", "");
		return beforeValue.equalsIgnoreCase(afterValue);
	}

	private static List<String> resolveSupplyAmountChangedFields(
			Map<String, Object> before, Map<String, Object> after) {
		List<String> changed = new ArrayList<>();
		String uploadedCarName = (Objects.toString(after.get("model"), "") + " "
				+ Objects.toString(after.get("engine"), "")).trim();
		if (!sameSupplyValue(before.get("model"), uploadedCarName)) {
			changed.add("model");
			changed.add("engine");
		}
		for (String field : List.of("carIdNo", "carPackage", "registDate", "directYn", "spaceGb", "spaceNm", "ownerNm", "buyAmt")) {
			if (!sameSupplyValue(before.get(field), after.get(field))) changed.add(field);
		}
		return changed;
	}

	private List<Map<String, Object>> parseSupplyAmountExcel(MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new BusinessException("업로드할 엑셀 파일을 선택해 주세요.", 400);
		}

		List<Map<String, Object>> rows = new ArrayList<>();
		try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
			Sheet sheet = workbook.getSheetAt(0);
			Row header = sheet.getRow(0);
			DataFormatter formatter = new DataFormatter();
			var evaluator = workbook.getCreationHelper().createFormulaEvaluator();
			int linkColumn = findHeaderIndex(header, formatter, "주문 번호", "주문번호");
			int carIdColumn = findHeaderIndex(header, formatter, "VIN", "차대번호");
			int amountColumn = findHeaderIndex(header, formatter, "차량 세금 계산서 금액(공급가액)", "공급가액");

			if (linkColumn < 0 || carIdColumn < 0 || amountColumn < 0 || sheet.getLastRowNum() < 1) {
				throw new BusinessException("공급가액 수정 양식의 항목을 확인해 주세요.", 400);
			}

			for (int i = 1; i <= sheet.getLastRowNum(); i++) {
				Row excelRow = sheet.getRow(i);
				if (excelRow == null) {
					continue;
				}

				String linkId = formatter.formatCellValue(excelRow.getCell(linkColumn), evaluator).trim();
				String carIdNo = formatter.formatCellValue(excelRow.getCell(carIdColumn), evaluator).trim();
				String buyAmt = formatter.formatCellValue(excelRow.getCell(amountColumn), evaluator).trim();

				if (linkId.isEmpty() && carIdNo.isEmpty() && buyAmt.isEmpty()) {
					continue;
				}

				Map<String, Object> row = new HashMap<>();
				row.put("ROW_NO", i + 1);
				row.put("LINK_ID", linkId);
				row.put("CARID_NO", carIdNo);
				row.put("BUY_AMT_TEXT", buyAmt);
				row.put("MODEL", getCellValue(excelRow.getCell(2), formatter));
				row.put("MODEL_YEAR", getCellValue(excelRow.getCell(3), formatter));
				row.put("ENGINE", getCellValue(excelRow.getCell(4), formatter));
				row.put("CAR_PACKAGE", getCellValue(excelRow.getCell(5), formatter));
				Cell registDateCell = excelRow.getCell(7);
				row.put("REGIST_DATE", registDateCell != null && registDateCell.getCellType() == CellType.NUMERIC
						&& DateUtil.isCellDateFormatted(registDateCell)
						? getDateCellValue(registDateCell, formatter) : getCellValue(registDateCell, formatter));
				row.put("DIRECT_YN", displayDirectYn(getCellValue(excelRow.getCell(8), formatter)));
				row.put("SPACE_GB", getCellValue(excelRow.getCell(9), formatter));
				row.put("SPACE_NM", getCellValue(excelRow.getCell(10), formatter));
				row.put("OWNER_NM", getCellValue(excelRow.getCell(11), formatter));
				rows.add(row);
			}
		} catch (BusinessException e) {
			throw e;
		} catch (Exception e) {
			throw new BusinessException("엑셀 파일을 읽을 수 없습니다.", 400);
		}
		return rows;
	}

	private static Long parseSupplyAmountValue(Object value) {
		Long amount = parseNonNegativeAmount(value);
		return amount != null && amount > 0 ? amount : null;
	}

	private static Long parseNonNegativeAmount(Object value) {
		String normalized = Objects.toString(value, "").replace(",", "").replaceAll("\\s+", "");
		if (!normalized.matches("\\d+")) {
			return null;
		}
		try {
			long amount = Long.parseLong(normalized);
			return amount >= 0 ? amount : null;
		} catch (NumberFormatException e) {
			return null;
		}
	}

	private void validateSupplyAmountAccess(UserDto user) {
		if (user == null || !"CA".equalsIgnoreCase(user.getMEMBER_GB())) {
			throw new BusinessException("공급가액 수정 권한이 없습니다.", 403);
		}
	}

	/** 로그인 회사에 속한 접수건의 변경 이력만 조회한다. */
	@Transactional(readOnly = true)
	public List<Map<String, Object>> getDataChangeHistory(String serviceId, UserDto user) {
		if (user == null || serviceId == null || serviceId.isBlank()) {
			throw new BusinessException("수정 이력 조회 대상이 없습니다.", 400);
		}
		serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.READ_DETAIL);
		return common.selectList(Map.of(
				"SERVICE_ID", serviceId.trim(),
				"COMPANY_ID", Objects.toString(user.getCOMPANY_ID(), "")),
				"selectDataChangeHistory");
	}

	private List<Map<String, Object>> selectSupplyAmountTargets(UserDto user, String linkId) {
		return common.selectList(Map.of(
				"LINK_ID", linkId,
				"COMPANY_ID", Objects.toString(user.getCOMPANY_ID(), "")),
				"selectSupplyAmountTarget");
	}
	
	/**
	 * 엑셀 업로드 양식 다운로드
	 */
	public void downloadExcelTemplate(
	        String fileName,
	        HttpServletResponse response) throws Exception {

	    String cleanFileName = Objects.toString(fileName, "").trim();
	    if (cleanFileName.isEmpty()
	            || !cleanFileName.equals(new File(cleanFileName).getName())
	            || !cleanFileName.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
	        throw new BusinessException("엑셀 업로드 양식 파일명이 올바르지 않습니다.", 400);
	    }

	    File formRoot = new File(attachService.getFormRoot()).getCanonicalFile();
	    File file = new File(formRoot, cleanFileName).getCanonicalFile();

	    if (!file.toPath().startsWith(formRoot.toPath()) || !file.isFile()) {
	        throw new FileNotFoundException("엑셀 업로드 양식 파일이 없습니다.");
	    }

	    String encodedFileName = URLEncoder.encode(cleanFileName, "UTF-8")
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
	    dsNewCar.put("CARID_NO", row.get("CARID_NO"));								// 차대번호	    
	    dsNewCar.put("CAR_NM", row.get("CAR_NM"));										 // 차량명
	    dsNewCar.put("CAR_PACKAGE", row.get("CAR_PACKAGE"));					// 차량패키지
	    dsNewCar.put("ECO_YN", row.get("ECO_YN"));								// 친환경차 여부
	    dsNewCar.put("VH_TY_CD", row.get("VH_TY_CD"));							// 차량유형코드
	    dsNewCar.put("LOW_POLLUTION_YN", row.get("LOW_POLLUTION_YN"));			// 저공해차 여부
	    dsNewCar.put("BUY_AMT", row.get("BUY_AMT"));							// 공급가액
	    dsNewCar.put("REGIST_DATE", row.get("REGIST_DATE")); 							 // 등록일자
	    dsNewCar.put("STAMP_GB", "TOTAL"); 			  	 	 					    	 // 인지세
		dsNewCar.put("FUEL_CD", row.get("FUEL_CD")); 						   			 // 연료코드
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
	    Map<String, Object> response = processNewCar(request, user);

	    Map<String, Object> data = (Map<String, Object>) response.get("data");

	    if (data != null && !Objects.equals("0", Objects.toString(data.get("RESULT_CD"), ""))) {
	        throw new RuntimeException(
	            Objects.toString(data.get("MESSAGE"), "처리 중 오류가 발생하였습니다.")
	        );
	    }
	}

	@Transactional
	public int paymentProcess(List<Map<String, Object>> request, UserDto user) {
		requireAllServiceAccess(request, user, ServiceAction.CHANGE_STATUS);
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
		    String serviceId = Objects.toString(input.get("SERVICE_ID"), "").trim();
		    if (!serviceId.isEmpty()) {
		        serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.UPDATE_SERVICE);
		    }
		    
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
		
		    TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
		
		    result.put("RESULT_CD", "-2");
		    result.put("MESSAGE", "처리 중 오류가 발생하였습니다");
		
		} catch (Exception e) {
		
		    logger.error("신규등록 처리 중 시스템 오류", e);
		
		    TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
		
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
	public void requestProcessWithCalculation(List<Map<String, Object>> request, UserDto user) {
		requireAllServiceAccess(request, user, ServiceAction.CHANGE_STATUS);
		saveSupplyAmountCalculations(request, user, false);
		requestProcess(request, user);
	}

	@Transactional
	public void requestProcess(List<Map<String, Object>> request, UserDto user) {
		requireAllServiceAccess(request, user, ServiceAction.CHANGE_STATUS);
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
			    
			    // 대상 업체 및 발송 기간 확인은 기존 서비스에서 처리
			    numplateService.processNumplateSelectSms(mService, mNewCar, lOwnerInfoList);
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
		
		// 공동소유자 정보
	    String debtorNo = Objects.toString(target.get("DEBTOR_NO"), "").trim();
	    String debtorBiz = Objects.toString(target.get("DEBTOR_BIZ"), "").trim();
	    String debtorNm = Objects.toString(target.get("DEBTOR_NM"), "").trim();
		
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
		
		// 대표소유자 보험접수
		Map<String, Object> insurance = createInsurance(
				newcarServiceId, companyId, memberId, 
				carNo, buyNm, regNo, bizNo);

		newcarMapper.insertNewcarInsurance(insurance);

		boolean result = sendNewcarInsurance(insurance);
		
		// 공동소유자 보험접수
		if (!debtorNo.isBlank()) {

		    Map<String, Object> debtorInsurance = createInsurance(
		        newcarServiceId,
		        companyId,
		        memberId,
		        carNo,
		        debtorNm,
		        debtorNo,
		        debtorBiz
		    );

		    newcarMapper.insertNewcarInsurance(debtorInsurance);

		    boolean debtorResult = sendNewcarInsurance(debtorInsurance);

		    result = result && debtorResult;
		}
		
		return result;
	}
	
	private Map<String, Object> createInsurance(
	        String newcarServiceId,
	        String companyId,
	        String memberId,
	        String carNo,
	        String buyNm,
	        String regNo,
	        String bizNo) {

	    Map<String, Object> insurance = new HashMap<>();

	    insurance.put("SERVICE_ID", commonUtil.toServiceId(Map.of("WORK_CD", "I020")));
	    insurance.put("LINKED_ID", newcarServiceId);
	    insurance.put("CAR_NO", carNo);
	    insurance.put("BUY_NM", buyNm);
	    insurance.put("REG_NO", regNo);
	    insurance.put("BIZ_NO", bizNo);
	    insurance.put("COMPANY_ID", companyId);
	    insurance.put("GOVT_ID", "HAMYA");
	    insurance.put("MEMBER_ID", isBlank(memberId) ? "SYSTEM" : memberId);

	    return insurance;
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
	    }
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


	// 채권 및 영수증 조회
	public Map<String, Object> selectBondInfo(String serviceId, UserDto user) {
	    serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.READ_DETAIL);

	    Map<String, Object> param = new HashMap<>();
	    param.put("SERVICE_ID", serviceId);

	    return ApiResponse.withKey("data", common.select(param, "selectBondInfo"));
	}

	public void updateChangeSu(Map<String, Object> param, UserDto user) {
		
		List<Map<String,Object>> list = (List<Map<String,Object>>) param.get("LIST");
		if (list == null || list.isEmpty()) {
		    throw new BusinessException("변경할 신청건이 없습니다.", 400);
		}
		requireAllServiceAccess(list, user, ServiceAction.REASSIGN);
		
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
		String serviceId = requestValue(param, "SERVICE_ID", "취소할 신청번호가 없습니다.");
		serviceAccessGuard.requireAccess(user, serviceId, ServiceAction.CANCEL);
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
   
	private String getDateCellValue(Cell cell, DataFormatter formatter) {
	if (cell == null) {
		return "";
	}

	if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
		return cell.getLocalDateTimeCellValue()
		.toLocalDate()
		.format(DateTimeFormatter.BASIC_ISO_DATE); // yyyyMMdd
	}

	return formatter.formatCellValue(cell).trim().replaceAll("[^0-9]", "");
	}
}



