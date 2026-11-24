package com.dacos.attach;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.dacos.attach.mapper.AttachImageMapper;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.common.ServiceAccessGuard;
import com.dacos.common.ServiceAccessGuard.ServiceAction;
import com.dacos.numplateApp.NumPlateService;

@Service
public class AttachImageService {
    private static final long ALL_IMAGES_MAX_ROWS = 1000L;
    private static final long MAX_IMAGE_BYTES = 10L * 1024 * 1024;
    private final AttachImageMapper mapper;
    private final ServiceAccessGuard accessGuard;
    private final NumPlateService numPlateService;
    private Path updownfilesDir;

    public AttachImageService(AttachImageMapper mapper, ServiceAccessGuard accessGuard, NumPlateService numPlateService) {
        this.mapper = mapper;
        this.accessGuard = accessGuard;
        this.numPlateService = numPlateService;
    }

    @Value("${attach.updownfiles-dir:${UPDOWNFILES_FILE_DIR:}}")
    void configureUpdownfilesDir(String configuredDir) {
        if (configuredDir != null && !configuredDir.isBlank()) {
            updownfilesDir = Path.of(configuredDir).toAbsolutePath().normalize();
        }
    }

    public Map<String, Object> list(UserDto user, String workCd, String carNo, String startDate,
            String endDate, boolean missingReturnPlate, int page, int size) {
        return list(user, workCd, carNo, startDate, endDate, missingReturnPlate, false, page, size);
    }

    public Map<String, Object> list(UserDto user, String workCd, String carNo, String startDate,
            String endDate, boolean missingReturnPlate, boolean allImages, int page, int size) {
        AttachImageAccess.requireAccess(user);
        if (workCd == null || !Set.of("011", "030").contains(workCd)) throw new BusinessException("신청구분을 확인해 주세요.");
        if (!allImages && (page < 1 || !Set.of(10, 20, 50).contains(size))) {
            throw new BusinessException("조회 페이지를 확인해 주세요.");
        }
        String keyword = Objects.toString(carNo, "").trim();
        if (keyword.length() > 40) throw new BusinessException("차량번호는 40자 이내로 입력해 주세요.");
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        LocalDate start = date(startDate, today);
        LocalDate end = date(endDate, today);
        if (start.isAfter(end)) throw new BusinessException("시작일은 종료일 이후일 수 없습니다.");
        if (allImages && ChronoUnit.DAYS.between(start, end) > 31) {
            throw new BusinessException("전체 이미지 확인은 최대 31일 이내로 조회해 주세요.");
        }

        Map<String, Object> param = new HashMap<>();
        param.put("WORK_CD", workCd);
        param.put("CAR_NO", keyword);
        param.put("START_DT", start.format(DateTimeFormatter.BASIC_ISO_DATE));
        param.put("END_DT", end.format(DateTimeFormatter.BASIC_ISO_DATE));
        param.put("DIS_YN", missingReturnPlate);
        param.put("FIRST_ROW", allImages ? 1L : (page - 1L) * size + 1);
        param.put("LAST_ROW", allImages ? ALL_IMAGES_MAX_ROWS : (long) page * size);
        AttachImageAccess.applyScope(param, user);
        return Map.of(
                "workCd", param.get("WORK_CD"),
                "rows", mapper.getImages(param),
                "total", mapper.countImages(param),
                "page", allImages ? 1 : page,
                "size", allImages ? (int) ALL_IMAGES_MAX_ROWS : size);
    }

    public byte[] image(UserDto user, String serviceId, int slot) {
        AttachImageAccess.requireAccess(user);
        if (!isValidServiceId(serviceId) || slot < 1 || slot > 6) {
            throw new BusinessException("잘못된 사진 요청입니다.");
        }
        if (AttachImageAccess.isStaff(user)) {
            Map<String, Object> service = accessGuard.requireAccess(user, serviceId, ServiceAction.READ_ATTACHMENT);
            if (!Set.of("011", "030").contains(Objects.toString(service.get("WORK_CD"), ""))) {
                throw new BusinessException("사진을 찾을 수 없습니다.", 404);
            }
        } else {
            boolean readable = false;
            for (String workCd : new String[] { "011", "030" }) {
                if (mapper.countImages(targetScope(workCd, serviceId, user)) > 0) {
                    readable = true;
                    break;
                }
            }
            if (!readable) throw new BusinessException("사진을 찾을 수 없습니다.", 404);
        }
        return numPlateService.getCompatibleProcessImage(serviceId, slot);
    }

    public byte[] samsongImage(UserDto user, String serviceId) {
        AttachImageAccess.requireAccess(user);
        if (!isValidServiceId(serviceId)) throw new BusinessException("잘못된 사진 요청입니다.");
        if (AttachImageAccess.isStaff(user)) {
            Map<String, Object> service = accessGuard.requireAccess(user, serviceId, ServiceAction.READ_ATTACHMENT);
            if (!Set.of("011", "030").contains(Objects.toString(service.get("WORK_CD"), ""))) {
                throw new BusinessException("사진을 찾을 수 없습니다.", 404);
            }
        }
        Map<String, Object> target = findTarget(serviceId, user);
        String fileName = target == null ? "" : Objects.toString(target.get("FILENAME6"), "").trim();
        if (!fileName.matches("[A-Za-z0-9가-힣._() -]{1,200}\\.(?i:jpg|jpeg|png|gif|webp)")
                || fileName.contains("..")) {
            throw new BusinessException("사진을 찾을 수 없습니다.", 404);
        }
        for (Path root : samsongRoots()) {
            Path candidate = root.resolve(fileName).normalize();
            if (!root.equals(candidate.getParent()) || !Files.isRegularFile(candidate, LinkOption.NOFOLLOW_LINKS)) {
                continue;
            }
            try {
                if (!candidate.toRealPath().startsWith(root.toRealPath())) continue;
                if (Files.size(candidate) > MAX_IMAGE_BYTES) throw new BusinessException("사진 용량이 너무 큽니다.");
                return Files.readAllBytes(candidate);
            } catch (IOException ignored) {
            }
        }
        throw new BusinessException("사진을 찾을 수 없습니다.", 404);
    }

    public Map<String, Object> upload(
            UserDto user, String serviceId, int slot, MultipartFile file, boolean sendDriveReadySms) {
        AttachImageAccess.requireAccess(user);
        if (!isValidServiceId(serviceId) || slot < 1 || slot > 6) {
            throw new BusinessException("잘못된 사진 업로드 요청입니다.");
        }
        if (AttachImageAccess.isStaff(user)) {
            Map<String, Object> service = accessGuard.requireAccess(user, serviceId, ServiceAction.WRITE_ATTACHMENT);
            if (!Set.of("011", "030").contains(Objects.toString(service.get("WORK_CD"), ""))) {
                throw new BusinessException("대상 접수 건을 찾을 수 없습니다.", 404);
            }
        }
        Map<String, Object> target = findTarget(serviceId, user);
        if (target == null) throw new BusinessException("대상 접수 건을 찾을 수 없습니다.", 404);
        if (!AttachImageAccess.isStaff(user) && Set.of("CB307", "CB407").contains(Objects.toString(user.getCOMPANY_ID(), ""))
                && slot <= 3 && "Y".equals(target.get("CARD_YN")) && !"Y".equals(target.get("CARD_PAY_YN"))) {
            throw new BusinessException("카드 납부 완료 후 번호판 사진을 등록해 주세요.", 409);
        }
        if (slot == 6 && !"RTRNS".equals(Objects.toString(target.get("TASK_CD"), ""))) {
            throw new BusinessException("렌트매입 건만 서명 사진을 등록할 수 있습니다.", 409);
        }
        boolean smsSent = numPlateService.saveAttachmentImage(
                serviceId,
                slot,
                file,
                sendDriveReadySms,
                Objects.toString(target.get("WORK_CD"), ""),
                Objects.toString(target.get("CAR_NO"), ""),
                Objects.toString(target.get("RECEIVE_TEL_NO"), ""));
        return Map.of("serviceId", serviceId, "slot", slot, "smsSent", smsSent);
    }

    private Map<String, Object> findTarget(String serviceId, UserDto user) {
        for (String workCd : new String[] { "011", "030" }) {
            Map<String, Object> target = mapper.getImageTarget(targetScope(workCd, serviceId, user));
            if (target != null && !target.isEmpty()) return target;
        }
        return null;
    }

    private Map<String, Object> targetScope(String workCd, String serviceId, UserDto user) {
        Map<String, Object> param = new HashMap<>();
        param.put("WORK_CD", workCd);
        param.put("SERVICE_ID", serviceId);
        AttachImageAccess.applyScope(param, user);
        return param;
    }

    private List<Path> samsongRoots() {
        List<Path> roots = new ArrayList<>();
        if (updownfilesDir != null) roots.add(updownfilesDir);
        for (String raw : System.getProperty("os.name", "").startsWith("Windows")
                ? new String[] {
                        "D:/webapps/DaCOS/updownfiles/file",
                        "D:/eGovFrameDev-3.5.1-64bit/workspace/DACOS/src/main/webapp/updownfiles/file" }
                : new String[] { "/app/DaCOS/updownfiles/file", "/web/updownfiles/file" }) {
            roots.add(Path.of(raw).toAbsolutePath().normalize());
        }
        return roots;
    }

    private static boolean isValidServiceId(String serviceId) {
        return serviceId != null && serviceId.matches("[A-Za-z0-9-]{1,40}");
    }

    private static LocalDate date(String value, LocalDate fallback) {
        if (value == null || value.isBlank()) return fallback;
        if (!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw new BusinessException("조회 일자를 확인해 주세요.");
        try {
            LocalDate parsed = LocalDate.parse(value);
            if (parsed.getYear() < 1) throw new BusinessException("조회 일자를 확인해 주세요.");
            return parsed;
        } catch (DateTimeParseException exception) {
            throw new BusinessException("조회 일자를 확인해 주세요.");
        }
    }
}
