package com.dacos.numplateApp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.numplateApp.mapper.NumPlateMapper;

/** 번호판 앱의 로그인 범위, 기존 검색 호환, 심사요청 보안 조건을 실행 가능한 형태로 검증한다. */
public class NumPlateProcessServiceTest {

    public static void main(String[] args) {
        NumPlateProcessServiceTest test = new NumPlateProcessServiceTest();
        test.authenticatesNumPlateManagerByPhoneAndPassword();
        test.ignoresSearchTypeWhenKeywordIsEmpty();
        test.requestsReviewOnlyAfterConfirmationAndUsesLoginPhone();
        test.loadsAvailablePlatesWithLegacyProcedureRules();
    }

    @Test
    void ignoresSearchTypeWhenKeywordIsEmpty() {
        AtomicReference<Map<String, Object>> listParam = new AtomicReference<>();
        NumPlateMapper mapper = (NumPlateMapper) Proxy.newProxyInstance(
                NumPlateMapper.class.getClassLoader(),
                new Class<?>[] { NumPlateMapper.class },
                (proxy, method, args) -> {
                    if (!"getProcessList".equals(method.getName())) {
                        throw new UnsupportedOperationException(method.getName());
                    }
                    listParam.set((Map<String, Object>) args[0]);
                    return List.of(Map.of("PROC_ST", "S_END", "CARD_YN", "Y", "CARD_PAY_YN", "N"));
                });
        NumPlateService service = new NumPlateService(mapper, null);
        UserDto user = new UserDto();
        user.setMPHONE_NO("010-1234-5678");
        user.setLOGIN_GB("NUMPLATE_APP");

        List<Map<String, Object>> result = service.getProcessList(
                Map.of("conditionType", "CAR_NO", "keyword", ""), user);

        assertEquals("", listParam.get().get("cOPTION"));
        assertEquals("", listParam.get().get("CONDITION"));
        assertEquals("01012345678", listParam.get().get("TEL_NO"));
        assertEquals("S_END", result.get(0).get("PROC_ST"));
        assertEquals("취득세카드납부중", result.get(0).get("PROC_ST_NM"));
    }

    @Test
    void authenticatesNumPlateManagerByPhoneAndPassword() {
        AtomicReference<Map<String, Object>> loginParam = new AtomicReference<>();
        NumPlateMapper mapper = (NumPlateMapper) Proxy.newProxyInstance(
                NumPlateMapper.class.getClassLoader(),
                new Class<?>[] { NumPlateMapper.class },
                (proxy, method, args) -> {
                    if (!"loginManager".equals(method.getName())) {
                        throw new UnsupportedOperationException(method.getName());
                    }
                    loginParam.set((Map<String, Object>) args[0]);
                    return List.of(Map.of(
                            "TEL_NO", "01012345678", "MANAGER_NM", "담당자",
                            "COMPANY_ID", "TEST", "COMPANY_NM", "테스트", "ETC6", "pw"));
                });
        NumPlateService service = new NumPlateService(mapper, null);

        UserDto user = service.loginManager(Map.of("phone", "010-1234-5678", "password", "pw"));

        assertEquals("NUMPLATE_APP", user.getLOGIN_GB());
        assertEquals("01012345678", loginParam.get().get("TEL_NO"));
        assertFalse(loginParam.get().containsKey("PASSWD"));
        assertThrows(BusinessException.class,
                () -> service.loginManager(Map.of("phone", "123", "password", "pw")));
    }

    @Test
    void requestsReviewOnlyAfterConfirmationAndUsesLoginPhone() {
        AtomicReference<Map<String, Object>> reviewParam = new AtomicReference<>();
        NumPlateMapper mapper = (NumPlateMapper) Proxy.newProxyInstance(
                NumPlateMapper.class.getClassLoader(),
                new Class<?>[] { NumPlateMapper.class },
                (proxy, method, args) -> switch (method.getName()) {
                    case "getProcessDetail" -> Map.of(
                            "SERVICE_ID", "R011-1", "COMPANY_ID", "TEST",
                            "POST_CAR_NO", "12가3456", "ETC5", "N");
                    case "updateProcessInput" -> 1;
                    case "requestReview" -> {
                        reviewParam.set((Map<String, Object>) args[0]);
                        yield 1;
                    }
                    default -> throw new UnsupportedOperationException(method.getName());
                });
        NumPlateService service = new NumPlateService(mapper, null);
        UserDto user = new UserDto();
        user.setMPHONE_NO("010-1234-5678");
        user.setLOGIN_GB("NUMPLATE_APP");

        assertThrows(BusinessException.class,
                () -> service.requestProcess("R011-1", Map.of("confirmed", false), user));
        service.requestProcess("R011-1", Map.of(
                "confirmed", true,
                "installDate", "2026-08-20",
                "installTime", "10:30",
                "numMemo", "확인"), user);

        assertEquals("01012345678", reviewParam.get().get("TEL_NO"));
        assertEquals("1030", reviewParam.get().get("INSTALL_TM"));
    }

    @Test
    void loadsAvailablePlatesWithLegacyProcedureRules() {
        AtomicReference<Map<String, Object>> procedureParam = new AtomicReference<>();
        NumPlateMapper mapper = (NumPlateMapper) Proxy.newProxyInstance(
                NumPlateMapper.class.getClassLoader(),
                new Class<?>[] { NumPlateMapper.class },
                (proxy, method, args) -> switch (method.getName()) {
                    case "getProcessDetail" -> Map.of(
                            "SERVICE_ID", "R011-1", "ETC5", "N", "SUDO", "수도권", "SONGJANG_NO", "없음",
                            "NUM_KIND", "2", "CAR_KD", "승용", "HOLE_YN", "02", "SEAL_YN", "Y", "TASK_CD", "UTRNS");
                    case "getAvailablePlates" -> {
                        Map<String, Object> param = (Map<String, Object>) args[0];
                        procedureParam.set(param);
                        param.put("CAR_NO", "12가3456/34나5678/");
                        yield null;
                    }
                    default -> throw new UnsupportedOperationException(method.getName());
                });
        NumPlateService service = new NumPlateService(mapper, null);
        UserDto user = new UserDto();
        user.setMPHONE_NO("010-1234-5678");
        user.setLOGIN_GB("NUMPLATE_APP");

        List<String> result = service.getAvailablePlates("R011-1", Map.of(), user);

        assertEquals(List.of("12가3456", "34나5678"), result);
        assertEquals("70", procedureParam.get().get("CarKd"));
        assertEquals("02", procedureParam.get().get("HOLE_YN"));
        assertEquals(10, procedureParam.get().get("LIMIT"));
    }
}
