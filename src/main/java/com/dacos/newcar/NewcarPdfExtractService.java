package com.dacos.newcar;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;

@Service
public class NewcarPdfExtractService {

    private static final Pattern CAR_ID_PATTERN = Pattern.compile("[A-Z0-9][A-Z0-9-]{8,24}");
    private static final Pattern MONEY_PATTERN = Pattern.compile("([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\\s*원");
    private static final Pattern REG_NO_PATTERN = Pattern.compile("\\d{6}-?\\d{6,7}|\\d{6}-?\\d{7}");
    private static final Pattern KOREAN_DATE_PATTERN = Pattern.compile("(\\d{4})\\s*년\\s*(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일");
    private static final DateTimeFormatter DATE_PATH_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;

    @Value("${newcar.pdf-upload-dir:./uploads/newcar-production-certificates}")
    private String pdfUploadDir;

    public Map<String, Object> extractProductionCertificate(MultipartFile file) throws IOException {
        validatePdfFile(file);

        String rawText = extractText(file.getBytes());
        return extractData(rawText, splitLines(rawText));
    }

    public List<Map<String, Object>> extractAndSaveProductionCertificates(MultipartFile[] files, UserDto user) {
        if (files == null || files.length == 0) {
            throw new BusinessException("PDF 파일을 선택해 주세요.", 400);
        }

        List<Map<String, Object>> results = new ArrayList<>();

        for (int i = 0; i < files.length; i++) {
            MultipartFile file = files[i];
            Map<String, Object> item = new HashMap<>();
            item.put("index", i + 1);
            item.put("originalFileName", file != null ? file.getOriginalFilename() : "");

            try {
                validatePdfFile(file);

                byte[] pdfBytes = file.getBytes();
                String rawText = extractText(pdfBytes);

                item.putAll(extractData(rawText, splitLines(rawText)));
                item.putAll(savePdfFile(file, pdfBytes, user));
                item.put("success", true);
            } catch (Exception e) {
                item.put("success", false);
                item.put("message", e.getMessage());
            }

            results.add(item);
        }

        return results;
    }

    private Map<String, Object> extractData(String rawText, List<String> lines) {
        Map<String, Object> data = new HashMap<>();
        data.put("carIdNo", extractCarIdNo(lines));
        data.put("carName", extractCarName(lines));
        data.put("supplyAmount", extractSupplyAmount(lines));
        data.put("ownerName", extractOwnerName(lines));
        data.put("ownerRegNo", extractOwnerRegNo(lines));
        data.put("ownerAddress", extractOwnerAddress(lines));
        data.put("firstTransferDate", extractDateAfterLabel(lines, "최초양도연월일"));
        data.put("manufactureDate", extractDateAfterLabel(lines, "제작연월일"));
        data.put("rawText", rawText);

        return data;
    }

    private Map<String, Object> savePdfFile(MultipartFile file, byte[] pdfBytes, UserDto user) throws IOException {
        String datePath = LocalDate.now().format(DATE_PATH_FORMAT);
        Path baseDir = Paths.get(pdfUploadDir).toAbsolutePath().normalize();
        Path targetDir = baseDir.resolve(datePath).normalize();

        if (!targetDir.startsWith(baseDir)) {
            throw new BusinessException("PDF 저장 경로가 올바르지 않습니다.", 500);
        }

        Files.createDirectories(targetDir);

        String originalFileName = sanitizeFileName(file.getOriginalFilename());
        String storedFileName = UUID.randomUUID() + "_" + originalFileName;
        Path targetFile = targetDir.resolve(storedFileName).normalize();

        if (!targetFile.startsWith(targetDir)) {
            throw new BusinessException("PDF 파일명이 올바르지 않습니다.", 400);
        }

        Files.write(targetFile, pdfBytes);

        String storedPath = "newcar-production-certificates/" + datePath + "/" + storedFileName;
        Map<String, Object> result = new HashMap<>();
        result.put("storedFileName", storedFileName);
        result.put("storedPath", storedPath);
        result.put("storedBy", user != null ? user.getLOGIN_ID() : "");

        return result;
    }

    private String sanitizeFileName(String originalFileName) {
        String fileName = originalFileName == null || originalFileName.isBlank()
                ? "production-certificate.pdf"
                : Paths.get(originalFileName).getFileName().toString();

        fileName = fileName.replaceAll("[\\\\/:*?\"<>|]", "_").trim();

        if (!fileName.toLowerCase().endsWith(".pdf")) {
            fileName = fileName + ".pdf";
        }

        return fileName.isBlank() ? "production-certificate.pdf" : fileName;
    }

    private void validatePdfFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("PDF 파일을 선택해 주세요.", 400);
        }

        String originalFilename = file.getOriginalFilename();
        String contentType = file.getContentType();

        boolean pdfByName = originalFilename != null && originalFilename.toLowerCase().endsWith(".pdf");
        boolean pdfByContentType = contentType != null && contentType.toLowerCase().contains("pdf");

        if (!pdfByName && !pdfByContentType) {
            throw new BusinessException("PDF 파일만 업로드할 수 있습니다.", 400);
        }
    }

    private String extractText(byte[] pdfBytes) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            return stripper.getText(document);
        }
    }

    private List<String> splitLines(String rawText) {
        List<String> lines = new ArrayList<>();

        if (rawText == null || rawText.isBlank()) {
            return lines;
        }

        for (String line : rawText.split("\\R")) {
            String normalized = normalizeText(line);
            if (!normalized.isBlank()) {
                lines.add(normalized);
            }
        }

        return lines;
    }

    private String extractCarIdNo(List<String> lines) {
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);

            if (!compact(line).contains("차대번호")) {
                continue;
            }

            String afterLabelMatched = findCarId(onlyCarIdChars(removeBeforeLabel(line, "차대번호")));
            if (!afterLabelMatched.isBlank()) {
                return afterLabelMatched;
            }

            String candidate = onlyCarIdChars(removeAfterLabel(line, "차대번호"));

            if (i > 0 && candidate.length() < 17) {
                candidate = onlyCarIdChars(lines.get(i - 1)) + candidate;
            }

            String matched = findCarId(candidate);
            if (!matched.isBlank()) {
                return matched;
            }
        }

        return findCarId(onlyCarIdChars(String.join("", lines)));
    }

    private String extractCarName(List<String> lines) {
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);

            if (!compact(line).contains("차명")) {
                continue;
            }

            String value = line;
            value = value.replaceFirst(".*차\\s*명\\s*\\(?\\s*형\\s*식\\s*\\)?\\s*", "");
            value = value.replaceFirst("\\s*연\\s*식.*", "");
            value = normalizeText(value);

            String subName = extractCarNameSuffix(lines, i + 1);
            if (!subName.isBlank()) {
                value = normalizeText(value + " " + subName);
            }

            return value;
        }

        return "";
    }

    private String extractCarNameSuffix(List<String> lines, int startIndex) {
        for (int i = startIndex; i < Math.min(lines.size(), startIndex + 3); i++) {
            String line = normalizeText(lines.get(i));
            String compact = compact(line);

            if (compact.startsWith("의")) {
                return normalizeText(line.replaceFirst("^의\\s*", ""));
            }

            if (line.matches("^[A-Z][A-Z0-9\\s\\-]{2,}$")) {
                return line;
            }
        }

        return "";
    }

    private String extractSupplyAmount(List<String> lines) {
        int supplyLabelIndex = findLineIndex(lines, "공급가액");

        if (supplyLabelIndex >= 0) {
            for (int i = supplyLabelIndex; i < Math.min(lines.size(), supplyLabelIndex + 4); i++) {
                String amount = findMoney(lines.get(i));
                if (!amount.isBlank()) {
                    return amount;
                }
            }
        }

        for (String line : lines) {
            String amount = findMoney(line);
            if (!amount.isBlank()) {
                return amount;
            }
        }

        return "";
    }

    private String extractOwnerName(List<String> lines) {
        int ownerHeaderIndex = findLineIndex(lines, "성명");

        if (ownerHeaderIndex < 0) {
            return "";
        }

        String ownerInline = lines.get(ownerHeaderIndex).replaceFirst(".*성\\s*명\\s*", "");
        ownerInline = ownerInline.replaceFirst("\\s*주민등록번호.*", "");
        ownerInline = ownerInline.replaceFirst("\\s*법인등록번호.*", "");
        ownerInline = normalizeText(ownerInline);

        if (!ownerInline.isBlank()) {
            return ownerInline;
        }

        for (int i = ownerHeaderIndex + 1; i < Math.min(lines.size(), ownerHeaderIndex + 4); i++) {
            String line = lines.get(i);
            String compact = compact(line);

            if (compact.contains("명칭") || compact.contains("법인등록번호") || compact.contains("주소")) {
                continue;
            }

            String ownerName = REG_NO_PATTERN.matcher(line).replaceAll("");
            ownerName = ownerName.replace("(명 칭)", "").replace("(명칭)", "");
            ownerName = normalizeText(ownerName);

            if (!ownerName.isBlank()) {
                return ownerName;
            }
        }

        return "";
    }

    private String extractOwnerRegNo(List<String> lines) {
        int ownerHeaderIndex = findLineIndex(lines, "성명");

        if (ownerHeaderIndex < 0) {
            return "";
        }

        for (int i = ownerHeaderIndex; i < Math.min(lines.size(), ownerHeaderIndex + 4); i++) {
            Matcher matcher = REG_NO_PATTERN.matcher(lines.get(i));
            if (matcher.find()) {
                return matcher.group();
            }
        }

        return "";
    }

    private String extractOwnerAddress(List<String> lines) {
        for (String line : lines) {
            String compact = compact(line);

            if (!compact.startsWith("주소") && !compact.contains("주소서울")) {
                continue;
            }

            String address = line.replaceFirst(".*주\\s*소\\s*", "");
            address = normalizeText(address);

            if (!address.isBlank()) {
                return address;
            }
        }

        return "";
    }

    private String extractDateAfterLabel(List<String> lines, String label) {
        int lineIndex = findLineIndex(lines, label);

        if (lineIndex < 0) {
            return "";
        }

        for (int i = lineIndex; i < Math.min(lines.size(), lineIndex + 3); i++) {
            String searchText = i == lineIndex ? removeBeforeLabel(lines.get(i), label) : lines.get(i);
            String date = findKoreanDate(searchText);

            if (!date.isBlank()) {
                return date;
            }
        }

        return "";
    }

    private String findKoreanDate(String value) {
        Matcher matcher = KOREAN_DATE_PATTERN.matcher(value);

        if (!matcher.find()) {
            return "";
        }

        int month = Integer.parseInt(matcher.group(2));
        int day = Integer.parseInt(matcher.group(3));

        return matcher.group(1) + String.format("%02d%02d", month, day);
    }

    private int findLineIndex(List<String> lines, String label) {
        String compactLabel = compact(label);

        for (int i = 0; i < lines.size(); i++) {
            if (compact(lines.get(i)).contains(compactLabel)) {
                return i;
            }
        }

        return -1;
    }

    private String findCarId(String value) {
        Matcher matcher = CAR_ID_PATTERN.matcher(value);

        while (matcher.find()) {
            String candidate = matcher.group();
            if (candidate.replace("-", "").length() >= 10) {
                return candidate;
            }
        }

        return "";
    }

    private String findMoney(String value) {
        Matcher matcher = MONEY_PATTERN.matcher(value);
        return matcher.find() ? matcher.group(1) : "";
    }

    private String removeAfterLabel(String line, String label) {
        String compactLabel = compact(label);
        String compactLine = compact(line);
        int compactLabelIndex = compactLine.indexOf(compactLabel);

        if (compactLabelIndex < 0) {
            return line;
        }

        StringBuilder result = new StringBuilder();
        int compactCursor = 0;

        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (!Character.isWhitespace(ch)) {
                if (compactCursor >= compactLabelIndex) {
                    break;
                }
                compactCursor++;
            }
            result.append(ch);
        }

        return result.toString();
    }

    private String removeBeforeLabel(String line, String label) {
        String compactLabel = compact(label);
        String compactLine = compact(line);
        int compactLabelIndex = compactLine.indexOf(compactLabel);

        if (compactLabelIndex < 0) {
            return "";
        }

        StringBuilder result = new StringBuilder();
        int compactCursor = 0;
        boolean append = false;

        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);

            if (!Character.isWhitespace(ch)) {
                if (compactCursor >= compactLabelIndex + compactLabel.length()) {
                    append = true;
                }
                compactCursor++;
            }

            if (append) {
                result.append(ch);
            }
        }

        return result.toString();
    }

    private String onlyCarIdChars(String value) {
        return value == null ? "" : value.toUpperCase().replaceAll("[^A-Z0-9-]", "");
    }

    private String compact(String value) {
        return value == null ? "" : value.replaceAll("\\s+", "");
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.replace('\u00A0', ' ').replaceAll("\\s+", " ").trim();
    }
}
