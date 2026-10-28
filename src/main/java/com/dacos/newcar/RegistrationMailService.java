package com.dacos.newcar;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import jakarta.annotation.PreDestroy;
import jakarta.mail.internet.AddressException;
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
import com.dacos.common.BusinessException;
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
        // 기존 DaCOS SMTP(25)는 STARTTLS, Hiworks SMTP(465)는 연결 시작부터 SSL을 사용한다.
        sender.getJavaMailProperties().setProperty("mail.smtp.ssl.enable",
                String.valueOf(sender.getPort() == 465));
        sender.getJavaMailProperties().setProperty("mail.smtp.starttls.enable",
                String.valueOf(sender.getPort() == 25));
        sender.getJavaMailProperties().setProperty("mail.smtp.connectiontimeout", "5000");
        sender.getJavaMailProperties().setProperty("mail.smtp.timeout", "10000");
        sender.getJavaMailProperties().setProperty("mail.smtp.writetimeout", "10000");
    }

    public void submit(String serviceId) {
        executor.execute(() -> send(serviceId));
    }

    // 수동 선택 주소는 작업 대기열에 넣기 전에 단일 이메일 형식을 검증한다.
    public void submitSelected(String serviceId, String recipient) {
        String selectedRecipient = validateRecipient(recipient);
        executor.execute(() -> send(serviceId, false, selectedRecipient));
    }

    // DB 조회부터 발송까지 작업 스레드에서 실행한다. 실패는 해당 건만 로그로 남긴다.
    public boolean send(String serviceId) {
        return send(serviceId, false, null);
    }

    public boolean sendScheduled(String serviceId) {
        return send(serviceId, true, null);
    }

    private boolean send(String serviceId, boolean scheduled, String selectedRecipient) {
        String stage = "대상조회";
        try {
            Map<String, Object> service = mortgageMapper.getTrService(serviceId);
            require(service != null && !service.isEmpty(), "서비스정보_없음");
            require(text(service, "COMPANY_ID").startsWith("WA")
                    && "010".equals(service.get("WORK_CD")), "WA_신규등록_대상아님");
            Map<String, Object> car = newcarMapper.getNewCarDetail(serviceId);
            require(car != null && !car.isEmpty(), "신규등록정보_없음");

            stage = "수신주소확인";
            // 수동 선택 발송은 한 주소, 스케줄·내부 연계 발송은 저장된 유효 대상 주소를 사용한다.
            InternetAddress[] addresses = selectedRecipient == null ? storedRecipients(car)
                    : new InternetAddress[]{new InternetAddress(validateRecipient(selectedRecipient), true)};
            for (InternetAddress address : addresses) address.validate();

            stage = "등록증조회";
            String carNo = text(car, "CAR_NO");
            require(!carNo.isEmpty(), "차량번호_없음");
            String judgeDate = text(service, "JUDGE_DT");
            require(!judgeDate.isEmpty(), "심사일자_없음");
            LocalDate registrationDate = LocalDate.parse(judgeDate, DateTimeFormatter.BASIC_ISO_DATE);
            String folder = registrationDate.format(DateTimeFormatter.ofPattern("yyMMdd"));
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

            stage = "회원사조회";
            // 회원의 현재 소속이 아닌 접수건의 COMPANY_ID로 제목에 표시할 회원사명을 조회한다.
            String companyName = Objects.toString(newcarMapper.getRegistrationMailCompanyName(
                    text(service, "COMPANY_ID")), "").trim();
            require(!companyName.isEmpty(), "회원사명_없음");

            stage = "계약자조회";
            Map<String, Object> carNoDetach = newcarMapper.getTrCarNoDetach(Map.of("SERVICE_ID", serviceId));
            String customerName = carNoDetach == null ? "" : text(carNoDetach, "CUSTOMER_NM");

            stage = "메일발송";
            require(!sender.getHost().isBlank() && !from.isBlank()
                    && !sender.getUsername().isBlank() && !sender.getPassword().isBlank(), "SMTP_설정없음");
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper mail = new MimeMessageHelper(message, true, "UTF-8");
            mail.setFrom(from);
            // 우리금융 주소도 CARP_MAIL에 저장된 값만 사용하며 별도로 추가하지 않는다.
            mail.setTo(addresses);
            mail.setSubject("[다코스] " + companyName + " " + carNo + " 자동차등록증 및 통합납부영수증");
            
            mail.setText("안녕하세요.\n"
            		+"자동차 온라인등록센터 주식회사 다코스입니다.\n\n"
            		
                    + carNo + " 차량의 신규등록이 완료되어\n"
                    + "자동차등록증과 통합납부영수증을 보내드립니다.\n\n"
                    
                    + "- 주문번호 : " + text(service, "LINK_ID") + "\n"
                    + "- 등록일 : " + registrationDate.format(DateTimeFormatter.ISO_LOCAL_DATE) + "\n"
                    + "- 계약자 : " + customerName + "\n\n"
                    
                    + "첨부파일을 확인해 주시기 바랍니다.\n\n"
                    + "본 메일은 발신 전용입니다.\n"
                    + "문의사항은 자동차 온라인 등록센터 1844-0801로 연락해 주시기 바랍니다.\n"
                    + "감사합니다.");
            
            mail.addAttachment(carNo + "_자동차등록증.pdf", new FileSystemResource(paper));
            mail.addAttachment(carNo + "_통합납부영수증.pdf", new ByteArrayResource(receipt), "application/pdf");
            sender.send(message);

            // 수동 재발송은 스케줄의 자동발송 완료 여부를 변경하지 않는다.
            if (scheduled) {
                stage = "발송완료처리";
                require(newcarMapper.updateRegistrationMailSent(serviceId) == 1, "발송완료_저장실패");
            }
            return true;
        } catch (Exception e) {
            // 원문 예외에는 이메일·SQL 값이 포함될 수 있으므로 인증서 오류만 상세 메시지를 기록한다.
            Throwable cause = e;
            while (cause.getCause() != null && cause.getCause() != cause) cause = cause.getCause();
            String reason = e instanceof PreparationException ? e.getMessage()
                    : e.getClass().getSimpleName() + "_" + cause.getClass().getSimpleName();
            if ((cause instanceof javax.net.ssl.SSLHandshakeException
                    || cause instanceof java.security.cert.CertificateException) && cause.getMessage() != null) {
                reason += "_" + cause.getMessage().replaceAll("[\\r\\n]+", " ");
            }
            log.warn("[등록메일실패] SERVICE_ID={} 단계={} 원인={}", serviceId, stage, reason);
            return false;
        }
    }

    // 리스·이용자명의 리스 외에는 저장값에 쉼표가 남아 있어도 첫 주소로만 발송한다.
    static InternetAddress[] storedRecipients(Map<String, Object> car) throws AddressException {
        String recipient = text(car, "CARP_MAIL");
        require(!recipient.isEmpty(), "수신이메일_없음");
        if (!"LEASE".equals(text(car, "TASK_CD"))
                || !List.of("I", "C").contains(text(car, "PROC_CD"))) {
            recipient = recipient.split(",", -1)[0].trim();
        }
        return scheduledRecipients(recipient);
    }

    // 쉼표로 주소를 분리하고 대소문자만 다른 중복 수신자는 한 번만 포함한다.
    static InternetAddress[] scheduledRecipients(String recipient) throws AddressException {
        List<InternetAddress> addresses = new ArrayList<>();
        for (String part : recipient.split(",", -1)) {
            String cleanRecipient = validateRecipient(part);
            if (addresses.stream().noneMatch(address -> address.getAddress().equalsIgnoreCase(cleanRecipient))) {
                addresses.add(new InternetAddress(cleanRecipient, true));
            }
        }
        return addresses.toArray(InternetAddress[]::new);
    }

    static String validateRecipient(String recipient) {
        if (recipient == null || recipient.isBlank() || recipient.length() > 254
                || recipient.contains("\r") || recipient.contains("\n")) {
            throw new BusinessException("이메일 주소를 확인해주세요.", 400);
        }
        String cleanRecipient = recipient.trim();
        try {
            InternetAddress address = new InternetAddress(cleanRecipient, true);
            address.validate();
            if (address.isGroup() || !cleanRecipient.equals(address.getAddress())) {
                throw new AddressException();
            }
        } catch (AddressException e) {
            throw new BusinessException("이메일 주소를 확인해주세요.", 400);
        }
        return cleanRecipient;
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
