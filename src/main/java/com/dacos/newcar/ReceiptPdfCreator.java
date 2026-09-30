package com.dacos.newcar;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.awt.Color;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import com.dacos.attach.pdf.PdfFont;
import com.dacos.attach.pdf.PdfUtil;

/** ReceiptContent.jsx와 같은 항목·계산 규칙으로 메일용 영수증을 만든다. */
public class ReceiptPdfCreator {
    public byte[] create(Map<String, Object> service, Map<String, Object> car,
            List<Map<String, Object>> payments, Map<String, Object> bond,
            Map<String, Object> company, List<Map<String, Object>> banks) throws IOException {
        BigDecimal acq = sum(payments, "ACQ");
        BigDecimal ureg = sum(payments, "UREG");
        BigDecimal inji = sum(payments, "INJI");
        BigDecimal stamp = sum(payments, "STAMP");
        BigDecimal agencyFee = sum(payments, "FEE");
        BigDecimal plateFee = sum(payments, "TNUM");
        BigDecimal bondFee = sum(payments, "BFEE");
        BigDecimal tax = acq.add(ureg).add(inji).add(stamp);
        BigDecimal fee = agencyFee.add(plateFee).add(bondFee);
        BigDecimal bondTotal = bondTotal(car, payments, bond);
        BigDecimal total = present(car.get("TOTAL_AMT")) ? amount(car.get("TOTAL_AMT"))
                : tax.add(fee).add(bondTotal);

        String bankCode = text(present(car.get("BOND_BANK_CD")) ? car.get("BOND_BANK_CD") : bond.get("BANK_CODE"));
        String bank = banks.stream().filter(b -> bankCode.equals(text(b.get("CODE_ID"))))
                .map(b -> text(b.get("CODE_NM"))).findFirst().orElse("-");
        boolean buy = "BUY".equalsIgnoreCase(Objects.toString(car.get("BOND_DC"), "").trim());
        Object receiptDate = present(bond.get("NAPBU_DT")) ? bond.get("NAPBU_DT") : car.get("REGIST_DATE");

        // 문서마다 폰트와 스트림을 생성하므로 비동기 작업 사이에 PDF 상태를 공유하지 않는다.
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            PDFont font = PdfFont.normal(document);
            PDFont bold = PdfFont.bold(document);
            try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
                drawSummary(cs, font, bold,
                        text(present(car.get("OWNER_NM")) ? car.get("OWNER_NM") : company.get("COMPANY_NM")),
                        text(present(car.get("CAR_NO")) ? car.get("CAR_NO") : car.get("REQ_CAR_NO")),
                        text(car.get("CARID_NO")), money(total));
                drawInfoBox(cs, font, bold, 14, 704, 277, "취득세 전자납부번호",
                        text(firstPayment(payments, "ACQ").get("VBANK_NO")));
                drawInfoBox(cs, font, bold, 304, 704, 277, "등록면허세 전자납부번호",
                        text(firstPayment(payments, "UREG").get("VBANK_NO")));

                drawSectionTitle(cs, bold, "1. 세금 내역", 14, 681);
                drawSectionTitle(cs, bold, "2. 수수료 내역", 304, 681);
                drawTable(cs, font, bold, 14, 663, 277, "금액",
                        new String[]{"취득세", "등록면허세", "인지세", "증지대"},
                        new String[]{money(acq), money(ureg), money(inji), money(stamp)},
                        "세금 합계 (A)", money(tax));
                drawTable(cs, font, bold, 304, 663, 277, "금액 (VAT포함)",
                        new String[]{"등록 대행 수수료", "번호판 비용", "채권 처리 대행 수수료"},
                        new String[]{money(agencyFee), money(plateFee), money(bondFee)},
                        "수수료 합계 (B)", money(fee));
                drawText(cs, bold, 7, "* 세금계산서 / 현금영수증 발행 목록", 304, 523, 37, 99, 235);

                drawSectionTitle(cs, bold, "3. 채권 " + (buy ? "매입" : "매도") + " 내역 (" + bank + ")", 14, 492);
                drawInfoBox(cs, font, bold, 14, 442, 277, "채권발행번호", text(bond.get("BND_ISU_NO")));
                drawInfoBox(cs, font, bold, 304, 442, 277, "증서번호", text(bond.get("BND_MNG_NO")));
                if (buy) {
                    drawBondBuy(cs, font, bold, bond, payments, bondTotal);
                } else {
                    drawBondSell(cs, font, bold, bond, receiptDate, bondTotal);
                }

                drawSectionTitle(cs, bold, "4. 최종 정산 내역", 14, 253);
                drawFinal(cs, font, bold, money(amount(car.get("PREREG_AMT"))), money(total),
                        money(amount(car.get("RT_AMT"))));
                dashedLine(cs, 14, 116, 581);
                drawCentered(cs, bold, 12, date(receiptDate), 297.5f, 96, 24, 33, 43);
                drawCentered(cs, font, 7,
                        "취득세(등록면허세) 납부 확인은 위택스(www.wetax.go.kr)에서 전자납부번호로 확인 및 출력이 가능합니다.",
                        297.5f, 72, 123, 132, 144);
            }
            document.save(output);
            return output.toByteArray();
        }
    }

    // 금액은 소수 오차가 없도록 BigDecimal을 사용한다. 잘못된 숫자는 0원으로 숨기지 않는다.
    static BigDecimal amount(Object value) {
        return present(value) ? new BigDecimal(value.toString().replace(",", "").trim()) : BigDecimal.ZERO;
    }

    static BigDecimal sum(List<Map<String, Object>> payments, String... kinds) {
        BigDecimal result = BigDecimal.ZERO;
        for (Map<String, Object> payment : payments) {
            for (String kind : kinds) {
                if (kind.equals(payment.get("PAY_KD"))) result = result.add(amount(payment.get("PAY_AMT")));
            }
        }
        return result;
    }

    static BigDecimal bondTotal(Map<String, Object> car, List<Map<String, Object>> payments, Map<String, Object> bond) {
        if ("BUY".equalsIgnoreCase(Objects.toString(car.get("BOND_DC"), "").trim())) {
            return amount(firstPayment(payments, "BOND").get("PAY_AMT"));
        }
        // 화면과 동일하게 FIELD28의 0원도 유효한 값이다. 없을 때만 다음 금액을 사용한다.
        if (present(bond.get("FIELD28"))) return amount(bond.get("FIELD28"));
        BigDecimal value = amount(car.get("BOND_AMT"));
        return value.signum() != 0 ? value : sum(payments, "BOND");
    }

    private static Map<String, Object> firstPayment(List<Map<String, Object>> payments, String kind) {
        return payments.stream().filter(p -> kind.equals(p.get("PAY_KD"))).findFirst().orElse(Map.of());
    }

    private static boolean present(Object value) {
        return value != null && !value.toString().isBlank();
    }

    private static String text(Object value) {
        return present(value) ? value.toString().replaceAll("[\\p{Cntrl}]", " ") : "-";
    }

    private static String date(Object value) {
        String digits = text(value).replaceAll("[^0-9]", "");
        return digits.length() < 8 ? text(value)
                : digits.substring(0, 4) + "년 " + digits.substring(4, 6) + "월 " + digits.substring(6, 8) + "일";
    }

    private static String money(BigDecimal amount) {
        return NumberFormat.getNumberInstance(Locale.KOREA).format(amount) + " 원";
    }

    private static void drawSummary(PDPageContentStream cs, PDFont font, PDFont bold,
            String customer, String carNo, String carId, String total) throws IOException {
        fill(cs, 14, 754, 567, 74, 23, 41, 58);
        drawText(cs, font, 9, "고객명(상호):", 32, 807, 255, 255, 255);
        drawText(cs, bold, 9, customer, 94, 807, 255, 255, 255);
        drawText(cs, font, 9, "차량번호:", 32, 788, 255, 255, 255);
        drawText(cs, bold, 9, carNo, 80, 788, 255, 255, 255);
        drawText(cs, font, 9, "차대번호:", 32, 769, 255, 255, 255);
        drawText(cs, bold, 9, carId, 80, 769, 255, 255, 255);
        drawRight(cs, font, 8, "납부금액 (최종 정산 합계)", 385, 806, 174, 255, 255, 255);
        drawRight(cs, bold, 20, total, 380, 777, 179, 255, 255, 255);
    }

    private static void drawInfoBox(PDPageContentStream cs, PDFont font, PDFont bold,
            float x, float y, float width, String label, String value) throws IOException {
        strokeRect(cs, x, y, width, 36, 100, 116, 139);
        drawText(cs, font, 8, label, x + 13, y + 14, 107, 114, 128);
        drawRight(cs, bold, 10, value, x + 120, y + 13, width - 133, 24, 33, 43);
    }

    private static void drawSectionTitle(PDPageContentStream cs, PDFont bold,
            String title, float x, float y) throws IOException {
        fill(cs, x, y - 3, 3, 16, 23, 41, 58);
        drawText(cs, bold, 12, title, x + 9, y, 24, 33, 43);
    }

    private static void drawTable(PDPageContentStream cs, PDFont font, PDFont bold,
            float x, float top, float width, String amountTitle,
            String[] labels, String[] values, String totalLabel, String totalValue) throws IOException {
        float headerHeight = 22;
        float rowHeight = 25;
        fill(cs, x, top - headerHeight, width, headerHeight, 240, 243, 247);
        drawText(cs, bold, 8, "항목별", x + 9, top - 15, 24, 33, 43);
        drawRight(cs, bold, 8, amountTitle, x + width * 0.55f, top - 15,
                width * 0.45f - 9, 24, 33, 43);
        float y = top - headerHeight;
        for (int i = 0; i < labels.length; i++) {
            y -= rowHeight;
            drawText(cs, font, 8, labels[i], x + 9, y + 9, 75, 85, 99);
            drawRight(cs, font, 8, values[i], x + width * 0.55f, y + 9,
                    width * 0.45f - 9, 24, 33, 43);
            line(cs, x, y, x + width, y, 223, 228, 234);
        }
        y -= rowHeight;
        fill(cs, x, y, width, rowHeight, 250, 250, 250);
        drawText(cs, bold, 8, totalLabel, x + 9, y + 9, 24, 33, 43);
        drawRight(cs, bold, 8, totalValue, x + width * 0.55f, y + 9,
                width * 0.45f - 9, 24, 33, 43);
        line(cs, x, y, x + width, y, 223, 228, 234);
    }

    private static void drawBondSell(PDPageContentStream cs, PDFont font, PDFont bold,
            Map<String, Object> bond, Object receiptDate, BigDecimal total) throws IOException {
        String[] labels = {"(1) 채권금액", "(2) 선급이자", "(3) 소득(법인)세", "(4) 주민세",
                "(5) 채권 처리 대행 수수료", "(6) 금융결제원 수수료", "(7) 매도금액", "납부일자"};
        String[] fields = {"FIELD16", "FIELD24", "FIELD25", "FIELD26", "FIELD27", "FIELD18", "FIELD23"};
        String[] values = new String[8];
        for (int i = 0; i < fields.length; i++) values[i] = money(amount(bond.get(fields[i])));
        values[7] = date(receiptDate);
        drawBondCells(cs, font, bold, labels, values);
        fill(cs, 14, 278, 567, 43, 255, 255, 255);
        strokeRect(cs, 14, 278, 567, 43, 223, 228, 234);
        drawText(cs, bold, 9, "본인부담금 합계 (C)", 24, 301, 24, 33, 43);
        drawText(cs, font, 6, "{(1)+(3)+(4)+(5)+(6)} - {(2)+(7)}", 24, 287, 123, 132, 144);
        drawRight(cs, bold, 10, money(total), 430, 296, 137, 24, 33, 43);
    }

    private static void drawBondBuy(PDPageContentStream cs, PDFont font, PDFont bold,
            Map<String, Object> bond, List<Map<String, Object>> payments, BigDecimal total) throws IOException {
        drawBondCells(cs, font, bold,
                new String[]{"채권금액", "처리일자"},
                new String[]{money(amount(firstPayment(payments, "BOND").get("REAL_ALOAN"))), date(bond.get("NAPBU_DT"))});
        fill(cs, 14, 348, 567, 38, 255, 255, 255);
        strokeRect(cs, 14, 348, 567, 38, 223, 228, 234);
        drawText(cs, font, 8, "수납금액(본인부담액)", 24, 362, 75, 85, 99);
        drawRight(cs, bold, 9, money(total), 430, 362, 137, 24, 33, 43);
    }

    private static void drawBondCells(PDPageContentStream cs, PDFont font, PDFont bold,
            String[] labels, String[] values) throws IOException {
        float x = 14;
        float top = 429;
        float width = 567;
        float columnWidth = width / 2;
        float rowHeight = 27;
        int rows = (labels.length + 1) / 2;
        for (int row = 0; row < rows; row++) {
            float y = top - (row + 1) * rowHeight;
            for (int column = 0; column < 2; column++) {
                int index = row * 2 + column;
                if (index >= labels.length) continue;
                float cellX = x + column * columnWidth;
                strokeRect(cs, cellX, y, columnWidth, rowHeight, 223, 228, 234);
                drawText(cs, font, 7, labels[index], cellX + 9, y + 10, 75, 85, 99);
                drawRight(cs, bold, 7, values[index], cellX + 135, y + 10,
                        columnWidth - 144, 24, 33, 43);
            }
        }
    }

    private static void drawFinal(PDPageContentStream cs, PDFont font, PDFont bold,
            String deposited, String registered, String refund) throws IOException {
        strokeRect(cs, 14, 145, 567, 91, 207, 213, 220);
        drawText(cs, font, 10, "고객 입금 금액", 31, 211, 24, 33, 43);
        drawRight(cs, bold, 11, deposited, 420, 211, 142, 24, 33, 43);
        drawText(cs, font, 10, "등록 금액", 31, 188, 24, 33, 43);
        drawRight(cs, bold, 11, registered, 420, 188, 142, 24, 33, 43);
        line(cs, 31, 177, 562, 177, 223, 228, 234);
        drawText(cs, font, 11, "환불 금액", 31, 158, 24, 33, 43);
        drawRight(cs, bold, 11, refund, 420, 158, 142, 239, 43, 45);
    }

    private static void fill(PDPageContentStream cs, float x, float y, float width, float height,
            int r, int g, int b) throws IOException {
        cs.setNonStrokingColor(new Color(r, g, b));
        cs.addRect(x, y, width, height);
        cs.fill();
    }

    private static void strokeRect(PDPageContentStream cs, float x, float y, float width, float height,
            int r, int g, int b) throws IOException {
        cs.setStrokingColor(new Color(r, g, b));
        cs.addRect(x, y, width, height);
        cs.stroke();
    }

    private static void line(PDPageContentStream cs, float x1, float y1, float x2, float y2,
            int r, int g, int b) throws IOException {
        cs.setStrokingColor(new Color(r, g, b));
        PdfUtil.drawLine(cs, x1, y1, x2, y2);
    }

    private static void dashedLine(PDPageContentStream cs, float x1, float y, float x2) throws IOException {
        cs.setStrokingColor(new Color(207, 213, 220));
        cs.setLineDashPattern(new float[]{3, 2}, 0);
        PdfUtil.drawLine(cs, x1, y, x2, y);
        cs.setLineDashPattern(new float[]{}, 0);
    }

    private static void drawText(PDPageContentStream cs, PDFont font, int size, String value,
            float x, float y, int r, int g, int b) throws IOException {
        cs.setNonStrokingColor(new Color(r, g, b));
        PdfUtil.drawText(cs, font, size, value, x, y);
    }

    private static void drawRight(PDPageContentStream cs, PDFont font, int size, String value,
            float x, float y, float width, int r, int g, int b) throws IOException {
        int fitted = size;
        while (fitted > 6 && font.getStringWidth(value) / 1000 * fitted > width) fitted--;
        float textWidth = font.getStringWidth(value) / 1000 * fitted;
        drawText(cs, font, fitted, value, x + width - textWidth, y, r, g, b);
    }

    private static void drawCentered(PDPageContentStream cs, PDFont font, int size, String value,
            float centerX, float y, int r, int g, int b) throws IOException {
        float textWidth = font.getStringWidth(value) / 1000 * size;
        drawText(cs, font, size, value, centerX - textWidth / 2, y, r, g, b);
    }
}
