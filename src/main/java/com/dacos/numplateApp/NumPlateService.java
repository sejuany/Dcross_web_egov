package com.dacos.numplateApp;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.common.CommonService;
import com.dacos.numplateApp.dto.NumPlateSearchRequest;
import com.dacos.numplateApp.mapper.NumPlateMapper;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * 번호판 앱의 인증, 조회 범위 제한, 입력 검증과 처리 상태 변경을 담당한다.
 * 컨트롤러가 받은 값은 이 계층에서 다시 검증한 뒤 MyBatis 매퍼로 전달한다.
 */
@Service
public class NumPlateService {

    private static final Logger logger = LoggerFactory.getLogger(NumPlateService.class);

    private final NumPlateMapper numPlateMapper;
    private final CommonService commonService;

    public NumPlateService(NumPlateMapper numPlateMapper, CommonService commonService) {
        this.numPlateMapper = numPlateMapper;
        this.commonService = commonService;
    }

    public UserDto loginManager(Map<String, Object> request) {
        String phone = Objects.toString(request.get("phone"), "").replaceAll("[^0-9]", "");
        String password = Objects.toString(request.get("password"), "");
        if (phone.length() < 8 || phone.length() > 11 || password.isBlank() || password.length() > 100) {
            throw new BusinessException("휴대폰 번호 또는 비밀번호를 확인해 주세요.", 401);
        }

        // 비밀번호를 SQL 파라미터나 SQL 로그에 남기지 않고 애플리케이션에서 비교한다.
        List<Map<String, Object>> managers = numPlateMapper.loginManager(Map.of("TEL_NO", phone));
        List<Map<String, Object>> matchedManagers = managers.stream()
                .filter(manager -> passwordMatches(password, Objects.toString(manager.get("ETC6"), "")))
                .toList();
        if (matchedManagers.size() != 1) {
            throw new BusinessException("휴대폰 번호 또는 비밀번호를 확인해 주세요.", 401);
        }

        Map<String, Object> manager = matchedManagers.get(0);
        UserDto user = new UserDto();
        user.setLOGIN_ID(Objects.toString(manager.get("TEL_NO"), phone));
        user.setLOGIN_GB("NUMPLATE_APP");
        user.setMEMBER_NM(Objects.toString(manager.get("MANAGER_NM"), "번호판 담당자"));
        user.setCOMPANY_ID(Objects.toString(manager.get("COMPANY_ID"), ""));
        user.setCOMPANY_NM(Objects.toString(manager.get("COMPANY_NM"), ""));
        user.setMPHONE_NO(Objects.toString(manager.get("TEL_NO"), phone));
        user.setUSE_YN("Y");
        return user;
    }

    private boolean passwordMatches(String input, String stored) {
        // 단순 문자열 비교보다 타이밍 차이가 적은 상수 시간 비교를 사용한다.
        return MessageDigest.isEqual(
                input.getBytes(StandardCharsets.UTF_8),
                stored.getBytes(StandardCharsets.UTF_8));
    }

    public List<Map<String, Object>> getNumPlateList(NumPlateSearchRequest request) {
        logger.info("[NumPlateService] 번호판 목록 조회");
        return numPlateMapper.getNumPlateList(request);
    }

    public List<Map<String, Object>> getCarPaperList(NumPlateSearchRequest request) {
        return numPlateMapper.getCarPaperList(request);
    }

    public List<Map<String, Object>> getTemporaryNumPlateList(NumPlateSearchRequest request) {
        return numPlateMapper.getTempNumPlateList(request);
    }

    public List<Map<String, Object>> getSupplyList(NumPlateSearchRequest request) {
        return numPlateMapper.getNumPlateSupplyList(request);
    }

    public List<Map<String, Object>> getProcessList(Map<String, Object> request, UserDto user) {
        Map<String, Object> param = managerParam(user);
        String conditionType = Objects.toString(request.get("conditionType"), "");
        if (!"BUY_NM".equals(conditionType) && !"CAR_NO".equals(conditionType)) {
            conditionType = "";
        }
        String keyword = Objects.toString(request.get("keyword"), "").trim();
        if (keyword.length() > 50) throw new BusinessException("검색어는 50자 이하로 입력해 주세요.");
        if (keyword.isEmpty()) conditionType = "";
        // 기존 JSP 쿼리의 파라미터명을 유지해 조회 결과와 검색 동작을 동일하게 한다.
        param.put("cOPTION", conditionType);
        param.put("CONDITION", keyword);
        param.put("TODAY", Boolean.TRUE.equals(request.get("todayOnly")) ? "Y" : "");
        return numPlateMapper.getProcessList(param).stream().map(row -> {
            Map<String, Object> item = new HashMap<>(row);
            item.put("PROC_ST_NM", processStatusName(item));
            return item;
        }).toList();
    }

    public Map<String, Object> getProcessDetail(String serviceId, UserDto user) {
        // 접수번호뿐 아니라 로그인 담당자의 휴대폰 번호도 매퍼에 전달해 소유 건만 조회한다.
        Map<String, Object> param = managerParam(user);
        param.put("SERVICE_ID", validateServiceId(serviceId));
        Map<String, Object> found = numPlateMapper.getProcessDetail(param);
        if (found == null) throw new BusinessException("처리 건을 찾을 수 없습니다.", 404);
        Map<String, Object> detail = new HashMap<>(found);
        detail.put("PROC_ST_NM", processStatusName(detail));
        detail.put("CAN_SEARCH_NUMPLATE", canSearchPlate(user));
        return detail;
    }

    /** 기존 AttachController의 사진·카드·서명 진행 상태별 화면 문구를 반환한다. */
    private String processStatusName(Map<String, Object> row) {
        String status = Objects.toString(row.get("PROC_ST"), "");
        String task = Objects.toString(row.get("TASK_CD"), "");
        boolean transfer = Set.of("UTRNS", "RTRNS").contains(task);
        String name;

        if (imageMissing(row, "IMAGE1")) {
            name = switch (status) {
                case "SAV" -> "저장";
                case "RET" -> "반려";
                case "N_REQ", "N_INS", "N_DLV" -> "번호판처리요청";
                case "P_REQ", "P_END", "PREND", "PBEND" -> "배송요청";
                case "S_REQ" -> "심사요청";
                case "J_END", "P_RET", "A_RET", "END" -> "번호판사진등록요청";
                case "S_END", "D_MAN", "D_ING", "D_PAY", "D_REQ", "D_END", "D_DAC", "D_CON", "J_REQ" ->
                        "Y".equals(Objects.toString(row.get("CARD_YN"), ""))
                                && !"Y".equals(Objects.toString(row.get("CARD_PAY_YN"), ""))
                                ? "취득세카드납부중" : "번호판사진등록요청";
                case "" -> "지점배송요청"; 
                default -> "처리상태확인요망";
            };
            if ("CB407".equals(Objects.toString(row.get("COMPANY_ID"), ""))) name += "(전시장)";
            return name;
        }

        if (imageMissing(row, "IMAGE4")) {
            if (imageMissing(row, "IMAGE3")) return "번호판사진등록요청";
            if ("RET".equals(status)) return "반려";
            return transfer ? "서명 진행 전 신분증사진등록요청" : "신분증사진등록요청";
        }

        if ("SAV".equals(status)) return "저장";
        if ("RET".equals(status)) return "반려";
        if (Set.of("S_END", "D_ING", "D_MAN", "D_PAY", "D_CON", "J_REQ", "J_ING", "J_END", "P_RET", "A_RET", "END")
                .contains(status)) {
            if (transfer) return imageMissing(row, "IMAGE6") ? "서명 진행 요청" : "번호판사진등록완료";
            return "번호판사진등록완료";
        }
        return "처리상태확인요망";
    }

    private boolean imageMissing(Map<String, Object> row, String key) {
        return Objects.toString(row.get(key), "").isBlank()
                && Objects.toString(row.get(key + "_PATH"), "").isBlank();
    }

    /**
     * 기존 JSP의 번호판 선택창 열기/새로고침/검색 동작이다.
     * 프로시저가 반환한 '/' 구분 문자열을 React에서 쓰기 좋은 목록으로 바꾼다.
     */
    @Transactional
    public List<String> getAvailablePlates(String serviceId, Map<String, Object> request, UserDto user) {
        Map<String, Object> detail = getSelectablePlateDetail(serviceId, user);
        String search = Objects.toString(request.get("searchCarNo"), "").trim();
        if (!search.isEmpty() && !canSearchPlate(user)) {
            throw new BusinessException("번호판 검색 권한이 없습니다.", 403);
        }
        if (!search.matches("[0-9가-힣]{0,12}")) {
            throw new BusinessException("검색할 번호판을 확인해 주세요.");
        }

        Map<String, Object> param = plateProcedureParam(detail, user, request, "", 10, search);
        callPlateProcedure(param, detail);
        String result = Objects.toString(param.get("CAR_NO"), "");
        if (result.isBlank() || "APP_AVAIL_ERROR".equals(result)) return List.of();

        List<String> plates = new ArrayList<>();
        for (String plate : result.split("/")) {
            String value = plate.trim();
            if (!value.isEmpty() && !"null".equalsIgnoreCase(value) && plates.size() < 10) plates.add(value);
        }
        return plates;
    }

    /** 선택 번호를 확정한다. selectedPlate가 비어 있으면 화면에 임시 배정된 번호를 모두 해제한다. */
    @Transactional
    public Map<String, Object> savePlate(String serviceId, Map<String, Object> request, UserDto user) {
        Map<String, Object> detail = getSelectablePlateDetail(serviceId, user);
        String selected = Objects.toString(request.get("selectedPlate"), "").trim();
        List<String> displayed = plateList(request.get("displayedPlates"));
        if (!selected.isEmpty() && (!selected.matches("[0-9가-힣]{4,12}") || !displayed.contains(selected))) {
            throw new BusinessException("조회한 번호판 중 하나를 선택해 주세요.");
        }

        Map<String, Object> param = plateProcedureParam(detail, user, request, selected, 0, "");
        param.put("PRE_CAR_NO", displayed.stream().filter(plate -> !plate.equals(selected)).reduce("", (a, b) -> a + b + ","));
        callPlateProcedure(param, detail);

        // 기존 앱과 동일하게 관청 원부에도 선택 번호(취소 시 빈 값)를 반영한다.
        Map<String, Object> link = new HashMap<>();
        link.put("SID", "번호판업데이트");
        link.put("REQ_CAR_NO", selected);
        link.put("GOVT_ID", detail.get("GOVT_ID"));
        link.put("NUM_CD", "C");
        link.put("SERVICE_ID", detail.get("SERVICE_ID"));
        JsonNode response = commonService.linkServer(link);
        if (!"0".equals(response.path("errorCode").asText())
                || !"처리성공".equals(response.path("returnMSG").path("message").asText())) {
            throw new BusinessException("관청 번호판 정보 반영에 실패했습니다.", 502);
        }

        param.put("SELECT_CAR_NO", selected);
        if (numPlateMapper.updatePostCarNo(param) != 1) {
            throw new BusinessException("선택 번호판 저장에 실패했습니다.", 409);
        }
        if (!selected.isEmpty()) {
            String kindName = "F".equals(param.get("NUM_KIND")) ? "필름식 번호판" : "페인트식 번호판";
            param.put("MEMO_TX", "\n[매니저앱] " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("MM-dd HH:mm"))
                    + " 수도권 차량 " + kindName + " / " + selected + " 선택");
            numPlateMapper.appendPlateMemo(param);
        }
        return getProcessDetail(serviceId, user);
    }

    private Map<String, Object> getSelectablePlateDetail(String serviceId, UserDto user) {
        Map<String, Object> detail = getProcessDetail(serviceId, user);
        if (serviceId.startsWith("N") || "Y".equals(Objects.toString(detail.get("ETC5"), ""))
                || !"수도권".equals(Objects.toString(detail.get("SUDO"), ""))
                || !"없음".equals(Objects.toString(detail.get("SONGJANG_NO"), "없음"))) {
            throw new BusinessException("이 처리 건은 번호판을 선택할 수 없습니다.", 409);
        }
        return detail;
    }

    private Map<String, Object> plateProcedureParam(Map<String, Object> detail, UserDto user,
            Map<String, Object> request, String selected, int limit, String search) {
        String numKind = Objects.toString(detail.get("NUM_KIND"), "");
        if (!Set.of("2", "F", "7", "1G", "2G", "3G").contains(numKind)) {
            throw new BusinessException("지원하지 않는 번호판 종류입니다.");
        }
        String carKind = Objects.toString(detail.get("CAR_KD"), "");
        String carKindCode = carKind.startsWith("승합") ? "80" : carKind.startsWith("화물") ? "98" : "70";
        String holeYn = Objects.toString(detail.get("HOLE_YN"), "");
        if (!Set.of("01", "02").contains(holeYn)) {
            throw new BusinessException("번호판 장공 구분을 확인해 주세요.");
        }
        Map<String, Object> param = new HashMap<>();
        param.put("SERVICE_ID", detail.get("SERVICE_ID"));
        param.put("PRE_CAR_NO", plateList(request.get("displayedPlates")).stream().reduce("", (a, b) -> a + b + ","));
        param.put("SELECT_CAR_NO", selected);
        param.put("CONDITION", "");
        param.put("CarKd", carKindCode);
        param.put("HOLE_YN", holeYn);
        param.put("SEAL_YN", Objects.toString(detail.get("SEAL_YN"), ""));
        param.put("NUM_KIND", numKind);
        param.put("MANAGER_HP_NO", managerParam(user).get("TEL_NO"));
        param.put("LIMIT", limit);
        param.put("GUBUN", "수도권");
        param.put("SEARCH_CAR_NO", search);
        param.put("CAR_NO", "");
        return param;
    }

    private void callPlateProcedure(Map<String, Object> param, Map<String, Object> detail) {
        if ("RTRNS".equals(Objects.toString(detail.get("TASK_CD"), ""))) {
            numPlateMapper.getAvailableRentPlates(param);
        } else {
            numPlateMapper.getAvailablePlates(param);
        }
    }

    private List<String> plateList(Object value) {
        if (!(value instanceof List<?> values)) return List.of();
        return values.stream().map(item -> Objects.toString(item, "").trim())
                .filter(item -> item.matches("[0-9가-힣]{4,12}"))
                .distinct().limit(10).toList();
    }

    private boolean canSearchPlate(UserDto user) {
        String phone = Objects.toString(user.getMPHONE_NO(), "").replaceAll("[^0-9]", "");
        return Set.of("28842005", "48906702", "87408370", "77206885", "21869511", "47541327", "83646172")
                .stream().anyMatch(phone::endsWith);
    }

    @Transactional
    public Map<String, Object> requestProcess(String serviceId, Map<String, Object> request, UserDto user) {
        Map<String, Object> detail = getProcessDetail(serviceId, user);
        if (!Boolean.TRUE.equals(request.get("confirmed"))) {
            throw new BusinessException("입력 정보 확인이 필요합니다.");
        }

        Map<String, Object> param = managerParam(user);
        param.put("SERVICE_ID", validateServiceId(serviceId));
        param.put("NUM_MEMO_TX", Objects.toString(request.get("numMemo"), "").trim());

        // 기존 업무 규칙: N 접수는 배송 완료, 그 외 접수는 방문정보 저장 후 심사요청한다.
        boolean delivery = serviceId.startsWith("N");
        if (!delivery && !"CB407".equals(Objects.toString(detail.get("COMPANY_ID"), ""))) {
            String installDate = Objects.toString(request.get("installDate"), "");
            String installTime = Objects.toString(request.get("installTime"), "");
            validateSchedule(installDate, installTime);
            param.put("INSTALL_DT", installDate);
            param.put("INSTALL_TM", installTime.replace(":", ""));
        }
        if (!delivery && !"Y".equals(Objects.toString(detail.get("ETC5"), ""))
                && Objects.toString(detail.get("POST_CAR_NO"), "").isBlank()) {
            throw new BusinessException("신규 번호판이 지정되지 않았습니다.");
        }

        // 입력 저장과 상태 변경은 함께 성공하거나 함께 롤백되어야 한다.
        numPlateMapper.updateProcessInput(param);
        int count = delivery ? numPlateMapper.completeDelivery(param) : numPlateMapper.requestReview(param);
        if (count != 1) throw new BusinessException("현재 처리상태에서는 요청할 수 없습니다.", 409);
        return getProcessDetail(serviceId, user);
    }

    private Map<String, Object> managerParam(UserDto user) {
        if (!"NUMPLATE_APP".equals(user.getLOGIN_GB())) {
            throw new BusinessException("번호판 앱 로그인이 필요합니다.", 401);
        }
        // 화면에서 받은 휴대폰 번호가 아니라 인증된 세션 값을 모든 모바일 조회 조건에 사용한다.
        String phone = Objects.toString(user.getMPHONE_NO(), "").replaceAll("[^0-9]", "");
        if (phone.length() < 8) throw new BusinessException("로그인 계정의 휴대폰 번호를 확인해 주세요.");
        Map<String, Object> param = new HashMap<>();
        param.put("TEL_NO", phone);
        return param;
    }

    private String validateServiceId(String serviceId) {
        if (serviceId == null || !serviceId.matches("[A-Za-z0-9-]{1,40}")) {
            throw new BusinessException("잘못된 접수번호입니다.");
        }
        return serviceId;
    }

    private void validateSchedule(String date, String time) {
        try {
            LocalDate.parse(date);
        } catch (DateTimeParseException exception) {
            throw new BusinessException("방문 예정일을 확인해 주세요.");
        }
        if (!time.matches("(?:09|10|11|13|14|15|16|17):[0-5]0")) {
            throw new BusinessException("방문 예정시간을 확인해 주세요.");
        }
    }

}
