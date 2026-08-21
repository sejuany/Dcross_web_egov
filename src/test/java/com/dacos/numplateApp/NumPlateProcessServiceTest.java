package com.dacos.numplateApp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;
import java.util.Base64;
import java.util.HashMap;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.io.Resources;
import org.apache.ibatis.session.Configuration;
import org.springframework.mock.web.MockMultipartFile;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.numplateApp.mapper.NumPlateMapper;

/** 번호판 앱의 로그인 범위, 목록 JSON 안전성, 검색 호환과 상태 변경 조건을 실행 가능한 형태로 검증한다. */
public class NumPlateProcessServiceTest {

    public static void main(String[] args) throws Exception {
        NumPlateProcessServiceTest test = new NumPlateProcessServiceTest();
        test.authenticatesNumPlateManagerByPhoneAndPassword();
        test.ignoresSearchTypeWhenKeywordIsEmpty();
        test.requestsReviewOnlyAfterConfirmationAndUsesLoginPhone();
        test.loadsAvailablePlatesWithLegacyProcedureRules();
        test.savesScheduleAndMemoBeforeReview();
        test.loadsReturnListAndUploadsDisposedPlate();
        test.adjustsSubPanelPriceAndRefundTogether();
        test.parsesNumPlateMapperXml();
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

    @Test
    void savesScheduleAndMemoBeforeReview() {
        AtomicReference<Map<String, Object>> scheduleParam = new AtomicReference<>();
        AtomicReference<Map<String, Object>> memoParam = new AtomicReference<>();
        NumPlateMapper mapper = (NumPlateMapper) Proxy.newProxyInstance(
                NumPlateMapper.class.getClassLoader(),
                new Class<?>[] { NumPlateMapper.class },
                (proxy, method, args) -> switch (method.getName()) {
                    case "getProcessDetail" -> Map.of("SERVICE_ID", "R011-1", "COMPANY_ID", "TEST");
                    case "updateInstallSchedule" -> {
                        scheduleParam.set((Map<String, Object>) args[0]);
                        yield 1;
                    }
                    case "updateInstallerMemo" -> {
                        memoParam.set((Map<String, Object>) args[0]);
                        yield 1;
                    }
                    default -> throw new UnsupportedOperationException(method.getName());
                });
        NumPlateService service = new NumPlateService(mapper, null);
        UserDto user = new UserDto();
        user.setMPHONE_NO("010-1234-5678");
        user.setLOGIN_GB("NUMPLATE_APP");

        service.updateInstallSchedule("R011-1",
                Map.of("installDate", "2026-08-21", "installTime", "09:30"), user);
        service.updateInstallerMemo("R011-1", Map.of("numMemo", " 방문 완료 "), user);

        assertEquals("0930", scheduleParam.get().get("INSTALL_TM"));
        assertEquals("방문 완료", memoParam.get().get("NUM_MEMO_TX"));
        assertEquals("01012345678", memoParam.get().get("TEL_NO"));
        assertThrows(BusinessException.class,
                () -> service.updateInstallSchedule("N011-1",
                        Map.of("installDate", "2026-08-21", "installTime", "09:30"), user));
    }

    @Test
    void loadsReturnListAndUploadsDisposedPlate() {
        AtomicReference<Map<String, Object>> listParam = new AtomicReference<>();
        AtomicReference<byte[]> savedImage = new AtomicReference<>();
        NumPlateMapper mapper = (NumPlateMapper) Proxy.newProxyInstance(
                NumPlateMapper.class.getClassLoader(),
                new Class<?>[] { NumPlateMapper.class },
                (proxy, method, args) -> switch (method.getName()) {
                    case "getReturnList" -> {
                        listParam.set((Map<String, Object>) args[0]);
                        yield List.of(Map.of("SERVICE_ID", "R011-1", "CAR_NO", "12가3456"));
                    }
                    case "updateDisposedPlateImage" -> {
                        savedImage.set((byte[]) ((Map<String, Object>) args[0]).get("IMAGE5"));
                        yield 1;
                    }
                    case "completeDisposedPlate" -> 1;
                    default -> throw new UnsupportedOperationException(method.getName());
                });
        NumPlateService service = new NumPlateService(mapper, null);
        UserDto user = new UserDto();
        user.setMPHONE_NO("010-1234-5678");
        user.setLOGIN_GB("NUMPLATE_APP");

        service.getReturnList(Map.of("conditionType", "CAR_NO", "keyword", "12가"), user);
        assertEquals("12가", listParam.get().get("CONDITION"));
        assertEquals("01012345678", listParam.get().get("TEL_NO"));

        byte[] png = Base64.getDecoder().decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
        service.uploadDisposedPlate("R011-1",
                new MockMultipartFile("file", "plate.png", "image/png", png), user);
        assertEquals(png.length, savedImage.get().length);
        assertThrows(BusinessException.class, () -> service.uploadDisposedPlate("R011-1",
                new MockMultipartFile("file", "fake.jpg", "image/jpeg", new byte[] { 1, 2, 3 }), user));
    }

    @Test
    void adjustsSubPanelPriceAndRefundTogether() {
        AtomicReference<Map<String, Object>> changed = new AtomicReference<>();
        AtomicReference<Map<String, Object>> refunded = new AtomicReference<>();
        NumPlateMapper mapper = (NumPlateMapper) Proxy.newProxyInstance(
                NumPlateMapper.class.getClassLoader(), new Class<?>[] { NumPlateMapper.class },
                (proxy, method, args) -> switch (method.getName()) {
                    case "getProcessDetail" -> Map.of(
                            "SERVICE_ID", "R011-1", "PROC_ST", "J_END", "BOND_YN", "Y");
                    case "getSubPanelInfo" -> Map.ofEntries(
                            Map.entry("SERVICE_ID", "R011-1"), Map.entry("BOND_YN", "Y"),
                            Map.entry("TNUM_PAY_AMT", 50_000), Map.entry("TOTAL_AMT", 100_000),
                            Map.entry("RT_AMT", 2_000), Map.entry("ACQ_VBANK_NO", "123"),
                            Map.entry("BOND_VBANK_NO", "456"), Map.entry("BOND_AMT", 10_000),
                            Map.entry("PAY_GB", "B"), Map.entry("CAR_NO", "12가3456"),
                            Map.entry("COMPANY_ID", "TEST"), Map.entry("WORK_CD", "NUM"),
                            Map.entry("VBANK_NM", "001"), Map.entry("VBANK_NO", "789"),
                            Map.entry("OWNER_NM", "고객"));
                    case "lockSubPanelService" -> 1;
                    case "updateSubPanelPayment" -> 1;
                    case "updateTrnsSubPanel" -> {
                        changed.set(new HashMap<>((Map<String, Object>) args[0]));
                        yield 1;
                    }
                    case "mergeSubPanelRefund" -> {
                        refunded.set(new HashMap<>((Map<String, Object>) args[0]));
                        yield 1;
                    }
                    case "appendSubPanelMemo" -> 1;
                    default -> throw new UnsupportedOperationException(method.getName());
                });
        NumPlateService service = new NumPlateService(mapper, null);
        UserDto user = new UserDto();
        user.setMPHONE_NO("010-1234-5678");
        user.setLOGIN_GB("NUMPLATE_APP");

        service.updateSubPanel("R011-1", Map.of("used", "N"), user);

        assertEquals(39_000L, changed.get().get("PAY_AMT"));
        assertEquals(89_000L, changed.get().get("TOTAL_AMT"));
        assertEquals(13_000L, refunded.get().get("RT_AMT"));
        assertEquals("N", changed.get().get("BOND_YN"));
    }

    @Test
    void parsesNumPlateMapperXml() throws Exception {
        try (var input = Resources.getResourceAsStream("mapper/NumPlateMapper.xml")) {
            new XMLMapperBuilder(input, new Configuration(), "mapper/NumPlateMapper.xml", new HashMap<>()).parse();
        }
        String mapperXml;
        try (var input = Resources.getResourceAsStream("mapper/NumPlateMapper.xml")) {
            mapperXml = new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        }
        assertFalse(mapperXml.contains("TNI.IMAGE1 AS IMAGE1"));
        assertFalse(mapperXml.contains(", TNI.IMAGE1,"));
    }
}
