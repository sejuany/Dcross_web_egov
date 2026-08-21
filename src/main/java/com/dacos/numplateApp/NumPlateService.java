package com.dacos.numplateApp;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.numplateApp.dto.NumPlateSearchRequest;
import com.dacos.numplateApp.mapper.NumPlateMapper;

/**
 * 번호판 앱의 인증, 조회 범위 제한, 입력 검증과 처리 상태 변경을 담당한다.
 * 컨트롤러가 받은 값은 이 계층에서 다시 검증한 뒤 MyBatis 매퍼로 전달한다.
 */
@Service
public class NumPlateService {

    private static final Logger logger = LoggerFactory.getLogger(NumPlateService.class);

    private final NumPlateMapper numPlateMapper;

    public NumPlateService(NumPlateMapper numPlateMapper) {
        this.numPlateMapper = numPlateMapper;
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
        return numPlateMapper.getProcessList(param);
    }

    public Map<String, Object> getProcessDetail(String serviceId, UserDto user) {
        // 접수번호뿐 아니라 로그인 담당자의 휴대폰 번호도 매퍼에 전달해 소유 건만 조회한다.
        Map<String, Object> param = managerParam(user);
        param.put("SERVICE_ID", validateServiceId(serviceId));
        Map<String, Object> detail = numPlateMapper.getProcessDetail(param);
        if (detail == null) throw new BusinessException("처리 건을 찾을 수 없습니다.", 404);
        return detail;
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
