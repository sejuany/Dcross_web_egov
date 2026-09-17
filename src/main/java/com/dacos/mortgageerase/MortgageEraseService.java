package com.dacos.mortgageerase;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.Locale;
import java.util.regex.Pattern;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;

import com.fasterxml.jackson.databind.JsonNode;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.common.CommonService;
import com.dacos.mortgageerase.dto.MortgageEraseSearchRequest;
import com.dacos.mortgageerase.mapper.MortgageEraseMapper;

/** 저당말소 서비스 */
@Service
public class MortgageEraseService {

    private static final Logger logger = LoggerFactory.getLogger(MortgageEraseService.class);
    private static final Pattern VEHICLE_NUMBER_PATTERN = Pattern.compile(
            "^(?:(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\\d{1,2}[가-힣]\\d{4}|\\d{2,3}[가-힣]\\d{4})$");
    private static final Pattern VEHICLE_IDENTIFICATION_NUMBER_PATTERN = Pattern.compile("^[A-HJ-NPR-Z0-9]{17}$");
    private static final List<String> MORTGAGE_ERASE_LINK_FIELDS = List.of(
            "SERVICE_ID", "WORK_CD", "CAR_NO", "MORT_NM", "REG_GB", "REG_NO",
            "BOND_AMT", "PROC_ST", "COMPANY_ID", "MEMBER_ID", "REQUEST_DT",
            "EULBU_NO", "CARID_NO", "CAR_NM", "CAR_KD", "CAR_US", "CAR_YY",
            "CARREG_DT", "MORT_CT", "DIST_CT", "COMPANY_NM", "COMPANY_NO",
            "PAY_GB", "PAY_ME", "GOVT_ID");
    private static final Map<String, Map<String, String>> MANUAL_REQUEST_IDENTITIES = Map.of(
            "CC005", Map.of(
                    "COMPANY_ID", "CC005", "MEMBER_ID", "shinhan", "MEMBER_NM", "신한카드",
                    "BRANCH_ID", "1", "SANGSA_ID", "", "ASSOCIATION_ID", "A0001", "GOVT_ID", "HAMYA"),
            "CB035", Map.of(
                    "COMPANY_ID", "CB035", "MEMBER_ID", "hanacall", "MEMBER_NM", "하나콜",
                    "BRANCH_ID", "1", "SANGSA_ID", "", "ASSOCIATION_ID", "A0001", "GOVT_ID", "CHANG"),
            "CB025", Map.of(
                    "COMPANY_ID", "CB025", "MEMBER_ID", "ajuadmin", "MEMBER_NM", "아주관리자",
                    "BRANCH_ID", "1", "SANGSA_ID", "", "ASSOCIATION_ID", "A0001", "GOVT_ID", "HAMYA"));

    private final MortgageEraseMapper mortgageEraseMapper;
    private final CommonService commonService;

    public MortgageEraseService(MortgageEraseMapper mortgageEraseMapper, CommonService commonService) {
        this.mortgageEraseMapper = mortgageEraseMapper;
        this.commonService = commonService;
    }

    public List<Map<String, Object>> getMortgageEraseList(
            MortgageEraseSearchRequest request,
            UserDto user) {
        applyLegacyListScope(request, user);
        logger.info("[MortgageEraseService] 저당말소 목록 조회 - 기간: {} ~ {}, 권한: {}, 회사: {}",
                request.getSTART_DT(), request.getEND_DT(), user.getMEMBER_GB(), request.getCOMPANY_ID());
        return mortgageEraseMapper.getMortgageEraseList(request);
    }

    private void applyLegacyListScope(MortgageEraseSearchRequest request, UserDto user) {
        String memberGb = upper(user.getMEMBER_GB());
        String companyId = trim(user.getCOMPANY_ID());
        String companyIdKey = companyId.toUpperCase();
        boolean dacosUser = memberGb.startsWith("U");
        boolean govtUser = "GU".equals(memberGb);

        request.setWORK_CD("001");
        request.setMEMBER_ID(trim(user.getLOGIN_ID()));
        request.setMEMBER_IDS(trim(user.getLOGIN_ID()).toLowerCase());
        request.setINCLUDE_CAR_INFO("CB026".equals(companyIdKey) ? "Y" : "");

        if (dacosUser || govtUser) {
            request.setCOMPANY_ID(trim(request.getCOMPANY_ID()));
            request.setBRANCH_ID("");
            request.setSANGSA_ID("");
        } else if ("CA".equals(memberGb)) {
            request.setCOMPANY_ID(companyId);
            request.setBRANCH_ID("");
            request.setSANGSA_ID("");
        } else {
            request.setCOMPANY_ID(companyId);
            request.setBRANCH_ID(trim(user.getBRANCH_ID()));
            request.setSANGSA_ID(trim(user.getSANGSA_ID()));
        }

        if (govtUser) {
            request.setGOVT_ID(companyId);
            request.setPROC_ST("");
            request.setORDERBY("ASC");
        } else {
            request.setJUDGE_ST("");
            request.setREAD_YN("");
            request.setORDERBY("");
        }

        if (!dacosUser && !govtUser) {
            request.setAUTO_YN("");
        }

        if ("UU".equals(memberGb) && isBlank(request.getCAR_NO()) && isBlank(request.getPAY_NM())) {
            throw new BusinessException("조회 조건을 입력하셔야 합니다.");
        }
    }

    public int switchSelectedToManual(Object serviceIdsValue, UserDto user) {
        String memberGb = upper(user.getMEMBER_GB());
        String companyId = upper(user.getCOMPANY_ID());
        if (!"HAMYA".equals(companyId)
                || (!(memberGb.startsWith("U") || "GU".equals(memberGb)) || "UU".equals(memberGb))) {
            throw new BusinessException("수동 변경 권한이 없습니다.", 403);
        }

        List<String> serviceIds = toServiceIds(serviceIdsValue);
        if (serviceIds.isEmpty()) {
            throw new BusinessException("수동 변경할 항목을 선택해 주세요.");
        }

        int updatedCount = 0;
        for (String serviceId : serviceIds) {
            Map<String, Object> target = mortgageEraseMapper.getManualTarget(serviceId);
            if (target == null || !"HAMYA".equals(upper(Objects.toString(target.get("GOVT_ID"), "")))) {
                throw new BusinessException("수동 변경할 수 없는 접수번호입니다: " + serviceId, 409);
            }

            Map<String, Object> link = new HashMap<>();
            link.put("SID", "자동수동처리");
            link.put("SERVICE_ID", serviceId);
            link.put("GOVT_ID", "HAMYA");
            link.put("AUTO_YN", "N");
            JsonNode response = commonService.linkServer(link);
            if (!"0".equals(response.path("errorCode").asText())) {
                throw new BusinessException("관청 수동처리 전환에 실패했습니다: " + serviceId, 502);
            }

            Map<String, Object> update = new HashMap<>();
            update.put("SERVICE_ID", serviceId);
            update.put("UPD_USER", user.getLOGIN_ID());
            updatedCount += mortgageEraseMapper.updateManualProcessing(update);
        }

        return updatedCount;
    }

    private List<String> toServiceIds(Object value) {
        List<String> result = new ArrayList<>();
        if (!(value instanceof List<?> values)) {
            return result;
        }
        for (Object item : values) {
            String serviceId = trim(Objects.toString(item, ""));
            if (!serviceId.isEmpty() && !result.contains(serviceId)) {
                result.add(serviceId);
            }
        }
        return result;
    }

    public Map<String, Object> getMortgageEraseDetail(String serviceId, UserDto user) {
        logger.info("[MortgageEraseService] 저당말소 상세 조회 - serviceId: {}", serviceId);
        Map<String, Object> service = mortgageEraseMapper.getMortgageEraseDetail(serviceId);
        if (service == null || service.isEmpty()) {
            throw new BusinessException("해당 서비스 ID의 데이터를 찾을 수 없습니다: " + serviceId, 404);
        }
        assertCanAccess(service, user);
        Map<String, Object> result = new HashMap<>();
        result.put("service", service);
        result.put("mortgage", nullToMap(mortgageEraseMapper.getMortgageEraseMortgage(serviceId)));
        result.put("carInfo", nullToMap(mortgageEraseMapper.getMortgageEraseCarInfo(serviceId)));
        result.put("payments", mortgageEraseMapper.getMortgageErasePayments(serviceId));
        result.put("company", nullToMap(mortgageEraseMapper.getMortgageEraseCompany(
                Objects.toString(service.get("COMPANY_ID"), ""))));
        result.put("workCp", nullToMap(mortgageEraseMapper.getMortgageEraseWorkCp(
                Objects.toString(service.get("COMPANY_ID"), ""))));
        return result;
    }

    public Map<String, Object> initMortgageEraseRequest(UserDto user) {
        if ("GU".equals(upper(user.getMEMBER_GB()))) {
            throw new BusinessException("관청 사용자는 신규 말소 신청을 등록할 수 없습니다.", 403);
        }
        Map<String, String> identity = new HashMap<>();
        identity.put("COMPANY_ID", trim(user.getCOMPANY_ID()));
        identity.put("MEMBER_ID", trim(user.getLOGIN_ID()));
        identity.put("MEMBER_NM", trim(user.getMEMBER_NM()));
        identity.put("ASSOCIATION_ID", trim(user.getASSOCIATION_ID()));
        identity.put("BRANCH_ID", trim(user.getBRANCH_ID()));
        identity.put("SANGSA_ID", trim(user.getSANGSA_ID()));
        return buildRequestInit(identity, null);
    }

    public Map<String, Object> initManualMortgageEraseRequest(String companyId, UserDto user) {
        Map<String, String> identity = getManualRequestIdentity(companyId, user);
        return buildRequestInit(identity, identity.get("GOVT_ID"));
    }

    private Map<String, Object> buildRequestInit(Map<String, String> identity, String govtIdOverride) {
        String companyId = identity.get("COMPANY_ID");
        Map<String, Object> result = new HashMap<>();
        Map<String, Object> company = nullToMap(mortgageEraseMapper.getMortgageEraseCompany(companyId));
        Map<String, Object> workCp = nullToMap(mortgageEraseMapper.getMortgageEraseWorkCp(companyId));
        Map<String, Object> tax = nullToMap(mortgageEraseMapper.getMortgageEraseTax());
        if (company.isEmpty() || workCp.isEmpty()) {
            throw new BusinessException("저당말소 회사 및 결제 정보를 찾을 수 없습니다.");
        }
        result.put("company", company);
        result.put("workCp", workCp);
        result.put("tax", tax);
        result.put("service", new HashMap<>(Map.of(
                "WORK_CD", "001", "COMPANY_ID", companyId,
                "MEMBER_ID", identity.get("MEMBER_ID"), "MEMBER_NM", identity.get("MEMBER_NM"),
                "PROC_ST", "INPUT", "ASSOCIATION_ID", identity.get("ASSOCIATION_ID"),
                "GOVT_ID", govtIdOverride == null ? Objects.toString(workCp.get("GOVT_ID"), "") : govtIdOverride,
                "BRANCH_ID", identity.get("BRANCH_ID"), "SANGSA_ID", identity.get("SANGSA_ID"))));
        return result;
    }

    public JsonNode getLinkedCarInfo(Map<String, Object> request, UserDto user) {
        return getLinkedCarInfoForCompany(request, trim(user.getCOMPANY_ID()), null);
    }

    public JsonNode getManualLinkedCarInfo(Map<String, Object> request, UserDto user) {
        Map<String, String> identity = getManualRequestIdentity(
                Objects.toString(request.get("COMPANY_ID"), ""), user);
        return getLinkedCarInfoForCompany(request, identity.get("COMPANY_ID"), identity.get("GOVT_ID"));
    }

    private JsonNode getLinkedCarInfoForCompany(
            Map<String, Object> request, String companyId, String govtIdOverride) {
        String carNo = normalizeCarIdentifier(request.get("CAR_NO"));
        validateCarIdentifier(carNo);
        Map<String, Object> company = mortgageEraseMapper.getMortgageEraseCompany(companyId);
        if (company == null || company.isEmpty()) {
            throw new BusinessException("저당권자 회사 정보를 찾을 수 없습니다.");
        }
        List<Map<String, Object>> companyHistory = mortgageEraseMapper.getMortgageEraseCompanyHistory(
                companyId, Objects.toString(company.get("ASSOCIATION_ID"), ""));
        Map<String, Object> link = new HashMap<>(request);
        link.put("SID", "말소가능여부");
        link.put("CAR_NO", carNo);
        String bondAmount = Objects.toString(request.get("BOND_AMT"), "").trim();
        link.put("BOND_AMT", "0".equals(bondAmount) ? "" : bondAmount);
        link.put("GOVT_ID", govtIdOverride == null
                ? Objects.toString(request.get("GOVT_ID"), "") : govtIdOverride);
        link.put("COMPANY_ID", companyId);
        link.put("BIZ_NO", joinCompanyHistory(companyHistory, "BIZ_NO"));
        link.put("COMPANY_NO", joinCompanyHistory(companyHistory, "COMPANY_NO"));
        link.put("COMPANY_NM", joinCompanyHistory(companyHistory, "COMPANY_NM"));
        JsonNode response = commonService.linkServer(link);
        if (!"0".equals(response.path("errorCode").asText())) {
            throw new BusinessException("관청 차량정보 연계에 실패했습니다.", 502);
        }
        return response.path("returnMSG");
    }

    private String joinCompanyHistory(List<Map<String, Object>> companyHistory, String column) {
        StringBuilder result = new StringBuilder();
        for (Map<String, Object> row : companyHistory) {
            result.append(Objects.toString(row.get(column), "")).append('/');
        }
        return result.toString();
    }

    private Map<String, Object> buildMortgageEraseLinkRequest(
            Map<String, Object> merged, String serviceId) {
        String companyId = trim(Objects.toString(merged.get("COMPANY_ID"), ""));
        Map<String, Object> company = mortgageEraseMapper.getMortgageEraseCompany(companyId);
        if (company == null || company.isEmpty()) {
            throw new BusinessException("저당권자 회사 정보를 찾을 수 없습니다.");
        }
        List<Map<String, Object>> companyHistory = mortgageEraseMapper.getMortgageEraseCompanyHistory(
                companyId, Objects.toString(company.get("ASSOCIATION_ID"), ""));

        Map<String, Object> source = new HashMap<>(merged);
        source.put("SERVICE_ID", serviceId);
        source.put("WORK_CD", "001");
        source.put("COMPANY_NO", Objects.toString(company.get("COMPANY_NO"), ""));
        source.put("COMPANY_NM", joinCompanyHistory(companyHistory, "COMPANY_NM"));

        Map<String, Object> link = new LinkedHashMap<>();
        for (String field : MORTGAGE_ERASE_LINK_FIELDS) {
            link.put(field, Objects.toString(source.get(field), ""));
        }
        link.put("SID", "말소신청");
        return link;
    }

    @Transactional
    public Map<String, Object> processMortgageErase(Map<String, Object> request, UserDto user) {
        return processMortgageErase(request, user, null);
    }

    @Transactional
    public Map<String, Object> processManualMortgageErase(Map<String, Object> request, UserDto user) {
        Map<String, Object> requestedService = map(request.get("service"));
        Map<String, String> identity = getManualRequestIdentity(
                Objects.toString(requestedService.get("COMPANY_ID"), ""), user);
        String serviceId = trim(Objects.toString(requestedService.get("SERVICE_ID"), ""));
        if (!serviceId.isEmpty()) {
            Map<String, Object> existing = mortgageEraseMapper.getMortgageEraseDetail(serviceId);
            if (existing == null) throw new BusinessException("수정할 신청을 찾을 수 없습니다.", 404);
            assertCanAccess(existing, user);
            if (!identity.get("COMPANY_ID").equals(upper(Objects.toString(existing.get("COMPANY_ID"), "")))) {
                throw new BusinessException("신청 회사는 변경할 수 없습니다.", 409);
            }
        }
        return processMortgageErase(request, user, identity);
    }

    private Map<String, Object> processMortgageErase(
            Map<String, Object> request, UserDto user, Map<String, String> manualIdentity) {
        Map<String, Object> service = map(request.get("service"));
        Map<String, Object> mortgage = map(request.get("mortgage"));
        Map<String, Object> carInfo = map(request.get("carInfo"));
        List<Map<String, Object>> payments = list(request.get("payments"));
        if ("GU".equals(upper(user.getMEMBER_GB()))) {
            return processGovernmentJudge(service, user);
        }
        String requestedStatus = upper(Objects.toString(service.get("PROC_ST"), "SAV"));
        if (!("SAV".equals(requestedStatus) || "REQ".equals(requestedStatus) || "RET".equals(requestedStatus))) {
            throw new BusinessException("처리할 수 없는 신청 상태입니다.");
        }
        String carNo = normalizeCarIdentifier(mortgage.get("CAR_NO"));
        validateCarIdentifier(carNo);

        service.put("WORK_CD", "001");
        service.put("CAR_NO", carNo);
        String businessMemberId = manualIdentity == null
                ? trim(user.getLOGIN_ID()) : manualIdentity.get("MEMBER_ID");
        service.put("MEMBER_ID", businessMemberId);
        service.put("COMPANY_ID", manualIdentity == null
                ? trim(user.getCOMPANY_ID()) : manualIdentity.get("COMPANY_ID"));
        service.put("ASSOCIATION_ID", manualIdentity == null
                ? trim(user.getASSOCIATION_ID()) : manualIdentity.get("ASSOCIATION_ID"));
        service.put("BRANCH_ID", manualIdentity == null
                ? trim(user.getBRANCH_ID()) : manualIdentity.get("BRANCH_ID"));
        service.put("SANGSA_ID", manualIdentity == null
                ? trim(user.getSANGSA_ID()) : manualIdentity.get("SANGSA_ID"));
        if (manualIdentity != null) service.put("GOVT_ID", manualIdentity.get("GOVT_ID"));
        service.put("UPD_USER", trim(user.getLOGIN_ID()));
        service.putIfAbsent("JUDGE_ST", "");
        service.putIfAbsent("RETURN_TX", "");
        service.putIfAbsent("AUTO_YN", "");
        service.putIfAbsent("LINK_ID", "");
        if ("REQ".equals(requestedStatus) && "B".equals(upper(Objects.toString(mortgage.get("PAY_GB"), "")))) {
            service.put("JUDGE_ST", "");
        } else if ("REQ".equals(requestedStatus)) {
            service.put("JUDGE_ST", "S_REQ");
        }

        Map<String, Object> merged = new HashMap<>();
        merged.putAll(service);
        merged.putAll(mortgage);
        merged.putAll(carInfo);
        merged.put("MEMBER_ID", businessMemberId);
        merged.put("LOGIN_ID", businessMemberId);
        merged.put("CAR_NO", carNo);
        merged.putIfAbsent("PAY_ST", "N");
        merged.putIfAbsent("PAY_DT", null);
        merged.putIfAbsent("WONBU_ST", "");
        merged.putIfAbsent("MORT_NM", "");
        merged.putIfAbsent("REG_GB", "");
        merged.putIfAbsent("REG_NO", "");
        merged.putIfAbsent("BIZ_NO", "");
        merged.putIfAbsent("PAY_NM", "");
        merged.putIfAbsent("PAY_HP_NO", "");
        merged.putIfAbsent("PAY_ME", "B");
        merged.putIfAbsent("PAY_GB", "A");
        merged.putIfAbsent("TOTAL_AMT", 0);
        merged.putIfAbsent("BOND_AMT", 0);

        String serviceId = trim(Objects.toString(service.get("SERVICE_ID"), ""));
        if (serviceId.isEmpty()) {
            serviceId = "M001-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyMMdd"))
                    + "-" + mortgageEraseMapper.nextServiceSequence();
            merged.put("SERVICE_ID", serviceId);
            mortgageEraseMapper.insertMortgageEraseService(merged);
            mortgageEraseMapper.insertMortgageEraseMortgage(merged);
            mortgageEraseMapper.insertMortgageEraseCarInfo(merged);
        } else {
            Map<String, Object> existing = mortgageEraseMapper.getMortgageEraseDetail(serviceId);
            if (existing == null) throw new BusinessException("수정할 신청을 찾을 수 없습니다.", 404);
            assertCanAccess(existing, user);
            String current = upper(Objects.toString(existing.get("PROC_ST"), ""));
            if ("REQ".equals(requestedStatus) && !("SAV".equals(current) || "INPUT".equals(current) || "C_REQ".equals(current))) {
                throw new BusinessException("이미 처리 중인 신청입니다.", 409);
            }
            merged.put("SERVICE_ID", serviceId);
            mortgageEraseMapper.updateMortgageEraseService(merged);
            mortgageEraseMapper.updateMortgageEraseMortgage(merged);
            mortgageEraseMapper.updateMortgageEraseCarInfo(merged);
            mortgageEraseMapper.deleteMortgageErasePayments(serviceId);
        }
        for (Map<String, Object> payment : payments) {
            Map<String, Object> row = new HashMap<>(payment);
            row.put("SERVICE_ID", serviceId);
            row.put("MEMBER_ID", businessMemberId);
            row.putIfAbsent("PAY_AMT", 0);
            row.putIfAbsent("PAY_ST", "N");
            row.putIfAbsent("PAY_OP", "");
            mortgageEraseMapper.insertMortgageErasePayment(row);
        }

        if ("REQ".equals(requestedStatus)) {
            if ("B".equals(upper(Objects.toString(merged.get("PAY_GB"), "")))
                    && "B".equals(upper(Objects.toString(merged.get("PAY_ME"), "")))) {
                Map<String, Object> vbank = new HashMap<>();
                vbank.put("pInput", serviceId);
                vbank.put("pReturn", "");
                mortgageEraseMapper.processMortgageEraseVBank(vbank);
                if (trim(Objects.toString(vbank.get("pReturn"), "")).isEmpty()
                        || "FAIL".equalsIgnoreCase(Objects.toString(vbank.get("pReturn"), ""))) {
                    throw new BusinessException("가상계좌 생성에 실패했습니다.");
                }
            }
            Map<String, Object> link = buildMortgageEraseLinkRequest(merged, serviceId);
            JsonNode response = commonService.linkServer(link);
            if (!"0".equals(response.path("errorCode").asText())
                    || "-1".equals(response.path("returnMSG").path("code").asText())) {
                String message = response.path("returnMSG").path("message").asText("관청서버와 통신 중 오류가 발생하였습니다.");
                throw new BusinessException(message, 502);
            }
        }
        return getMortgageEraseDetail(serviceId, user);
    }

    private Map<String, String> getManualRequestIdentity(String companyId, UserDto user) {
        if (!upper(user.getMEMBER_GB()).startsWith("U")) {
            throw new BusinessException("말소수동신청 권한이 없습니다.", 403);
        }
        Map<String, String> identity = MANUAL_REQUEST_IDENTITIES.get(upper(companyId));
        if (identity == null) {
            throw new BusinessException("수동신청 회사를 선택해 주세요.");
        }
        return identity;
    }

    private Map<String, Object> processGovernmentJudge(Map<String, Object> service, UserDto user) {
        String serviceId = trim(Objects.toString(service.get("SERVICE_ID"), ""));
        Map<String, Object> existing = mortgageEraseMapper.getMortgageEraseDetail(serviceId);
        if (existing == null) throw new BusinessException("심사할 신청을 찾을 수 없습니다.", 404);
        assertCanAccess(existing, user);
        String judgeStatus = upper(Objects.toString(service.get("JUDGE_ST"), ""));
        if (!"RET".equals(judgeStatus)) {
            throw new BusinessException("반려 상태로 변경한 경우에만 저장할 수 있습니다.");
        }
        Map<String, Object> update = new HashMap<>();
        update.put("SERVICE_ID", serviceId);
        update.put("JUDGE_ST", judgeStatus);
        update.put("RETURN_TX", Objects.toString(service.get("RETURN_TX"), ""));
        update.put("MEMBER_ID", user.getLOGIN_ID());
        mortgageEraseMapper.updateMortgageEraseService(update);
        return getMortgageEraseDetail(serviceId, user);
    }

    @Transactional
    public void deleteMortgageErase(Map<String, Object> request, UserDto user) {
        String serviceId = trim(Objects.toString(request.get("SERVICE_ID"), ""));
        Map<String, Object> existing = mortgageEraseMapper.getMortgageEraseDetail(serviceId);
        if (existing == null) throw new BusinessException("삭제할 신청을 찾을 수 없습니다.", 404);
        assertCanAccess(existing, user);
        String status = upper(Objects.toString(existing.get("PROC_ST"), ""));
        if (List.of("S_REQ", "S_END", "J_REQ", "J_END", "END", "RET").contains(status)) {
            throw new BusinessException("현재 상태에서는 삭제할 수 없습니다.");
        }
        Map<String, Object> update = new HashMap<>();
        update.put("SERVICE_ID", serviceId);
        update.put("PROC_ST", "DEL");
        update.put("MEMBER_ID", user.getLOGIN_ID());
        mortgageEraseMapper.updateMortgageEraseService(update);
    }

    public int sendMortgageEraseSms(Map<String, Object> request, UserDto user) {
        String serviceId = trim(Objects.toString(request.get("SERVICE_ID"), ""));
        Map<String, Object> existing = mortgageEraseMapper.getMortgageEraseDetail(serviceId);
        if (existing == null) throw new BusinessException("신청 정보를 찾을 수 없습니다.", 404);
        assertCanAccess(existing, user);
        String phone = Objects.toString(request.get("PAY_HP_NO"), "").replaceAll("[^0-9]", "");
        if (phone.length() < 11) throw new BusinessException("휴대폰번호를 정확히 입력해 주세요.");
        Map<String, Object> sms = new HashMap<>(request);
        sms.put("PAY_HP_NO", phone);
        sms.put("MEMBER_ID", user.getLOGIN_ID());
        mortgageEraseMapper.updateMortgageEraseSmsInfo(sms);
        sms.put("MSG_TYPE", "3");
        sms.put("SUBJECT", "저당말소 입금안내");
        return commonService.sendSms(sms);
    }

    /**
     * 다건말소 Excel 양식을 화면용 행 데이터로 변환한다.
     * 레거시 양식 순서: 차량번호, 휴대폰번호, 결제자명, 채권가액, 수수료 월납(Y/N)
     */
    public List<Map<String, Object>> readMortgageEraseGroupRows(MultipartFile file, UserDto user) {
        if ("GU".equals(upper(user.getMEMBER_GB()))) {
            throw new BusinessException("관청 사용자는 다건 말소 신청을 등록할 수 없습니다.", 403);
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException("Excel 파일을 선택해 주세요.");
        }

        Map<String, Object> workCp = nullToMap(
                mortgageEraseMapper.getMortgageEraseWorkCp(trim(user.getCOMPANY_ID())));
        String defaultPayType = upper(Objects.toString(workCp.get("PAYMENT_TP"), "GUN"));
        if (!("GUN".equals(defaultPayType) || "MON".equals(defaultPayType))) {
            defaultPayType = "GUN";
        }

        List<Map<String, Object>> result = new ArrayList<>();
        Set<String> carAndBondKeys = new HashSet<>();
        DataFormatter formatter = new DataFormatter();
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            for (int index = 1; index <= sheet.getLastRowNum(); index++) {
                Row excelRow = sheet.getRow(index);
                String carNo = excelCell(formatter, excelRow, 0).replaceAll("\\s", "");
                String phone = excelCell(formatter, excelRow, 1);
                String payerName = excelCell(formatter, excelRow, 2);
                String bondAmount = excelCell(formatter, excelRow, 3).replace(",", "");
                String monthly = upper(excelCell(formatter, excelRow, 4));

                if (carNo.isEmpty() && phone.isEmpty() && payerName.isEmpty()
                        && bondAmount.isEmpty() && monthly.isEmpty()) {
                    continue;
                }
                if (result.size() >= 100) {
                    throw new BusinessException("다건말소 Excel은 최대 100건까지 업로드할 수 있습니다.");
                }

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("CAR_NO", carNo);
                row.put("MPHONE_NO", phone);
                row.put("PAY_NM", payerName);
                row.put("BOND_AMT", bondAmount);
                row.put("PAY_TP", "Y".equals(monthly) ? "MON" : defaultPayType);
                row.put("CHK", true);
                row.put("NOT_CHK", false);
                row.put("PROC_TX", "");

                String duplicateKey = carNo + "\u0000" + bondAmount;
                if (carNo.length() < 7) {
                    row.put("CHK", false);
                    row.put("NOT_CHK", true);
                    row.put("PROC_TX", "차량번호 누락");
                } else if (!carAndBondKeys.add(duplicateKey)) {
                    row.put("CHK", false);
                    row.put("NOT_CHK", true);
                    row.put("PROC_TX", "중복된 차량번호와 채권가액");
                }
                result.add(row);
            }
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException("Excel 파일을 읽을 수 없습니다: " + exception.getMessage());
        }

        if (result.isEmpty()) {
            throw new BusinessException("Excel 파일에 다건말소 신청 데이터가 없습니다.");
        }
        return result;
    }

    private String excelCell(DataFormatter formatter, Row row, int cellIndex) {
        Cell cell = row == null ? null : row.getCell(cellIndex);
        return cell == null ? "" : formatter.formatCellValue(cell).trim();
    }

    public List<Map<String, Object>> searchReceipts(MultipartFile file, String startDate,
            String endDate, String dayGb, UserDto user) {
        if (!upper(user.getMEMBER_GB()).startsWith("U")) {
            throw new BusinessException("영수증 다건조회 권한이 없습니다.", 403);
        }
        List<String> carNos = readCarNumbers(file);
        if (carNos.isEmpty()) throw new BusinessException("Excel 파일에 차량번호가 없습니다.");
        Map<String, Object> params = new HashMap<>();
        params.put("carNos", carNos);
        params.put("START_DT", startDate.replaceAll("[^0-9]", ""));
        params.put("END_DT", endDate.replaceAll("[^0-9]", ""));
        params.put("DAY_GB", List.of("TS.REQUEST_DT", "TS.PROC_DT", "TM.PAY_DT").contains(dayGb)
                ? dayGb : "TS.REQUEST_DT");
        return mortgageEraseMapper.getMortgageEraseReceipts(params);
    }

    private List<String> readCarNumbers(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new BusinessException("Excel 파일을 선택해 주세요.");
        List<String> result = new ArrayList<>();
        DataFormatter formatter = new DataFormatter();
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            int maxRow = Math.min(sheet.getLastRowNum(), 101);
            for (int index = 1; index <= maxRow; index++) {
                Row row = sheet.getRow(index);
                Cell cell = row == null ? null : row.getCell(0);
                String value = cell == null ? "" : formatter.formatCellValue(cell).trim();
                if (!value.isEmpty() && !result.contains(value)) result.add(value);
            }
        } catch (Exception exception) {
            throw new BusinessException("Excel 파일을 읽을 수 없습니다: " + exception.getMessage());
        }
        return result;
    }

    private void assertCanAccess(Map<String, Object> service, UserDto user) {
        String gb = upper(user.getMEMBER_GB());
        if (gb.startsWith("U")) return;
        String serviceCompany = upper(Objects.toString(service.get("COMPANY_ID"), ""));
        if ("GU".equals(gb)) {
            if (!upper(user.getCOMPANY_ID()).equals(upper(Objects.toString(service.get("GOVT_ID"), "")))) {
                throw new BusinessException("해당 신청에 접근할 수 없습니다.", 403);
            }
            return;
        }
        if (!upper(user.getCOMPANY_ID()).equals(serviceCompany)) {
            throw new BusinessException("해당 신청에 접근할 수 없습니다.", 403);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> ? new HashMap<>((Map<String, Object>) value) : new HashMap<>();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> list(Object value) {
        return value instanceof List<?> ? (List<Map<String, Object>>) value : new ArrayList<>();
    }

    private Map<String, Object> nullToMap(Map<String, Object> value) {
        return value == null ? new HashMap<>() : value;
    }

    public List<Map<String, Object>> getMortgageEraseGroupList(MortgageEraseSearchRequest request) {
        logger.info("[MortgageEraseService] 다건말소 목록 조회");
        return mortgageEraseMapper.getMortgageEraseGroupList(request);
    }

    private String upper(String value) {
        return trim(value).toUpperCase();
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isBlank(String value) {
        return trim(value).isEmpty();
    }

    private String normalizeCarIdentifier(Object value) {
        return Objects.toString(value, "").replaceAll("\\s", "").toUpperCase(Locale.ROOT);
    }

    private void validateCarIdentifier(String value) {
        if (value.isEmpty()) {
            throw new BusinessException("차량번호 또는 차대번호를 입력해 주세요.");
        }
        if (value.length() > 17
                || !(VEHICLE_NUMBER_PATTERN.matcher(value).matches()
                || VEHICLE_IDENTIFICATION_NUMBER_PATTERN.matcher(value).matches())) {
            throw new BusinessException("차량번호 형식 또는 영문·숫자 17자리 차대번호인지 확인해 주세요.");
        }
    }
}
