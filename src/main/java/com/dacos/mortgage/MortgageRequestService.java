package com.dacos.mortgage;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.common.CommonService;
import com.dacos.common.ServiceAccessGuard;
import com.dacos.common.ServiceAccessGuard.ServiceAction;
import com.dacos.mortgage.mapper.MortgageRequestMapper;
import com.dacos.commonmenu.dto.CommonMenuSearchRequest;
import com.dacos.commonmenu.mapper.CommonMenuMapper;

/** 설정등록 초기조회·원부연계·저장. 신청·서명요청·결제는 수행하지 않는다. */
@Service
public class MortgageRequestService {
    private final MortgageRequestMapper mapper;
    private final CommonService commonService;
    private final ServiceAccessGuard accessGuard;
    private final ObjectMapper objectMapper;
    private final CommonMenuMapper commonMenuMapper;

    public MortgageRequestService(MortgageRequestMapper mapper, CommonService commonService,
            ServiceAccessGuard accessGuard, ObjectMapper objectMapper, CommonMenuMapper commonMenuMapper) {
        this.mapper = mapper;
        this.commonService = commonService;
        this.accessGuard = accessGuard;
        this.objectMapper = objectMapper;
        this.commonMenuMapper = commonMenuMapper;
    }

    /** 사용자 입력값 대신 로그인 회사의 업무권한·관청·납부조건을 가져온다. */
    public Map<String, Object> init(UserDto user) {
        Map<String, Object> service = new HashMap<>();
        service.put("WORK_CD", "000");
        service.put("COMPANY_ID", user.getCOMPANY_ID());
        service.put("ASSOCIATION_ID", user.getASSOCIATION_ID());
        service.put("BRANCH_ID", user.getBRANCH_ID());
        service.put("SANGSA_ID", user.getSANGSA_ID());
        service.put("MEMBER_ID", user.getLOGIN_ID());
        service.put("MEMBER_NM", user.getMEMBER_NM());
        service.put("PROC_ST", "INPUT");
        Map<String, Object> result = baseData(service);
        Map<String, Object> workCp = map(result.get("workCp"));
        service.put("GOVT_ID", workCp.get("GOVT_ID"));
        result.put("service", service);
        Map<String, Object> mortgage = new HashMap<>(Map.of("MORT_REG_GB", "SU".equals(user.getMEMBER_GB()) ? "C" : "R",
                "RATIO_NO", 100, "DSIGN_ST", "WAIT", "IDEN_ST", "WAIT", "PAY_ST", "N",
                "PAY_ME", text(workCp.get("PAYMENT_ME")), "PAY_GB", text(workCp.get("PAYMENT_GB")),
                "PAY_TP", text(workCp.get("PAYMENT_TP"))));
        String signature = isAgency(user) ? "POST" : ("SU".equals(user.getMEMBER_GB()) ? "NPKI" : "MO");
        if (List.of("CB026", "CB054", "CB015").contains(user.getCOMPANY_ID())) signature = "INPUT";
        mortgage.put("DSIGN_GB", allowedSignatures(result, text(mortgage.get("MORT_REG_GB")), user).contains(signature) ? signature : "");
        result.put("mortgage", mortgage);
        result.put("canWrite", canWrite(user));
        return result;
    }

    /** 기존 단건 상세 API 응답은 유지하고 설정등록 화면용 상세를 별도로 제공한다. */
    public Map<String, Object> detail(String serviceId, UserDto user) {
        accessGuard.requireAccess(user, serviceId, ServiceAction.READ_DETAIL);
        Map<String, Object> param = new HashMap<>(Map.of("SERVICE_ID", serviceId));
        Map<String, Object> service = mapper.selectService(param);
        requireSetting(service);
        Map<String, Object> result = baseData(service);
        result.put("service", service);
        result.put("mortgage", mapper.selectMortgage(param));
        result.put("carInfo", mapper.selectCarInfo(param));
        result.put("payments", mapper.selectPayments(param));
        result.put("owners", mapper.selectOwners(param));
        result.put("canWrite", canWrite(user));
        return result;
    }

    private Map<String, Object> baseData(Map<String, Object> service) {
        Map<String, Object> param = new HashMap<>(service);
        param.put("WORK_CD", "000");
        Map<String, Object> company = mapper.selectCompany(param);
        Map<String, Object> workCp = mapper.selectWorkCp(param);
        Map<String, Object> tax = mapper.selectTax(param);
        if (company == null || workCp == null || tax == null) {
            throw new BusinessException("설정등록 회사·업무권한·세금 기준을 확인해 주세요.");
        }
        Map<String, Object> result = new HashMap<>();
        result.put("company", company);
        result.put("workCp", workCp);
        result.put("tax", tax);
        result.put("companyHistory", mapper.selectCompanyHistory(param));
        Map<String, List<Map<String, Object>>> codes = new LinkedHashMap<>();
        for (Map<String, Object> code : mapper.selectCodes()) {
            codes.computeIfAbsent(text(code.get("GROUP_ID")), key -> new ArrayList<>()).add(code);
        }
        result.put("codes", codes);
        return result;
    }

    /** 관청은 서버의 업무설정으로 고정한다. 연계 결과는 컨트롤러가 세션에 보관한다. */
    public Map<String, Object> carInfo(Map<String, Object> request, UserDto user) {
        Map<String, Object> initial = init(user);
        requireWrite(initial);
        String carNo = text(request.get("CAR_NO")).replaceAll("\\s", "").toUpperCase();
        if (!carNo.matches("[가-힣A-Z0-9]{7,17}")) {
            throw new BusinessException("차량번호 또는 차대번호를 확인해 주세요.");
        }
        validateRegistration(text(request.get("MORT_REG_GB")), text(request.get("MORT_REG_NO")));
        Map<String, Object> link = new HashMap<>();
        link.put("SID", "설정가능여부2");
        link.put("CAR_NO", carNo);
        link.put("REG_GB", request.get("MORT_REG_GB"));
        link.put("REG_NO", text(request.get("MORT_REG_NO")).replace("-", ""));
        link.put("GOVT_ID", map(initial.get("service")).get("GOVT_ID"));
        JsonNode response = commonService.linkServer(link);
        if (response == null || !"0".equals(response.path("errorCode").asText())) {
            throw new BusinessException("차량 연계에 실패했습니다. 잠시 후 다시 시도해 주세요.", 502);
        }
        JsonNode data = response.path("returnMSG");
        if (!data.isObject() || !"OK".equals(data.path("code").asText())) {
            throw new BusinessException(data.path("message").asText("설정 가능한 차량인지 확인해 주세요."));
        }
        Map<String, Object> car = objectMapper.convertValue(data, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        // 원부의 대문자 키만 사용하며, 클라이언트가 보내는 차량정보로 저장하지 않는다.
        car.remove("MORT_INFO");
        Map<String, Object> result = new HashMap<>();
        result.put("carInfo", car);
        result.put("MORT_REG_GB", request.get("MORT_REG_GB"));
        result.put("MORT_REG_NO", text(request.get("MORT_REG_NO")).replace("-", ""));
        // 차대번호로 조회한 경우 원본처럼 현재 차량번호를 화면과 저장값에 반영한다.
        result.put("CAR_NO", carNo.length() == 17 && !text(car.get("WCAR_NO")).isEmpty() ? car.get("WCAR_NO") : carNo);
        result.put("MORT_NM", text(request.get("MORT_NM")));
        result.put("COMPANY_ID", user.getCOMPANY_ID());
        return result;
    }

    /** SAV 저장만 허용한다. 결제금액과 사용자·회사·처리상태는 서버에서 확정한다. */
    @Transactional
    public Map<String, Object> save(Map<String, Object> request, UserDto user, Map<String, Object> linked) {
        Map<String, Object> submittedService = map(request.get("service"));
        String status = text(submittedService.get("PROC_ST"));
        if (!status.isEmpty() && !List.of("INPUT", "SAV").contains(status)) {
            throw new BusinessException("현재는 저장만 가능합니다.");
        }
        Map<String, Object> initial = init(user);
        Map<String, Object> workCp = map(initial.get("workCp"));
        requireWrite(initial);
        Map<String, Object> mortgage = map(request.get("mortgage"));
        validateMortgage(mortgage);
        Map<String, Object> service = new HashMap<>(map(initial.get("service")));
        String serviceId = text(submittedService.get("SERVICE_ID"));
        Map<String, Object> param = new HashMap<>();
        Map<String, Object> oldMortgage = new HashMap<>();
        Map<String, Object> car = new HashMap<>();
        if (!serviceId.isEmpty()) {
            accessGuard.requireAccess(user, serviceId, ServiceAction.UPDATE_SERVICE);
            param.put("SERVICE_ID", serviceId);
            Map<String, Object> existing = mapper.lockService(param);
            requireSetting(existing);
            if (!user.getCOMPANY_ID().equals(existing.get("COMPANY_ID"))) {
                throw new BusinessException("현재 로그인 회사의 설정등록만 수정할 수 있습니다.", 403);
            }
            // 서명/입금 수신 작업과 저장이 겹쳐도 이미 완료된 정보를 덮어쓰지 않는다.
            param.put("LOCK_ROW", true);
            oldMortgage = map(mapper.selectMortgage(param));
            if (oldMortgage.isEmpty()) throw new BusinessException("저당정보가 없습니다. 기존 시스템에서 확인해 주세요.", 409);
            requireEditable(existing, oldMortgage, mapper.selectOwners(param), mapper.selectPayments(param));
            service = new HashMap<>(existing);
            if (sameVehicle(mortgage, oldMortgage)) car = map(mapper.selectCarInfo(param));
        }
        if (matchesLinked(mortgage, linked, user)) car = map(linked.get("carInfo"));
        else if (!text(request.get("linkToken")).isEmpty()) throw new BusinessException("연계한 차량정보와 입력값이 다릅니다. 다시 연계해 주세요.");

        // 요청에서 쓰는 입력 항목만 복사한다. 서명상태·완료일시·가상계좌는 덮어쓰지 않는다.
        Map<String, Object> data = new HashMap<>(oldMortgage);
        for (String key : List.of("CAR_NO", "MORT_REG_GB", "MORT_REG_NO", "MORT_BIZ_NO", "MORT_NM",
                "BOND_AMT", "RATIO_NO", "DSIGN_GB", "DSIGN_HP_GB", "DSIGN_HP_NO", "CONFIRM_NO",
                "PAY_NM", "PAY_HP_NO", "PAY_ME", "WONBU_YN", "PRE_MORT_NM")) {
            data.put(key, mortgage.get(key));
        }
        validateCodes(data, initial, user);
        data.put("MORT_REG_NO", text(data.get("MORT_REG_NO")).replace("-", ""));
        data.put("BOND_AMT", decimal(data.get("BOND_AMT")));
        data.put("RATIO_NO", decimal(data.get("RATIO_NO")));
        data.put("MORT_BIZ_NO", text(data.get("MORT_BIZ_NO")).replace("-", ""));
        data.put("DSIGN_HP_NO", text(data.get("DSIGN_HP_NO")).replace("-", ""));
        data.put("PAY_HP_NO", text(data.get("PAY_HP_NO")).replace("-", ""));
        data.put("PAY_GB", workCp.get("PAYMENT_GB"));
        data.put("PAY_TP", workCp.get("PAYMENT_TP"));
        data.put("PAY_ST", "N");
        data.put("IDEN_ST", "WAIT");
        data.put("DSIGN_ST", "WAIT");
        data.put("WORK_CD", "000");
        data.put("COMPANY_ID", user.getCOMPANY_ID());
        data.put("WONBU_YN", "Y".equals(data.get("WONBU_YN")) ? "Y" : "N");
        data.put("PRE_MORT_NM", "1".equals(data.get("PRE_MORT_NM")) ? "1" : "0");
        // 대행업체는 자신의 회사이력에 등록된 저당권자만 선택할 수 있다.
        if (isAgency(user)) {
            String companyNo = text(mortgage.get("COMPANY_NO"));
            Map<String, Object> creditor = companyHistory(initial).stream()
                    .filter(row -> companyNo.equals(text(row.get("COMPANY_NO"))))
                    .findFirst().orElseThrow(() -> new BusinessException("저당권자를 선택해 주세요."));
            data.put("COMPANY_ID", creditor.get("COMPANY_NO"));
        }
        List<Map<String, Object>> payments = payments(data, map(initial.get("tax")), workCp);
        if (serviceId.isEmpty()) {
            serviceId = "M000-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyMMdd"))
                    + "-" + mapper.nextServiceSequence();
        }
        service.put("SERVICE_ID", serviceId);
        service.put("CAR_NO", data.get("CAR_NO"));
        service.put("PROC_ST", "SAV");
        service.put("UPD_USER", user.getLOGIN_ID());
        param.put("SERVICE_ID", serviceId);
        // 원부정보와 입력정보에 동일한 컬럼이 있어도 설정자와 회사 값은 덮어쓰지 않는다.
        Map<String, Object> carData = new HashMap<>(car);
        carData.put("SERVICE_ID", serviceId);
        carData.put("WORK_CD", "000");
        carData.put("CAR_NO", data.get("CAR_NO"));
        carData.put("MEMBER_ID", user.getLOGIN_ID());
        carData.putIfAbsent("MORT_NM", data.get("MORT_NM"));
        data.put("SERVICE_ID", serviceId);
        data.put("MEMBER_ID", user.getLOGIN_ID());
        if (oldMortgage.isEmpty()) {
            mapper.insertService(service);
            mapper.insertMortgage(data);
            mapper.insertCarInfo(carData);
        } else {
            if (mapper.updateService(service) != 1) throw new BusinessException("처리상태가 변경되었습니다. 다시 조회해 주세요.", 409);
            mapper.updateMortgage(data);
            mapper.updateCarInfo(carData);
            mapper.deletePayments(param);
        }
        for (Map<String, Object> payment : payments) {
            payment.put("SERVICE_ID", serviceId);
            payment.put("MEMBER_ID", user.getLOGIN_ID());
            mapper.insertPayment(payment);
        }
        saveOwners(request.get("owners"), param, user, initial);
        return detail(serviceId, user);
    }

    /** 기존 서명·납부가 진행된 건은 이 저장 화면에서 초기화하거나 수정하지 않는다. */
    static void requireEditable(Map<String, Object> service, Map<String, Object> mortgage,
            List<Map<String, Object>> owners, List<Map<String, Object>> payments) {
        if (!List.of("INPUT", "SAV").contains(text(service.get("PROC_ST"))) || !text(service.get("JUDGE_ST")).isEmpty()) {
            throw new BusinessException("이미 신청 또는 심사 중인 건은 수정할 수 없습니다.", 409);
        }
        if (owners.size() > 1) throw new BusinessException("복수 소유자 확인정보는 기존 시스템에서 수정해 주세요.", 409);
        List<Map<String, Object>> people = new ArrayList<>(owners);
        people.add(mortgage);
        for (Map<String, Object> person : people) {
            if (!List.of("", "WAIT", "NOT").contains(text(person.get("IDEN_ST")))
                    || !List.of("", "WAIT", "NOT").contains(text(person.get("DSIGN_ST")))) {
                throw new BusinessException("본인확인 또는 전자서명이 진행된 건은 수정할 수 없습니다.", 409);
            }
        }
        if ("Y".equals(text(mortgage.get("PAY_ST"))) || !text(mortgage.get("VBANK_NO")).isEmpty()
                || payments.stream().anyMatch(row -> "Y".equals(text(row.get("PAY_ST")))
                        || "Y".equals(text(row.get("REAL_PAY_ST"))) || !text(row.get("VBANK_NO")).isEmpty())) {
            throw new BusinessException("결제가 진행된 건은 수정할 수 없습니다.", 409);
        }
    }

    private void saveOwners(Object value, Map<String, Object> param, UserDto user, Map<String, Object> initial) {
        if (!(value instanceof List<?> list) || list.size() > 1) throw new BusinessException("추가 채무자는 1명까지 입력할 수 있습니다.");
        List<Map<String, Object>> owners = new ArrayList<>();
        for (Object item : list) {
            Map<String, Object> row = map(item);
            if (text(row.get("DEBTOR_NM")).isEmpty()) throw new BusinessException("추가 채무자명을 입력해 주세요.");
            validateRegistration(text(row.get("DEBTOR_GB")), text(row.get("REG_NO")));
            if ("B".equals(row.get("DEBTOR_GB"))) validateBusinessNumber(text(row.get("BIZ_NO")));
            String phone = text(row.get("DSIGN_HP_NO")).replace("-", "");
            if (!phone.isEmpty() && !phone.matches("0\\d{8,10}")) throw new BusinessException("추가 채무자의 휴대전화번호를 확인해 주세요.");
            number(row.get("DEBTOR_RATIO"), "추가 채무비율", new BigDecimal("100"));
            validateCode(initial, "REGGB", row.get("DEBTOR_GB"), false);
            validateCode(initial, "DHPGB", row.get("DSIGN_HP_GB"), true);
            validateCode(initial, "DSIGB", row.get("DSIGN_GB"), false);
            if (!allowedSignatures(initial, text(row.get("DEBTOR_GB")), user).contains(text(row.get("DSIGN_GB")))) {
                throw new BusinessException("추가 채무자의 전자적 확인방법을 확인해 주세요.");
            }
            Map<String, Object> owner = new HashMap<>();
            for (String key : List.of("DEBTOR_NM", "DEBTOR_GB", "DEBTOR_RATIO", "DEBTOR_ADDR", "DEBTOR_ADDR_DT",
                    "DEBTOR_ROAD_CD", "DSIGN_GB", "DSIGN_HP_GB", "DSIGN_HP_NO", "BIZ_NO")) owner.put(key, row.get(key));
            owner.put("REG_NO", text(row.get("REG_NO")).replace("-", ""));
            owner.put("DSIGN_HP_NO", phone);
            owner.put("SERVICE_ID", param.get("SERVICE_ID"));
            owner.put("SEQ", 1);
            owner.put("UNION_YN", "Y".equals(row.get("UNION_YN")) ? "Y" : "N");
            owner.put("DEBTOR_YN", "Y");
            owner.put("IDEN_ST", "WAIT");
            owner.put("DSIGN_ST", "WAIT");
            owners.add(owner);
        }
        mapper.deleteOwners(param);
        for (Map<String, Object> owner : owners) mapper.insertOwner(owner);
    }

    /** 원본 gf_getTaxAmt: 정률/정액·최저금액 적용 후 10원 단위 절삭. */
    static BigDecimal taxAmount(Map<String, Object> tax, String kind, BigDecimal bond) {
        BigDecimal amount = decimal(tax.get(kind + "_AMT"));
        if ((kind + "_PER").equals(text(tax.get(kind + "_BASE")))) {
            amount = amount.max(bond.multiply(decimal(tax.get(kind + "_PER"))));
        }
        return amount.divide(BigDecimal.TEN, 0, RoundingMode.DOWN).multiply(BigDecimal.TEN);
    }

    private List<Map<String, Object>> payments(Map<String, Object> mortgage, Map<String, Object> tax, Map<String, Object> workCp) {
        BigDecimal bond = decimal(mortgage.get("BOND_AMT"));
        List<Map<String, Object>> rows = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (String kind : List.of("FEE", "REGIS", "STAMP")) {
            BigDecimal amount = "FEE".equals(kind) ? decimal(workCp.get("FEE")) : taxAmount(tax, "REGIS".equals(kind) ? "REGIST" : kind, bond);
            Map<String, Object> row = new HashMap<>();
            row.put("PAY_KD", kind); row.put("PAY_AMT", amount); row.put("PAY_ST", "N");
            row.put("PAY_OP", "FEE".equals(kind) ? workCp.get("PAYMENT_OP") : "Y");
            rows.add(row);
            if (!("FEE".equals(kind) && "MON".equals(mortgage.get("PAY_TP")))) total = total.add(amount);
        }
        mortgage.put("TOTAL_AMT", total);
        return rows;
    }

    static void validateMortgage(Map<String, Object> mortgage) {
        String carNo = text(mortgage.get("CAR_NO"));
        if (!carNo.matches("[가-힣A-Z0-9]{7,17}")) throw new BusinessException("차량번호 또는 차대번호를 확인해 주세요.");
        if (text(mortgage.get("MORT_NM")).isEmpty()) throw new BusinessException("저당권 설정자명을 입력해 주세요.");
        validateRegistration(text(mortgage.get("MORT_REG_GB")), text(mortgage.get("MORT_REG_NO")));
        BigDecimal bond = number(mortgage.get("BOND_AMT"), "채권가액", new BigDecimal("999999999999999"));
        if (bond.stripTrailingZeros().scale() > 0) throw new BusinessException("채권가액은 원 단위로 입력해 주세요.");
        number(mortgage.get("RATIO_NO"), "채무비율", new BigDecimal("100"));
        if ("B".equals(mortgage.get("MORT_REG_GB"))) validateBusinessNumber(text(mortgage.get("MORT_BIZ_NO")));
        for (String key : List.of("DSIGN_HP_NO", "PAY_HP_NO")) {
            String phone = text(mortgage.get(key)).replace("-", "");
            if (!phone.isEmpty() && !phone.matches("0\\d{8,10}")) throw new BusinessException("휴대전화번호를 확인해 주세요.");
        }
    }

    static void validateRegistration(String kind, String value) {
        String digits = value.replace("-", "");
        int size = "C".equals(kind) ? 10 : (List.of("B", "E").contains(kind) ? 13 : 7);
        if (!List.of("R", "F", "C", "B", "E").contains(kind) || !digits.matches("\\d{" + size + "}")) {
            throw new BusinessException("등록구분에 맞는 등록번호 " + size + "자리를 입력해 주세요.");
        }
        if ("C".equals(kind)) validateBusinessNumber(digits);
    }

    /** DaCOS gfn_GetCheckCompNum과 같은 사업자번호 검증식. */
    static void validateBusinessNumber(String value) {
        String digits = value.replace("-", "");
        if (!digits.matches("\\d{10}")) throw new BusinessException("사업자번호 10자리를 입력해 주세요.");
        int[] weights = { 1, 3, 7, 1, 3, 7, 1, 3 };
        int sum = 0;
        for (int i = 0; i < weights.length; i++) sum += (digits.charAt(i) - '0') * weights[i] % 10;
        int ninth = (digits.charAt(8) - '0') * 5;
        sum += ninth / 10 + ninth % 10 + digits.charAt(9) - '0';
        if (sum % 10 != 0) throw new BusinessException("올바른 사업자번호를 입력해 주세요.");
    }

    private void validateCodes(Map<String, Object> mortgage, Map<String, Object> initial, UserDto user) {
        validateCode(initial, "REGGB", mortgage.get("MORT_REG_GB"), false);
        validateCode(initial, "PAYME", mortgage.get("PAY_ME"), false);
        validateCode(initial, "DHPGB", mortgage.get("DSIGN_HP_GB"), true);
        if (!List.of("POST", "POSTI", "INPUT", "SNODT").contains(text(mortgage.get("DSIGN_GB")))
                && !("SU".equals(user.getMEMBER_GB()) && "NPKI".equals(mortgage.get("DSIGN_GB")))
                && text(mortgage.get("DSIGN_HP_NO")).isEmpty()) {
            throw new BusinessException("전자적 확인에 사용할 휴대전화번호를 입력해 주세요.");
        }
        if (!allowedSignatures(initial, text(mortgage.get("MORT_REG_GB")), user).contains(text(mortgage.get("DSIGN_GB")))) {
            throw new BusinessException("사용 가능한 전자적 확인방법을 선택해 주세요.");
        }
        // 선납금은 이번 단계에서 결제하지 않지만 사용권한이 없는 회사의 선택은 막는다.
        String pointUse = text(map(initial.get("workCp")).get("POINT_COMMON_USE"));
        if ("P".equals(mortgage.get("PAY_ME")) && !List.of("A", "B").contains(pointUse)) {
            throw new BusinessException("선납금 사용권한이 없는 회사입니다.");
        }
    }

    private void validateCode(Map<String, Object> initial, String group, Object value, boolean optional) {
        if (optional && text(value).isEmpty()) return;
        if (codes(initial, group).stream().noneMatch(row -> text(row.get("CODE_ID")).equals(text(value)))) {
            throw new BusinessException("선택한 코드값을 확인해 주세요: " + group);
        }
    }

    /** 원본 DSIGB의 개인/법인 범위와 회사 제한을 서버에서도 적용한다. */
    private List<String> allowedSignatures(Map<String, Object> initial, String registration, UserDto user) {
        List<String> allowed = new ArrayList<>();
        for (Map<String, Object> code : codes(initial, "DSIGB")) {
            String kind = text(code.get("DETAIL_ID"));
            String company = text(code.get("DETAIL_NM"));
            boolean corporation = List.of("B", "C").contains(registration);
            String id = text(code.get("CODE_ID"));
            if (!(kind.contains(corporation ? "B" : "R") || kind.contains(corporation ? "C" : "F"))) continue;
            if (!(company.contains("ALL") || company.contains(user.getCOMPANY_ID()))) continue;
            if (List.of("CB054", "CB015", "CB005", "CB016", "CB116").contains(user.getCOMPANY_ID())
                    && List.of("REGNO", "DRIVE").contains(id)) continue;
            if (isAgency(user) && !"POST".equals(id)) continue;
            allowed.add(id);
        }
        return allowed;
    }

    /** 원본 gf_getAble처럼 TM_WORK_MB의 사용자 업무권한을 확인한다. 회사 업무설정과 구분한다. */
    private boolean canWrite(UserDto user) {
        if ("GU".equals(user.getMEMBER_GB())) return false;
        if (text(user.getMEMBER_GB()).startsWith("U")) return true;
        CommonMenuSearchRequest request = new CommonMenuSearchRequest();
        request.setMEMBER_ID(user.getLOGIN_ID());
        request.setCOMPANY_ID(user.getCOMPANY_ID());
        return commonMenuMapper.selectUserWorkAuthAvailable(request).stream()
                .anyMatch(row -> "000".equals(text(row.get("WORK_CD"))) && text(row.get("PERM_GB")).contains("C"));
    }

    private void requireWrite(Map<String, Object> initial) {
        if (!Boolean.TRUE.equals(initial.get("canWrite")))
            throw new BusinessException("설정등록 저장 권한이 없습니다.", 403);
    }

    private static void requireSetting(Map<String, Object> service) {
        if (service == null || !"000".equals(text(service.get("WORK_CD")))) throw new BusinessException("설정등록 자료를 찾을 수 없습니다.", 404);
    }

    private static boolean sameVehicle(Map<String, Object> left, Map<String, Object> right) {
        for (String key : List.of("CAR_NO", "MORT_REG_GB", "MORT_REG_NO", "MORT_NM")) {
            String a = text(left.get(key));
            String b = text(right.get(key));
            if ("MORT_REG_NO".equals(key)) { a = a.replace("-", ""); b = b.replace("-", ""); }
            if (!a.equals(b)) return false;
        }
        return true;
    }

    private static boolean matchesLinked(Map<String, Object> mortgage, Map<String, Object> linked, UserDto user) {
        return linked != null && user.getCOMPANY_ID().equals(linked.get("COMPANY_ID")) && sameVehicle(mortgage, linked);
    }

    private static boolean isAgency(UserDto user) {
        return text(user.getMEMBER_GB()).startsWith("R") || text(user.getCOMPANY_ID()).startsWith("CR");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> companyHistory(Map<String, Object> initial) {
        return (List<Map<String, Object>>) initial.get("companyHistory");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> codes(Map<String, Object> initial, String group) {
        return ((Map<String, List<Map<String, Object>>>) initial.get("codes")).getOrDefault(group, List.of());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> ? new HashMap<>((Map<String, Object>) value) : new HashMap<>();
    }

    private static String text(Object value) { return Objects.toString(value, "").trim(); }
    private static BigDecimal decimal(Object value) { return text(value).isEmpty() ? BigDecimal.ZERO : new BigDecimal(text(value)); }
    private static BigDecimal number(Object value, String label, BigDecimal max) {
        try {
            if (text(value).isEmpty()) throw new NumberFormatException();
            BigDecimal result = new BigDecimal(text(value));
            if (result.signum() < 0 || result.compareTo(max) > 0) throw new NumberFormatException();
            return result;
        } catch (NumberFormatException e) { throw new BusinessException(label + "을 올바르게 입력해 주세요."); }
    }
}
