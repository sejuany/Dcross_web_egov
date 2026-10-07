package com.dacos.newcar;

import static org.junit.jupiter.api.Assertions.*;

import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;
import com.dacos.mortgage.mapper.MortgageMapper;
import com.dacos.scheduler.SchedulerService;
import com.dacos.scheduler.mapper.SchedulerMapper;

/** Spring 서버·DB·SMTP를 시작하지 않는 자동메일 단위 검사. */
class RegistrationMailTest {
    private final List<Map<String, Object>> payments = List.of(
            Map.of("PAY_KD", "ACQ", "PAY_AMT", "1,000.10", "VBANK_NO", "1234567890123456789"),
            Map.of("PAY_KD", "ACQ", "PAY_AMT", "200.20"),
            Map.of("PAY_KD", "FEE", "PAY_AMT", 300),
            Map.of("PAY_KD", "BOND", "PAY_AMT", 400, "REAL_ALOAN", 10000));

    @Test
    void receiptAmountsAndUnencryptedPdf() throws Exception {
        assertEquals(new BigDecimal("1200.30"), ReceiptPdfCreator.sum(payments, "ACQ"));
        assertEquals(BigDecimal.ZERO, ReceiptPdfCreator.bondTotal(Map.of("BOND_AMT", 500), payments, Map.of("FIELD28", 0)));
        assertEquals(new BigDecimal("500"), ReceiptPdfCreator.bondTotal(Map.of("BOND_AMT", 500), payments, Map.of()));
        assertEquals(new BigDecimal("400"), ReceiptPdfCreator.bondTotal(Map.of(), payments, Map.of()));
        assertEquals(new BigDecimal("400"), ReceiptPdfCreator.bondTotal(Map.of("BOND_DC", "BUY"), payments, Map.of("FIELD28", 900)));
        assertThrows(NumberFormatException.class, () -> ReceiptPdfCreator.amount("금액오류"));

        Path output = Path.of("target/registration-mail-check");
        Files.createDirectories(output);
        for (String mode : List.of("SELL", "BUY")) {
            byte[] pdf = new ReceiptPdfCreator().create(Map.of("LINK_ID", "TEST0001"),
                    Map.of("OWNER_NM", "테스트 고객", "CAR_NO", "123가4567", "CARID_NO", "TEST1234567890123",
                            "BOND_DC", mode, "PREREG_AMT", 2000, "RT_AMT", 100, "REGIST_DATE", "2026-09-18"),
                    payments, Map.of("FIELD28", 500), Map.of(), List.of());
            Files.write(output.resolve(mode + ".pdf"), pdf);
            try (var document = Loader.loadPDF(pdf)) {
                assertFalse(document.isEncrypted());
                assertEquals(1, document.getNumberOfPages());
                String text = new PDFTextStripper().getText(document);
                assertTrue(text.contains("통합 납부 영수증"));
                assertTrue(text.contains("123가4567"));
                assertTrue(text.contains(mode.equals("BUY") ? "1,900.3 원" : "2,000.3 원"));
                ImageIO.write(new PDFRenderer(document).renderImageWithDPI(0, 110), "png", output.resolve(mode + ".png").toFile());
            }
        }
    }

    @Test
    void rejectsTraversalAndInvalidFileParts() {
        assertThrows(IllegalArgumentException.class, () -> CarPaperFiles.resolve("local", "../260918", "123가4567"));
        assertThrows(IllegalArgumentException.class, () -> CarPaperFiles.resolve("local", "260918", "../secret"));
        assertTrue(CarPaperFiles.resolve("local", "260918", "123가4567").endsWith(Path.of("260918", "123가4567.pdf")));
    }

    @Test
    void validatesBeforeSubmittingAndReportsQueueFailure() {
        try (StubMailService mail = new StubMailService()) {
            RegistrationMailController controller = new RegistrationMailController(mail);
            assertEquals(400, controller.accept("bad\nvalue").getStatusCode().value());
            assertNull(mail.accepted);
            assertEquals(202, controller.accept("R010-TEST").getStatusCode().value());
            assertEquals("R010-TEST", mail.accepted);
            mail.full = true;
            assertEquals(503, controller.accept("R010-TEST").getStatusCode().value());
        }
    }

    @Test
    void returnsBeforeWorkerFinishesAndContinuesAfterFailure() throws Exception {
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch second = new CountDownLatch(1);
        MortgageMapper mapper = (MortgageMapper) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[]{MortgageMapper.class}, (proxy, method, args) -> {
                    if ("FIRST".equals(args[0])) {
                        entered.countDown();
                        release.await(5, TimeUnit.SECONDS);
                        throw new IllegalStateException("test-only");
                    }
                    second.countDown();
                    return null;
                });
        RegistrationMailService mail = new RegistrationMailService(mapper, null, null, null, null, null, new MockEnvironment());
        try {
            assertEquals(202, new RegistrationMailController(mail).accept("FIRST").getStatusCode().value());
            assertTrue(entered.await(5, TimeUnit.SECONDS));
            mail.submit("SECOND");
            release.countDown();
            assertTrue(second.await(5, TimeUnit.SECONDS));
        } finally {
            release.countDown();
            mail.close();
        }
    }

    @Test
    void scheduledMailContinuesAfterOneFailure() {
        SchedulerMapper mapper = (SchedulerMapper) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[]{SchedulerMapper.class}, (proxy, method, args) ->
                        "selectRegistrationMailTargets".equals(method.getName())
                                ? List.of("FIRST", "SECOND") : null);
        try (StubMailService mail = new StubMailService()) {
            mail.failed = "FIRST";
            assertEquals(1, new SchedulerService(mapper, null, null, mail, null).processRegistrationMails());
            assertEquals(List.of("FIRST", "SECOND"), mail.sent);
            assertEquals(List.of("FIRST", "SECOND"), mail.scheduled);
        }
    }

    @Test
    void port25UsesStartTlsInsteadOfImplicitSsl() {
        RegistrationMailService mail = new RegistrationMailService(null, null, null, null, null, null,
                new MockEnvironment().withProperty("registration-mail.smtp.port", "25"));
        try {
            JavaMailSenderImpl sender = (JavaMailSenderImpl) ReflectionTestUtils.getField(mail, "sender");
            assertEquals("true", sender.getJavaMailProperties().getProperty("mail.smtp.starttls.enable"));
            assertEquals("false", sender.getJavaMailProperties().getProperty("mail.smtp.ssl.enable"));
        } finally {
            mail.close();
        }
    }

    @Test
    void wooriLeaseBaseMustMatchSelectedBase() {
        List<Map<String, Object>> bases = List.of(
                Map.of("BASE_ID", "A", "BASE_NM", "우리금융캐피탈 주식회사(본점)"),
                Map.of("BASE_ID", "B", "BASE_NM", "산은캐피탈(본점)"));
        assertTrue(RegistrationMailService.isWooriLeaseBase("A", bases));
        assertFalse(RegistrationMailService.isWooriLeaseBase("B", bases));
        assertFalse(RegistrationMailService.isWooriLeaseBase("C", bases));
    }

    private static class StubMailService extends RegistrationMailService implements AutoCloseable {
        String accepted;
        String failed;
        boolean full;
        final List<String> sent = new ArrayList<>();
        final List<String> scheduled = new ArrayList<>();
        StubMailService() { super(null, null, null, null, null, null, new MockEnvironment()); }
        @Override public void submit(String serviceId) {
            if (full) throw new RejectedExecutionException();
            accepted = serviceId;
        }
        @Override public boolean send(String serviceId) {
            sent.add(serviceId);
            return !serviceId.equals(failed);
        }
        @Override public boolean sendScheduled(String serviceId) {
            scheduled.add(serviceId);
            return send(serviceId);
        }
    }
}
