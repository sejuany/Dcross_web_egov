package com.dacos.newcar;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.ApiResponse;
import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;
import com.dacos.common.ServiceAccessGuard;

/** Spring 프로필·DB·관청·문자 API를 사용하지 않는 W 저장/권한/파일 롤백 검사. */
class NewcarWServiceTest {
    private static final String VIN = "AAAAAAAAAAAAAAAAA";
    @TempDir Path directory;
    private Map<String, Object> captured;
    private boolean failure;
    private String state = "SAV";
    private String extractedVin = VIN;
    private int saves;
    private int updates;
    private int commits;
    private int rollbacks;
    private boolean fileLinkFailure;
    private final List<String> saveStates = new ArrayList<>();
    private int creations;
    private int selectedInventory = 1;
    private Map<String, Object> originalOwner = Map.of();

    private Map<String, Object> car() {
        return new HashMap<>(Map.ofEntries(Map.entry("CARID_NO", VIN), Map.entry("TASK_CD", "NORML"), Map.entry("PROC_CD", "I"),
            Map.entry("REG_GB", "R"), Map.entry("REG_NO", "9001011234567"), Map.entry("OWNER_NM", "TEST-OWNER"),
            Map.entry("RATIO_NO", "100"), Map.entry("MPHONE_NO", "01000000000"), Map.entry("ADDRESS", "TEST-ADDRESS"),
            Map.entry("BASE_ADDRESS", "TEST-BASE"), Map.entry("REGIST_DATE", "2026-10-22"), Map.entry("NUMPLATE_GB", "F"),
            Map.entry("BUY_AMT", "50000000"), Map.entry("NTAX_TRGET_CD", "00"), Map.entry("CARD_YN", "N"), Map.entry("BOND_DC", "SELL"),
            Map.entry("PAY_NM", "TEST-PAYER"), Map.entry("PAY_HP_NO", "01000000000"), Map.entry("RT_BANK_CD", "TEST-BANK"),
            Map.entry("RETURN_NO", "0001234"), Map.entry("RETURN_NM", "TEST-OWNER"), Map.entry("CARP_ADDRESS", "TEST-DEST"),
            Map.entry("PAY_GB", "B"), Map.entry("LOW_POLLUTION_NO", "SERVER-NUMBER"), Map.entry("TOTAL_AMT", 12345)));
    }
    private Map<String, Object> original() {
        Map<String, Object> result = new HashMap<>();
        result.put("dsService", new HashMap<>(Map.of("SERVICE_ID", "TEST-SERVICE", "COMPANY_ID", "WB001", "WORK_CD", "010", "LINK_ID", "ORDER001", "PROC_ST", state, "GOVT_ID", "SERVER-GOVT")));
        result.put("dsNewCar", car());
        result.put("dsCarNoDetach", Map.of("CUSTOMER_NM", "TEST-CUSTOMER", "HOLE_YN", "02", "SEAL_YN", "02", "FILENAME1", "existing.pdf"));
        result.put("dsOwnerInfo", originalOwner); result.put("dsOwnerInfo1", Map.of()); result.put("dsTaxReceipt", Map.of());
        result.put("dsPaymentList", List.of(Map.of("PAY_KD", "FEE", "PAY_AMT", 27500), Map.of("PAY_KD", "ACQ", "PAY_AMT", 0),
            Map.of("PAY_KD", "BFEE", "PAY_AMT", 0), Map.of("PAY_KD", "BOND", "PAY_AMT", 0)));
        return result;
    }
    private UserDto user() { UserDto user = new UserDto(); user.setCOMPANY_ID("WB001"); user.setLOGIN_ID("TEST-USER"); user.setMEMBER_GB("CA"); return user; }
    private Map<String, Object> request() { return new HashMap<>(original()); }
    private NewcarWService service() {
        NewcarService legacy = new NewcarService(null, null, null, null, null, null, null, null, null, null, null, null, null, null) {
            @Override public Map<String, Object> initNewCar(UserDto user) { Map<String, Object> data = original(); NewcarWService.map(data, "dsService").put("SERVICE_ID", ""); return data; }
            @Override public Map<String, Object> getNewCarDetail(UserDto user, String id) { return original(); }
            @Override public Map<String, Object> processNewCar(Map<String, Object> data, UserDto user) {
                captured = data; saves++;
                saveStates.add(NewcarWValidation.text(NewcarWService.map(data, "dsService"), "PROC_ST"));
                if (NewcarWValidation.text(NewcarWService.map(data, "dsService"), "SERVICE_ID").isEmpty()) creations++;
                return ApiResponse.withKey("data", Map.of("RESULT_CD", failure ? "-2" : "0", "SERVICE_ID", "TEST-SERVICE"));
            }
        };
        ServiceAccessGuard guard = new ServiceAccessGuard(null) {
            @Override public Map<String, Object> requireAccess(UserDto user, String id, ServiceAction action) {
                if (!"TEST-SERVICE".equals(id)) throw new BusinessException("denied", 403);
                return NewcarWService.map(original(), "dsService");
            }
        };
        CommonRepository repository = new CommonRepository(null) {
            @Override @SuppressWarnings("unchecked") public <T> T select(Object param, String query) {
                if ("countWSelectedNumplate".equals(query)) return (T) Integer.valueOf(selectedInventory);
                assertEquals("selectWNewcarServiceForUpdate", query);
                return (T) NewcarWService.map(original(), "dsService");
            }
            @Override public int update(Map<String, Object> param, String query) {
                assertEquals("updateWProductionCertificate", query); updates++; return fileLinkFailure ? 0 : 1;
            }
        };
        NewcarPdfExtractService pdf = new NewcarPdfExtractService() {
            @Override public Map<String, Object> extractProductionCertificate(org.springframework.web.multipart.MultipartFile file) {
                return Map.of("carIdNo", extractedVin, "carName", "TEST-MODEL");
            }
            @Override Map<String, Object> storeProductionCertificate(org.springframework.web.multipart.MultipartFile file, UserDto user) throws IOException {
                Files.write(directory.resolve("new.pdf"), file.getBytes()); return Map.of("storedPath", "newcar-production-certificates/test/new.pdf");
            }
            @Override void removeProductionCertificate(String path) throws IOException { Files.deleteIfExists(directory.resolve("new.pdf")); }
        };
        var manager = new AbstractPlatformTransactionManager() {
            @Override protected Object doGetTransaction() { return new Object(); }
            @Override protected void doBegin(Object tx, TransactionDefinition definition) {}
            @Override protected void doCommit(DefaultTransactionStatus status) { commits++; }
            @Override protected void doRollback(DefaultTransactionStatus status) { rollbacks++; }
        };
        return new NewcarWService(legacy, pdf, guard, repository, null, manager);
    }
    @Test void readonlyFieldsAndHiddenValuesComeFromServer() {
        originalOwner = Map.of("SEQ", 7, "IDEN_ST", "SERVER-IDENTIFICATION");
        var request = request();
        NewcarWService.map(request, "dsNewCar").putAll(Map.of("TOTAL_AMT", 1, "LOW_POLLUTION_NO", "FORGED", "MEMO_TX", "TEST-MEMO", "CARP_MAIL", "example@example.com"));
        NewcarWService.map(request, "dsService").put("GOVT_ID", "FORGED");
        service().process(request, "SAVE", null, user());
        var car = NewcarWService.map(captured, "dsNewCar");
        assertEquals(12345, car.get("TOTAL_AMT")); assertEquals("SERVER-NUMBER", car.get("LOW_POLLUTION_NO"));
        assertEquals("SERVER-GOVT", NewcarWService.map(captured, "dsService").get("GOVT_ID"));
        assertEquals("TEST-MEMO", car.get("MEMO_TX")); assertEquals("example@example.com", car.get("CARP_MAIL"));
        assertEquals(7, NewcarWService.map(captured, "dsOwnerInfo").get("SEQ"));
        assertEquals("SERVER-IDENTIFICATION", NewcarWService.map(captured, "dsOwnerInfo").get("IDEN_ST"));
        assertEquals(1, commits);
    }
    @Test void companyOwnershipAndLockedStateRejectBeforeSaving() {
        UserDto other = user(); other.setCOMPANY_ID("WA001");
        assertEquals(403, assertThrows(BusinessException.class, () -> service().process(request(), "SAVE", null, other)).getStatusCode());
        var wrong = request(); NewcarWService.map(wrong, "dsService").put("SERVICE_ID", "DENIED");
        assertEquals(403, assertThrows(BusinessException.class, () -> service().process(wrong, "SAVE", null, user())).getStatusCode());
        state = "P_REQ";
        assertEquals(409, assertThrows(BusinessException.class, () -> service().process(request(), "SAVE", null, user())).getStatusCode());
        assertEquals(0, saves);
    }
    @Test void failedSaveRemovesOnlyNewPdfAndKeepsExistingFile() throws Exception {
        Files.writeString(directory.resolve("existing.pdf"), "existing"); failure = true;
        var file = new MockMultipartFile("file", "test.pdf", "application/pdf", "%PDF-test".getBytes());
        assertThrows(BusinessException.class, () -> service().process(request(), "SAVE", file, user()));
        assertFalse(Files.exists(directory.resolve("new.pdf"))); assertTrue(Files.exists(directory.resolve("existing.pdf")));
        assertEquals(1, rollbacks); assertEquals(0, updates);
    }
    @Test void successfulPdfUpdatesCurrentServiceAndLinksOriginal() {
        var file = new MockMultipartFile("file", "test.pdf", "application/pdf", "%PDF-test".getBytes());
        service().process(request(), "SAVE", file, user());
        assertEquals("TEST-SERVICE", NewcarWService.map(captured, "dsService").get("SERVICE_ID"));
        assertEquals("TEST-MODEL", NewcarWService.map(captured, "dsNewCar").get("CAR_NM")); assertEquals(1, updates);
        assertTrue(Files.exists(directory.resolve("new.pdf"))); assertEquals(1, saves);
    }
    @Test void mismatchedPdfIsRejectedWithoutSavingOrCreatingFile() {
        extractedVin = "BBBBBBBBBBBBBBBBB";
        var file = new MockMultipartFile("file", "test.pdf", "application/pdf", "%PDF-test".getBytes());
        assertThrows(BusinessException.class, () -> service().process(request(), "SAVE", file, user()));
        assertEquals(0, saves); assertFalse(Files.exists(directory.resolve("new.pdf")));
    }
    @Test void applicationValidatesDatasetFieldsAndDoesNotRequireSelectedPlate() {
        var data = request();
        assertDoesNotThrow(() -> service().process(data, "REQUEST", null, user()));
        assertEquals("P_REQ", NewcarWService.map(captured, "dsService").get("PROC_ST"));
        NewcarWService.map(data, "dsService").put("LINK_ID", "");
        assertThrows(BusinessException.class, () -> service().process(data, "REQUEST", null, user()));
    }
    @Test void jointOwnerAndConditionalBusinessGradeRules() {
        var data = request(); var car = NewcarWService.map(data, "dsNewCar");
        car.put("RATIO_NO", "99");
        assertThrows(BusinessException.class, () -> service().process(data, "REQUEST", null, user()));
        data.put("dsOwnerInfo", Map.of("DEBTOR_NM", "JOINT", "DEBTOR_GB", "R", "DEBTOR_REG_NO", "9001011234567", "DEBTOR_RATIO", "1", "DEBTOR_TEL_NO", "01000000000"));
        assertDoesNotThrow(() -> service().process(data, "REQUEST", null, user()));
        car.put("REG_GB", "B"); assertThrows(BusinessException.class, () -> service().process(data, "REQUEST", null, user()));
        car.put("BIZ_NO", "1234567890"); car.put("NTAX_TRGET_CD", "04"); car.put("NTAX_TRGET_GR_CD", "0");
        assertThrows(BusinessException.class, () -> service().process(data, "REQUEST", null, user()));
    }
    @Test void taxReceiptAndRegistrationEmailAreSeparateAndValidated() {
        var data = request(); NewcarWService.map(data, "dsNewCar").put("CARP_MAIL", "registration@example.com");
        data.put("dsTaxReceipt", Map.of("GUBUN", "TAX", "REG_NO", "1234567890", "COMPANY_NM", "TEST", "NAME", "TEST", "ADDR", "TEST",
            "BUSINESS_TYPE", "TEST", "INDUSTRY_TYPE", "TEST", "MAIL1", "tax@example.com"));
        service().process(data, "REQUEST", null, user());
        assertEquals("tax@example.com", NewcarWService.map(captured, "dsTaxReceipt").get("MAIL1"));
        assertEquals("registration@example.com", NewcarWService.map(captured, "dsNewCar").get("CARP_MAIL"));
    }
    @Test void missingRegistrationAndUnauthorizedRequestsAreReported() {
        assertEquals(404, assertThrows(BusinessException.class, () -> service().registrationPaper("TEST-SERVICE", user())).getStatusCode());
        assertEquals(403, assertThrows(BusinessException.class, () -> service().registrationPaper("DENIED", user())).getStatusCode());
    }
    @Test void mapperParsesAndBindsNewQueriesWithoutDatabase() throws Exception {
        Configuration configuration = new Configuration(); String resource = "mapper/NewcarMapper.xml";
        try (var input = getClass().getClassLoader().getResourceAsStream(resource)) {
            assertNotNull(input); new XMLMapperBuilder(input, configuration, resource, configuration.getSqlFragments()).parse();
        }
        String prefix = "com.dacos.newcar.mapper.NewcarMapper.";
        assertTrue(configuration.getMappedStatement(prefix + "getNewCarDetail").getBoundSql("TEST-SERVICE").getSql().contains("LOW_POLLUTION_KD"));
        var lock = configuration.getMappedStatement(prefix + "selectWNewcarServiceForUpdate").getBoundSql(Map.of());
        assertTrue(lock.getSql().contains("FOR UPDATE OF PROC_ST"));
        assertEquals(List.of("SERVICE_ID"), lock.getParameterMappings().stream().map(p -> p.getProperty()).toList());
        var file = configuration.getMappedStatement(prefix + "updateWProductionCertificate").getBoundSql(Map.of());
        assertEquals(List.of("FILENAME1", "SERVICE_ID"), file.getParameterMappings().stream().map(p -> p.getProperty()).toList());
    }
    @Test void newApplicationWithPdfCreatesOneRecordAndLinksBeforeRequesting() {
        var data = request(); NewcarWService.map(data, "dsService").put("SERVICE_ID", "");
        var file = new MockMultipartFile("file", "test.pdf", "application/pdf", "%PDF-test".getBytes());
        service().process(data, "REQUEST", file, user());
        assertEquals(List.of("SAV", "P_REQ"), saveStates); assertEquals(1, creations); assertEquals(1, updates);
        assertEquals("TEST-SERVICE", NewcarWService.map(captured, "dsService").get("SERVICE_ID"));
    }
    @Test void failedPdfLinkNeverCallsApplicationAndRollsBackNewFile() {
        fileLinkFailure = true;
        var file = new MockMultipartFile("file", "test.pdf", "application/pdf", "%PDF-test".getBytes());
        assertThrows(BusinessException.class, () -> service().process(request(), "REQUEST", file, user()));
        assertEquals(List.of("SAV"), saveStates); assertFalse(Files.exists(directory.resolve("new.pdf"))); assertEquals(1, rollbacks);
    }
    @Test void applicationAmountsUseServerCostsAndCardPaymentIsOptional() {
        var car = car();
        List<Map<String, Object>> payments = List.of(new HashMap<>(Map.of("PAY_KD", "ACQ", "PAY_AMT", 0)),
            new HashMap<>(Map.of("PAY_KD", "BOND", "PAY_AMT", 0)), new HashMap<>(Map.of("PAY_KD", "BFEE", "PAY_AMT", 0)),
            new HashMap<>(Map.of("PAY_KD", "FEE", "PAY_AMT", 27500)), new HashMap<>(Map.of("PAY_KD", "STAMP", "PAY_AMT", 2500)),
            new HashMap<>(Map.of("PAY_KD", "INJI", "PAY_AMT", 3000)));
        NewcarWService.calculateApplicationAmounts(car, payments);
        assertEquals(0, new java.math.BigDecimal("4563600").compareTo((java.math.BigDecimal) car.get("TOTAL_AMT")));
        car.put("CARD_YN", "Y"); NewcarWService.calculateApplicationAmounts(car, payments);
        assertEquals(0, new java.math.BigDecimal("1063600").compareTo((java.math.BigDecimal) car.get("TOTAL_AMT")));
    }
    @Test void multipartControllerBindsJsonAndActionWithoutCallingExternalServices() throws Exception {
        var session = new org.springframework.mock.web.MockHttpSession(); session.setAttribute("user", user());
        var part = new MockMultipartFile("request", "", "application/json", new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsBytes(request()));
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(new NewcarWController(service())).build();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/api/newcar/w/process")
                .file(part).param("action", "SAVE").session(session))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
        assertEquals(1, saves);
    }
    @Test void realPdfExtractionStorageAndCleanupUseTemporaryDirectory() throws Exception {
        var actual = new NewcarPdfExtractService();
        org.springframework.test.util.ReflectionTestUtils.setField(actual, "pdfUploadDir", directory.toString());
        var bytes = new java.io.ByteArrayOutputStream();
        try (var document = new org.apache.pdfbox.pdmodel.PDDocument()) {
            var page = new org.apache.pdfbox.pdmodel.PDPage(); document.addPage(page);
            try (var content = new org.apache.pdfbox.pdmodel.PDPageContentStream(document, page)) {
                content.beginText(); content.setFont(new org.apache.pdfbox.pdmodel.font.PDType1Font(org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA), 12);
                content.newLineAtOffset(50, 700); content.showText(VIN); content.endText();
            }
            document.save(bytes);
        }
        var file = new MockMultipartFile("file", "test.pdf", "application/pdf", bytes.toByteArray());
        assertEquals(VIN, actual.extractProductionCertificate(file).get("carIdNo"));
        String stored = actual.storeProductionCertificate(file, user()).get("storedPath").toString();
        Path target = directory.resolve(stored.substring("newcar-production-certificates/".length()));
        assertTrue(Files.isRegularFile(target)); actual.removeProductionCertificate(stored); assertFalse(Files.exists(target));
        assertThrows(IOException.class, () -> actual.removeProductionCertificate("../existing.pdf"));
    }
    @Test void selectedNumberMustBelongToCurrentServiceInventory() {
        var data = request(); NewcarWService.map(data, "dsNewCar").put("REQ_CAR_NO", "TEST-PLATE");
        service().process(data, "SAVE", null, user());
        assertEquals("TEST-PLATE", NewcarWService.map(captured, "dsNewCar").get("REQ_CAR_NO"));
        selectedInventory = 0;
        assertThrows(BusinessException.class, () -> service().process(data, "SAVE", null, user()));
        assertEquals(1, saves);
    }
    @Test void newRecordRequiresAnExistingAuthorizedRole() {
        var data = request(); NewcarWService.map(data, "dsService").put("SERVICE_ID", "");
        var unknown = user(); unknown.setMEMBER_GB("UNKNOWN");
        assertEquals(403, assertThrows(BusinessException.class, () -> service().process(data, "SAVE", null, unknown)).getStatusCode());
        assertEquals(0, saves);
    }
}
