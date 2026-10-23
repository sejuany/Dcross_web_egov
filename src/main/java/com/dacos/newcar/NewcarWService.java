package com.dacos.newcar;

import static com.dacos.newcar.NewcarWValidation.*;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.dacos.attach.AttachService;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;
import com.dacos.common.ServiceAccessGuard;
import com.dacos.common.ServiceAccessGuard.ServiceAction;

/** 딜러 화면에서 숨긴 값과 조회 전용 값을 서버 원본과 병합한 뒤 기존 저장 프로세스를 사용한다. */
@Service
public class NewcarWService {
    private static final Set<String> EDITABLE_STATES = Set.of("INPUT", "SAV", "C_REQ", "C_SAV", "I_REQ", "I_SAV", "W_REQ", "RET", "DEL");
    private static final String[] CAR_FIELDS = {"TASK_CD", "CARID_NO", "REGIST_DATE", "NUMPLATE_GB", "REG_GB", "REG_NO", "BIZ_NO", "OWNER_NM",
        "RATIO_NO", "MPHONE_NO", "TEL_NO", "ADDRESS", "ADDRESS_DT", "POST_NO", "BUBJUNG_CD", "ADDR_INFO", "BASE_ADDRESS", "BASE_ADDRESS_DT",
        "BASE_POST_NO", "BASE_BUBJUNG_CD", "ADDR_INFO2", "RT_ACC_NO", "RT_ACC_NM", "BASE_BRANCH_ID", "BUY_AMT", "NTAX_TRGET_CD",
        "NTAX_TRGET_GR_CD", "NTAX_WHO", "CARD_YN", "BOND_DC", "PAY_NM", "PAY_HP_NO", "RT_BANK_CD", "RETURN_NO", "RETURN_NM",
        "CARP_ADDRESS", "CARP_ADDRESS_DT", "CARP_POST_NO", "CARP_MAIL", "MEMO_TX", "REQ_CAR_NO"};
    private static final String[] OWNER_FIELDS = {"DEBTOR_GB", "DEBTOR_NM", "DEBTOR_REG_NO", "DEBTOR_BIZ_NO", "DEBTOR_RATIO", "DEBTOR_TEL_NO",
        "DEBTOR_MPHONE_NO", "DEBTOR_ADDR", "DEBTOR_ADDR_DT", "DEBTOR_ROAD_CD"};
    private static final String[] TAX_FIELDS = {"GUBUN", "ETC1", "REG_NO", "NAME", "COMPANY_NM", "PHONE_NO", "ADDR", "ADDR_DT", "POST_NO",
        "BUSINESS_TYPE", "INDUSTRY_TYPE", "MAIL1", "MAIL2"};
    private static final Set<String> PAYMENT_KINDS = Set.of("ACQ", "BFEE", "BOND", "FEE", "INJI", "SPARE", "STAMP", "TNUM", "UNUM", "UREG");
    private static final String[] ESTIMATE_INPUTS = {"TASK_CD", "CARID_NO", "CAR_NM", "BASE_ADDRESS", "BUY_AMT", "NTAX_TRGET_CD",
        "NTAX_TRGET_GR_CD", "NTAX_WHO", "BOND_DC", "CARD_YN", "NUMPLATE_GB"};
    private final NewcarService legacy;
    private final NewcarPdfExtractService pdf;
    private final ServiceAccessGuard access;
    private final CommonRepository common;
    private final AttachService attach;
    private final TransactionTemplate transaction;

    public NewcarWService(NewcarService legacy, NewcarPdfExtractService pdf, ServiceAccessGuard access,
            CommonRepository common, AttachService attach, PlatformTransactionManager manager) {
        this.legacy = legacy; this.pdf = pdf; this.access = access; this.common = common; this.attach = attach;
        this.transaction = new TransactionTemplate(manager);
    }

    public Map<String, Object> process(Map<String, Object> request, String action, MultipartFile file, UserDto user) {
        requireCompany(user);
        if (!Set.of("SAVE", "REQUEST", "DELETE").contains(action)) fail("처리 구분이 올바르지 않습니다.");
        return transaction.execute(status -> save(request, action, file, user));
    }

    private Map<String, Object> save(Map<String, Object> request, String action, MultipartFile file, UserDto user) {
        String id = text(map(request, "dsService"), "SERVICE_ID");
        Map<String, Object> original;
        if (id.isEmpty()) {
            if ("DELETE".equals(action)) fail("삭제할 접수번호가 없습니다.");
            ServiceAccessGuard.listAccessScopeFor(user);
            original = legacy.initNewCar(user);
        } else {
            access.requireAccess(user, id, "SAVE".equals(action) ? ServiceAction.UPDATE_SERVICE : ServiceAction.CHANGE_STATUS);
            Map<String, Object> locked = common.select(Map.of("SERVICE_ID", id), "selectWNewcarServiceForUpdate");
            if (locked == null || !"WB001".equals(text(locked, "COMPANY_ID"))) throw new BusinessException("접근할 수 없는 신청건입니다.", 403);
            checkEditable(locked);
            original = legacy.getNewCarDetail(user, id);
        }
        Map<String, Object> service = merge(map(original, "dsService"), map(request, "dsService"), "LINK_ID");
        service.put("SERVICE_ID", id);
        service.put("WORK_CD", "010");
        Map<String, Object> car = new HashMap<>(map(original, "dsNewCar"));
        if (id.isEmpty()) {
            Map<String, Object> defaults = Map.ofEntries(Map.entry("PROC_CD", "I"), Map.entry("TASK_CD", "NORML"), Map.entry("REG_GB", "B"),
                Map.entry("RATIO_NO", "100"), Map.entry("CAR_US", "2"), Map.entry("IMSINUM_YN", "N"), Map.entry("PAY_GB", "B"),
                Map.entry("PAY_ME", "B"), Map.entry("PAY_ST", "N"), Map.entry("CARD_YN", "N"), Map.entry("BOND_YN", "N"),
                Map.entry("STAMP_GB", "TOTAL"), Map.entry("NTAX_TRGET_GR_CD", "0"), Map.entry("NTAX_APPLC_CD", "0"), Map.entry("NTAX_WHO", "REPRE"));
            defaults.forEach(car::putIfAbsent);
        }
        car = merge(car, map(request, "dsNewCar"), CAR_FIELDS);
        if (Set.of("06", "09", "12", "13", "15").contains(text(car, "NTAX_TRGET_CD"))) car.put("NTAX_TRGET_GR_CD", "D");
        car.put("CARID_NO", text(car, "CARID_NO").toUpperCase());
        String selected = text(car, "REQ_CAR_NO");
        if (!"DELETE".equals(action) && !selected.isEmpty() && !selected.equals(text(map(original, "dsNewCar"), "REQ_CAR_NO"))) {
            Integer owned = common.select(Map.of("SERVICE_ID", id, "CAR_NO", selected, "CARID_NO", text(car, "CARID_NO")), "countWSelectedNumplate");
            if (id.isEmpty() || owned == null || owned != 1) fail("현재 신청에서 선택한 번호판이 아닙니다.");
        }
        // DB의 관청 발급 저공해 정보·등록 정보·금액은 요청값으로 덮어쓰지 않는다.
        Map<String, Object> detach = merge(map(original, "dsCarNoDetach"), map(request, "dsCarNoDetach"), "CUSTOMER_NM", "HOLE_YN", "SEAL_YN");
        detach.putIfAbsent("HOLE_YN", "02"); detach.putIfAbsent("SEAL_YN", "02");
        List<Map<String, Object>> owners = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            String key = i == 0 ? "dsOwnerInfo" : "dsOwnerInfo1";
            Map<String, Object> owner = new HashMap<>(map(original, key));
            if (!owner.containsKey("DEBTOR_REG_NO")) owner.put("DEBTOR_REG_NO", owner.get("REG_NO"));
            if (!owner.containsKey("DEBTOR_BIZ_NO")) owner.put("DEBTOR_BIZ_NO", owner.get("BIZ_NO"));
            if (!owner.containsKey("DEBTOR_TEL_NO")) owner.put("DEBTOR_TEL_NO", owner.get("DSIGN_HP_NO"));
            owner = merge(owner, map(request, key), OWNER_FIELDS);
            owner.putIfAbsent("SEQ", i);
            owners.add(owner);
        }
        Map<String, Object> tax = merge(map(original, "dsTaxReceipt"), map(request, "dsTaxReceipt"), TAX_FIELDS);
        car.put("CARP_MAIL", text(car, "CARP_MAIL"));
        if ("CASH".equals(text(tax, "GUBUN"))) {
            for (String key : List.of("NAME", "COMPANY_NM", "ADDR", "ADDR_DT", "POST_NO", "BUSINESS_TYPE", "INDUSTRY_TYPE", "MAIL1", "MAIL2")) tax.put(key, "");
        }
        if ("DELETE".equals(action)) {
            car = new HashMap<>(map(original, "dsNewCar"));
            detach = new HashMap<>(map(original, "dsCarNoDetach"));
            owners = List.of(new HashMap<>(map(original, "dsOwnerInfo")), new HashMap<>(map(original, "dsOwnerInfo1")));
            tax = new HashMap<>(map(original, "dsTaxReceipt"));
        } else validate(service, car, detach, owners, tax, "REQUEST".equals(action));
        if ("REQUEST".equals(action) && !Set.of("F", "7", "FG").contains(text(car, "NUMPLATE_GB"))) fail("선택할 수 없는 번호판 종류입니다.");

        if (file != null && !file.isEmpty()) {
            if ("DELETE".equals(action)) fail("삭제 요청에는 제작증을 올릴 수 없습니다.");
            if (file.getSize() > 10 * 1024 * 1024) fail("제작증 PDF는 10MB 이내로 올려 주세요.");
            try {
                Map<String, Object> extracted = pdf.extractProductionCertificate(file);
                if (!text(car, "CARID_NO").equals(text(extracted, "carIdNo").toUpperCase())) fail("현재 신청과 제작증의 차대번호가 다릅니다.");
                String originalVin = text(map(original, "dsNewCar"), "CARID_NO");
                if (!originalVin.isEmpty() && !originalVin.equals(text(car, "CARID_NO"))) fail("저장된 신청과 제작증의 차대번호가 다릅니다.");
                putNonBlank(car, "CAR_NM", extracted.get("carName"));
                putNonBlank(car, "MADE_DT", extracted.get("manufactureDate"));
            } catch (IOException e) { throw new BusinessException("제작증 파일을 처리하지 못했습니다.", 400); }
        }

        Map<String, Object> estimate = map(request, "dsEstimate");
        boolean hasVehicleInfo = !"DELETE".equals(action) && ((file != null && !file.isEmpty()) || !estimate.isEmpty());
        if (hasVehicleInfo) {
            Map<String, Object> spec = legacy.getCarSpec(user.getCOMPANY_ID(), text(car, "CAR_NM"));
            for (String name : List.of("CAR_NM", "MADE_YY", "CAR_CC", "GETIN_NO", "CAR_KD", "CAR_KD_CD", "FM_NM", "FUEL_CD", "COLOR_GB", "SPMNNO", "ECO_YN", "LOW_POLLUTION_YN")) {
                putNonBlank(car, name, spec.get(name));
            }
            car.put("VH_TY_CD", "Y".equalsIgnoreCase(text(spec, "MULTI_PURPOSE_YN")) ? "3" : "");
        }
        List<Map<String, Object>> payments = rows(original.get("dsPaymentList"));
        if (!"DELETE".equals(action) && !estimate.isEmpty()) payments = applyEstimate(request, car, payments, map(original, "dsWorkCp"));
        if ("REQUEST".equals(action)) {
            if (estimate.isEmpty()) fail("예상금액계산 후 확인을 눌러 주세요.");
            service.put("PROC_ST", "A".equals(text(car, "PAY_GB")) ? "S_WAIT" : "P_REQ");
            service.put("JUDGE_ST", "A".equals(text(car, "PAY_GB")) ? "S_WAIT" : "");
        } else if ("DELETE".equals(action)) {
            service.put("PROC_ST", "DEL"); service.put("JUDGE_ST", "DEL");
        } else if (id.isEmpty() || "INPUT".equals(text(service, "PROC_ST"))) service.put("PROC_ST", "SAV");
        Map<String, Object> data = new HashMap<>();
        data.put("dsService", service); data.put("dsNewCar", car); data.put("dsCarNoDetach", detach);
        data.put("dsOwnerInfo", owners.get(0)); data.put("dsOwnerInfo1", owners.get(1));
        data.put("dsPaymentList", payments); data.put("dsTaxReceipt", tax);
        // 제작증은 검증·값 추출에만 사용하며 원본 파일은 보관하지 않는다.
        boolean stagedRequest = hasVehicleInfo && "REQUEST".equals(action);
        Map<String, Object> saveData = data;
        if (stagedRequest) {
            // 차량제원 저장 실패 시 관청 신청이 먼저 진행되지 않도록 한다.
            saveData = new HashMap<>(data);
            Map<String, Object> draftService = new HashMap<>(service);
            draftService.put("PROC_ST", id.isEmpty() ? "SAV" : text(map(original, "dsService"), "PROC_ST"));
            draftService.put("JUDGE_ST", text(map(original, "dsService"), "JUDGE_ST"));
            saveData.put("dsService", draftService);
        }
        Map<String, Object> response = legacy.processNewCar(saveData, user);
        Map<String, Object> result = successfulResult(response);
        if (hasVehicleInfo && common.update(merge(car, Map.of("SERVICE_ID", result.get("SERVICE_ID")), "SERVICE_ID"), "updateWCarSpec") != 1) {
            throw new BusinessException("제작증 차량정보를 저장하지 못했습니다.", 409);
        }
        if (stagedRequest) {
            service.put("SERVICE_ID", result.get("SERVICE_ID"));
            response = legacy.processNewCar(data, user);
            successfulResult(response);
        }
        return response;
    }

    private static Map<String, Object> successfulResult(Map<String, Object> response) {
        Map<String, Object> result = map(response, "data");
        if (!Boolean.TRUE.equals(response.get("success")) || !"0".equals(text(result, "RESULT_CD"))) {
            throw new BusinessException("저장·신청을 완료하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.", 409);
        }
        return result;
    }

    static void checkEditable(Map<String, Object> service) {
        String state = text(service, "PROC_ST");
        if (!EDITABLE_STATES.contains(state) || (!text(service, "JUDGE_ST").isEmpty() && !Set.of("RET", "DEL").contains(state))) {
            throw new BusinessException("현재 신청·심사 상태에서는 수정할 수 없습니다.", 409);
        }
    }
    static void requireCompany(UserDto user) {
        if (user == null || !"WB001".equals(user.getCOMPANY_ID())) throw new BusinessException("WB001 담당자만 사용할 수 있습니다.", 403);
    }
    public Path registrationPaper(String id, UserDto user) {
        requireCompany(user);
        access.requireAccess(user, id, ServiceAction.READ_ATTACHMENT);
        Map<String, Object> detail = legacy.getNewCarDetail(user, id);
        Map<String, Object> service = map(detail, "dsService");
        Map<String, Object> car = map(detail, "dsNewCar");
        if (!"WB001".equals(text(service, "COMPANY_ID"))) throw new BusinessException("접근할 수 없는 신청건입니다.", 403);
        String date = text(service, "JUDGE_DT").replaceAll("[^0-9]", "");
        if (date.length() < 8 || text(car, "CAR_NO").isEmpty()) throw new BusinessException("아직 등록증이 준비되지 않았습니다.", 404);
        try {
            Path path = CarPaperFiles.resolve(attach.getServerAddress("IP"), date.substring(2, 8), text(car, "CAR_NO"));
            if (!Files.isRegularFile(path)) throw new BusinessException("등록증 파일이 없습니다.", 404);
            return path;
        } catch (IllegalArgumentException e) { throw new BusinessException("등록증 정보가 올바르지 않습니다.", 400); }
    }
    @SuppressWarnings("unchecked")
    static Map<String, Object> map(Map<String, Object> source, String key) {
        Object value = source.get(key);
        return value instanceof Map<?, ?> ? (Map<String, Object>) value : Map.of();
    }
    private static Map<String, Object> merge(Map<String, Object> original, Map<String, Object> supplied, String... keys) {
        Map<String, Object> result = new HashMap<>(original);
        for (String key : keys) if (supplied.containsKey(key)) result.put(key, supplied.get(key));
        return result;
    }
    private static void putNonBlank(Map<String, Object> row, String key, Object value) {
        if (value != null && !value.toString().isBlank()) row.put(key, value);
    }
    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> rows(Object source) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (source instanceof List<?> list) for (Object row : list) result.add(new HashMap<>((Map<String, Object>) row));
        return result;
    }
    static List<Map<String, Object>> applyEstimate(Map<String, Object> request, Map<String, Object> car,
            List<Map<String, Object>> original, Map<String, Object> workCp) {
        Map<String, Object> estimate = map(request, "dsEstimate");
        Map<String, Object> inputs = map(estimate, "INPUTS");
        for (String name : ESTIMATE_INPUTS) {
            if (!text(car, name).equals(text(inputs, name))) fail("계산 조건이 변경되었습니다. 예상금액을 다시 계산해 주세요.");
        }
        Object incoming = request.get("dsPaymentList");
        if (!(incoming instanceof List<?>)) fail("예상 결제정보를 확인해 주세요.");
        List<Map<String, Object>> payments = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        BigDecimal total = BigDecimal.ZERO;
        for (Object value : (List<?>) incoming) {
            if (!(value instanceof Map<?, ?>)) fail("예상 결제정보를 확인해 주세요.");
            @SuppressWarnings("unchecked") Map<String, Object> row = (Map<String, Object>) value;
            String kind = text(row, "PAY_KD");
            Map<String, Object> saved = original.stream().filter(item -> kind.equals(text(item, "PAY_KD"))).findFirst().orElse(Map.of());
            if (!PAYMENT_KINDS.contains(kind)) {
                if (saved.isEmpty()) fail("예상 결제항목을 확인해 주세요.");
                continue;
            }
            if (!seen.add(kind)) fail("예상 결제항목을 확인해 주세요.");
            BigDecimal amount = estimateAmount(row, "PAY_AMT");
            if (amount.compareTo(estimateAmount(row, "PRE_PAY_AMT")) != 0) fail("예상 결제금액이 일치하지 않습니다.");
            if (("Y".equals(text(saved, "PAY_ST")) || !text(saved, "PAY_DT").isEmpty())
                    && (amount.compareTo(number(saved, "PAY_AMT")) != 0 || ("BOND".equals(kind)
                        && estimateAmount(row, "REAL_ALOAN").compareTo(number(saved, "REAL_ALOAN")) != 0))) fail("납부 완료된 결제정보는 변경할 수 없습니다.");
            if ("FEE".equals(kind)) {
                Map<String, Object> fee = workCp.containsKey("FEE") ? workCp : saved;
                if (!fee.isEmpty() && amount.compareTo(number(fee, workCp.containsKey("FEE") ? "FEE" : "PAY_AMT")) != 0) fail("등록수수료가 서버 기준값과 다릅니다.");
            }
            Map<String, Object> payment = new HashMap<>(saved);
            payment.put("PAY_KD", kind); payment.put("PRE_PAY_AMT", amount); payment.put("PAY_AMT", amount);
            payment.putIfAbsent("PAY_OP", "Y"); payment.putIfAbsent("PAY_ST", "N");
            if ("BOND".equals(kind)) { payment.put("REAL_ALOAN", estimateAmount(row, "REAL_ALOAN")); car.put("BOND_AMT", amount); }
            payments.add(payment);
            if (!("ACQ".equals(kind) && "Y".equals(text(car, "CARD_YN")))) total = total.add(amount);
        }
        if (!seen.equals(PAYMENT_KINDS)) fail("예상 결제항목이 누락되었습니다.");
        original.stream().filter(row -> !PAYMENT_KINDS.contains(text(row, "PAY_KD"))).forEach(row -> payments.add(new HashMap<>(row)));
        String applyCode = text(estimate, "NTAX_APPLC_CD");
        if (!Set.of("0", "11").contains(applyCode)) fail("비과세 적용구분을 확인해 주세요.");
        car.put("NTAX_APPLC_CD", applyCode); car.put("STANDARD_AMT", number(car, "BUY_AMT"));
        car.put("PREREG_AMT", total); car.put("TOTAL_AMT", total);
        return payments;
    }
    private static BigDecimal estimateAmount(Map<String, Object> row, String name) {
        if (text(row, name).isEmpty()) fail("예상 결제금액이 누락되었습니다.");
        BigDecimal amount = number(row, name);
        if (amount.signum() < 0 || amount.stripTrailingZeros().scale() > 0 || amount.compareTo(new BigDecimal("999999999999999")) > 0) fail("예상 결제금액을 확인해 주세요.");
        return amount;
    }
}
