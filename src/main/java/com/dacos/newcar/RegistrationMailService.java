package com.dacos.newcar;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import jakarta.annotation.PreDestroy;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import com.dacos.attach.AttachService;
import com.dacos.code.CodeService;
import com.dacos.common.CommonRepository;
import com.dacos.mortgage.mapper.MortgageMapper;
import com.dacos.newcar.mapper.NewcarMapper;
import com.dacos.payment.mapper.PaymentMapper;

@Service
public class RegistrationMailService {
    private static final Logger log = LoggerFactory.getLogger(RegistrationMailService.class);
    private final MortgageMapper mortgageMapper;
    private final NewcarMapper newcarMapper;
    private final PaymentMapper paymentMapper;
    private final CommonRepository common;
    private final CodeService codeService;
    private final AttachService attachService;
    private final JavaMailSenderImpl sender = new JavaMailSenderImpl();
    private final String from;

    // ponytail: 메모리 대기열은 재시작 시 유실된다. 복구가 필요해지면 승인된 발송 이력 저장소로 전환한다.
    // 포화 시 요청 스레드에서 메일을 보내지 않고 503을 반환해 Dcross가 오래 기다리지 않게 한다.
    private final ThreadPoolExecutor executor = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(100), new ThreadPoolExecutor.AbortPolicy());

    public RegistrationMailService(MortgageMapper mortgageMapper, NewcarMapper newcarMapper,
            PaymentMapper paymentMapper, CommonRepository common, CodeService codeService,
            AttachService attachService, Environment env) {
        this.mortgageMapper = mortgageMapper;
        this.newcarMapper = newcarMapper;
        this.paymentMapper = paymentMapper;
        this.common = common;
        this.codeService = codeService;
        this.attachService = attachService;
        sender.setHost(env.getProperty("registration-mail.smtp.host", ""));
        sender.setPort(env.getProperty("registration-mail.smtp.port", Integer.class, 25));
        sender.setUsername(env.getProperty("registration-mail.smtp.username", ""));
        sender.setPassword(env.getProperty("registration-mail.smtp.password", ""));
        from = env.getProperty("registration-mail.from", "");
        sender.getJavaMailProperties().setProperty("mail.smtp.auth", "true");
        // Hiworks 신규 SMTP(465)는 연결 시작부터 SSL을 사용한다.
        sender.getJavaMailProperties().setProperty("mail.smtp.ssl.enable",
                String.valueOf(sender.getPort() == 465));
        sender.getJavaMailProperties().setProperty("mail.smtp.connectiontimeout", "5000");
        sender.getJavaMailProperties().setProperty("mail.smtp.timeout", "10000");
        sender.getJavaMailProperties().setProperty("mail.smtp.writetimeout", "10000");
    }

    public void submit(String serviceId) {
        executor.execute(() -> send(serviceId));
    }

    // DB 조회부터 발송까지 작업 스레드에서 실행한다. 실패는 해당 건만 로그로 남긴다.
    public boolean send(String serviceId) {
        String stage = "대상조회";
        try {
            Map<String, Object> service = mortgageMapper.getTrService(serviceId);
            require(service != null && !service.isEmpty(), "서비스정보_없음");
            require(text(service, "COMPANY_ID").startsWith("WA")
                    && "010".equals(service.get("WORK_CD")), "WA_신규등록_대상아님");
            Map<String, Object> car = newcarMapper.getNewCarDetail(serviceId);
            require(car != null && !car.isEmpty(), "신규등록정보_없음");

            stage = "수신주소확인";
            String recipient = text(car, "CARP_MAIL");
            require(!recipient.isEmpty(), "수신이메일_없음");
            InternetAddress address = new InternetAddress(recipient, true);
            address.validate();
            require(!recipient.contains("\r") && !recipient.contains("\n"), "수신이메일_형식오류");

            stage = "등록증조회";
            String carNo = text(car, "CAR_NO");
            require(!carNo.isEmpty(), "차량번호_없음");
            String judgeDate = text(service, "JUDGE_DT");
            require(!judgeDate.isEmpty(), "심사일자_없음");
            String folder = LocalDate.parse(judgeDate, DateTimeFormatter.BASIC_ISO_DATE)
                    .format(DateTimeFormatter.ofPattern("yyMMdd"));
            Path paper = CarPaperFiles.resolve(attachService.getServerAddress("IP"), folder, carNo);
            require(Files.isRegularFile(paper), "등록증_PDF_없음");
            require(Files.isReadable(paper) && Files.size(paper) > 0, "등록증_PDF_읽기불가");
            // 확장자만 PDF인 손상 파일은 첨부하지 않는다. 기존 파일에 암호를 추가하지 않는다.
            try (PDDocument document = Loader.loadPDF(paper.toFile())) {
                require(document.getNumberOfPages() > 0, "등록증_PDF_페이지없음");
            }

            stage = "영수증생성";
            List<Map<String, Object>> payments = paymentMapper.getPaymentList(serviceId);
            require(payments != null && !payments.isEmpty(), "납부정보_없음");
            Map<String, Object> bond = common.select(Map.of("SERVICE_ID", serviceId), "selectBondInfo");
            Map<String, Object> company = mortgageMapper.getCompanyInfo(service);
            byte[] receipt = new ReceiptPdfCreator().create(service, car, payments,
                    bond == null ? Map.of() : bond, company == null ? Map.of() : company,
                    codeService.getCodesByGroupId("BANK"));

            stage = "메일발송";
            require(!sender.getHost().isBlank() && !from.isBlank()
                    && !sender.getUsername().isBlank() && !sender.getPassword().isBlank(), "SMTP_설정없음");
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper mail = new MimeMessageHelper(message, true, "UTF-8");
            mail.setFrom(from);
            mail.setTo(address);
            mail.setSubject("[다코스] " + carNo + " 자동차등록증 및 통합납부영수증");
            mail.setText("안녕하세요.\n자동차 온라인등록센터 주식회사 다코스입니다.\n\n"
                    + carNo + " 차량의 신규등록이 완료되어\n자동차등록증과 통합납부영수증을 보내드립니다.\n\n"
                    + "첨부파일을 확인해 주시기 바랍니다.\n\n본 메일은 발신 전용입니다.\n"
                    + "문의사항은 자동차 온라인 등록센터 1844-0801로 연락해 주시기 바랍니다.\n감사합니다.");
            mail.addAttachment(carNo + "_자동차등록증.pdf", new FileSystemResource(paper));
            mail.addAttachment(carNo + "_통합납부영수증.pdf", new ByteArrayResource(receipt), "application/pdf");
            sender.send(message);

            stage = "발송완료처리";
            require(newcarMapper.updateRegistrationMailSent(serviceId) == 1, "발송완료_저장실패");
            return true;
        } catch (Exception e) {
            // 원문 예외에는 이메일·SQL 값이 포함될 수 있으므로 원인 종류만 한 줄로 기록한다.
            Throwable cause = e;
            while (cause.getCause() != null && cause.getCause() != cause) cause = cause.getCause();
            String reason = e instanceof PreparationException ? e.getMessage()
                    : e.getClass().getSimpleName() + "_" + cause.getClass().getSimpleName();
            if (cause instanceof javax.net.ssl.SSLHandshakeException && cause.getMessage() != null) {
                reason += "_" + cause.getMessage().replaceAll("[\\r\\n]+", " ");
            }
            log.warn("[등록메일실패] SERVICE_ID={} 단계={} 원인={}", serviceId, stage, reason);
            return false;
        }
    }

    static String text(Map<String, Object> data, String key) {
        return Objects.toString(data.get(key), "").trim();
    }

    private static void require(boolean valid, String reason) {
        if (!valid) throw new PreparationException(reason);
    }

    private static class PreparationException extends RuntimeException {
        PreparationException(String reason) { super(reason); }
    }

    @PreDestroy
    public void close() {
        executor.shutdown();
    }
}
