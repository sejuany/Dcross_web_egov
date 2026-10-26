package com.dacos.newcar;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import com.dacos.common.BusinessException;

/** W 화면의 신청 조건은 브라우저 검사와 별개로 서버에서도 확인한다. */
final class NewcarWValidation {
    private NewcarWValidation() {}
    private static final Set<String> GRADE_TARGETS = Set.of("01", "02", "03", "04", "05", "14");
    static String text(Map<String, Object> row, String key) { return Objects.toString(row.get(key), "").trim(); }
    private static void require(Map<String, Object> row, String... keys) {
        for (String key : keys) if (text(row, key).isEmpty()) fail("필수 입력값을 확인해 주세요. (" + key + ")");
    }
    static void fail(String message) { throw new BusinessException(message, 400); }
    private static boolean email(String value) { return value.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"); }
    private static String digits(Map<String, Object> row, String key) { return text(row, key).replaceAll("\\D", ""); }
    private static void registration(Map<String, Object> row, String gb, String reg, String biz) {
        require(row, gb, reg);
        if (!Set.of("B", "C", "R", "F").contains(text(row, gb))) fail("등록구분을 확인해 주세요.");
        if (digits(row, reg).length() != ("C".equals(text(row, gb)) ? 10 : 13)) fail("등록번호 자릿수를 확인해 주세요.");
        if ("B".equals(text(row, gb)) && digits(row, biz).length() != 10) fail("사업자번호 10자리를 확인해 주세요.");
    }
    private static void phone(Map<String, Object> row, String key) {
        if (!digits(row, key).matches("[0-9]{9,11}")) fail("전화번호를 확인해 주세요. (" + key + ")");
    }
    static BigDecimal number(Map<String, Object> row, String key) {
        try { return new BigDecimal(text(row, key).replace(",", "")); }
        catch (NumberFormatException e) { fail("숫자 입력값을 확인해 주세요. (" + key + ")"); return BigDecimal.ZERO; }
    }
    static void validate(Map<String, Object> service, Map<String, Object> car, Map<String, Object> detach,
            List<Map<String, Object>> owners, Map<String, Object> tax, boolean application) {
        if (!text(car, "CARID_NO").matches("[A-Z0-9]{17}")) fail("차대번호 17자리를 확인해 주세요.");
        String mail = text(car, "CARP_MAIL");
        if (mail.length() > 50 || (!mail.isEmpty() && !email(mail))) fail("등록증 이메일 주소를 확인해 주세요.");
        if (text(car, "MEMO_TX").length() > 2000) fail("메모는 2000자 이내로 입력해 주세요.");
        if (!application) return;
        require(service, "LINK_ID");
        require(detach, "CUSTOMER_NM", "HOLE_YN", "SEAL_YN");
        require(car, "TASK_CD", "REGIST_DATE", "NUMPLATE_GB", "BUY_AMT", "OWNER_NM", "RATIO_NO",
                "MPHONE_NO", "ADDRESS", "BASE_ADDRESS", "NTAX_TRGET_CD", "CARD_YN", "BOND_DC", "PAY_NM",
                "PAY_HP_NO", "RT_BANK_CD", "RETURN_NO", "RETURN_NM", "CARP_ADDRESS");
        if (!Set.of("NORML", "LEASE").contains(text(car, "TASK_CD"))) fail("업무구분을 확인해 주세요.");
        if (number(car, "BUY_AMT").signum() <= 0 || number(car, "BUY_AMT").scale() > 0) fail("공급가액은 0보다 큰 정수여야 합니다.");
        try { LocalDate.parse(text(car, "REGIST_DATE")); }
        catch (Exception e) { fail("등록예정일자를 확인해 주세요."); }
        if (!Set.of("Y", "N").contains(text(car, "CARD_YN"))) fail("카드납부 여부를 확인해 주세요.");
        registration(car, "REG_GB", "REG_NO", "BIZ_NO");
        phone(car, "MPHONE_NO"); phone(car, "PAY_HP_NO");
        BigDecimal ratio = number(car, "RATIO_NO");
        if (ratio.signum() <= 0 || ratio.compareTo(BigDecimal.valueOf(100)) > 0) fail("대표소유자 비율을 확인해 주세요.");
        BigDecimal total = ratio;
        for (int i = 0; i < owners.size(); i++) {
            Map<String, Object> owner = owners.get(i);
            boolean active = !text(owner, "DEBTOR_NM").isEmpty()
                    || (!text(owner, "DEBTOR_RATIO").isEmpty() && number(owner, "DEBTOR_RATIO").signum() > 0);
            if (i == 0 && ratio.compareTo(BigDecimal.valueOf(100)) < 0) active = true;
            if (!active) continue;
            require(owner, "DEBTOR_NM", "DEBTOR_TEL_NO", "DEBTOR_RATIO");
            registration(owner, "DEBTOR_GB", "DEBTOR_REG_NO", "DEBTOR_BIZ_NO");
            phone(owner, "DEBTOR_TEL_NO");
            BigDecimal share = number(owner, "DEBTOR_RATIO");
            if (share.signum() <= 0 || ratio.compareTo(BigDecimal.valueOf(100)) == 0) fail("공동소유자 비율을 확인해 주세요.");
            total = total.add(share);
        }
        if (total.compareTo(BigDecimal.valueOf(100)) != 0) fail("대표·공동소유자 비율 합계는 100%이어야 합니다.");
        if (GRADE_TARGETS.contains(text(car, "NTAX_TRGET_CD"))
                && (text(car, "NTAX_TRGET_GR_CD").isEmpty() || "0".equals(text(car, "NTAX_TRGET_GR_CD")))) fail("비과세대상등급을 선택해 주세요.");
        if (!"00".equals(text(car, "NTAX_TRGET_CD"))) require(car, "NTAX_WHO");
        String type = text(tax, "GUBUN");
        if ("TAX".equals(type)) {
            require(tax, "REG_NO", "COMPANY_NM", "NAME", "ADDR", "BUSINESS_TYPE", "INDUSTRY_TYPE", "MAIL1");
            if (digits(tax, "REG_NO").length() != 10 || !email(text(tax, "MAIL1"))
                    || (!text(tax, "MAIL2").isEmpty() && !email(text(tax, "MAIL2")))) fail("세금계산서 사업자번호·이메일을 확인해 주세요.");
        } else if ("CASH".equals(type)) {
            if (!text(tax, "REG_NO").isEmpty()) {
                if (digits(tax, "REG_NO").length() != 10) fail("현금영수증 사업자번호를 확인해 주세요.");
            } else phone(tax, "PHONE_NO");
        } else if (!type.isEmpty()) fail("증빙 종류를 확인해 주세요.");
    }
}
