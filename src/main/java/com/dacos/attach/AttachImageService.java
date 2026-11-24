package com.dacos.attach;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.dacos.attach.mapper.AttachImageMapper;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.common.ServiceAccessGuard;
import com.dacos.common.ServiceAccessGuard.ServiceAction;
import com.dacos.numplateApp.NumPlateService;

@Service
public class AttachImageService {
    private final AttachImageMapper mapper;
    private final ServiceAccessGuard accessGuard;
    private final NumPlateService numPlateService;

    public AttachImageService(AttachImageMapper mapper, ServiceAccessGuard accessGuard, NumPlateService numPlateService) {
        this.mapper = mapper;
        this.accessGuard = accessGuard;
        this.numPlateService = numPlateService;
    }

    public Map<String, Object> list(UserDto user, String workCd, String carNo, String startDate,
            String endDate, boolean missingReturnPlate, int page, int size) {
        requireStaff(user);
        if (workCd == null || !Set.of("011", "030").contains(workCd)) throw new BusinessException("신청구분을 확인해 주세요.");
        if (page < 1 || !Set.of(10, 20, 50).contains(size)) throw new BusinessException("조회 페이지를 확인해 주세요.");
        String keyword = Objects.toString(carNo, "").trim();
        if (keyword.length() > 40) throw new BusinessException("차량번호는 40자 이내로 입력해 주세요.");
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        LocalDate start = date(startDate, today);
        LocalDate end = date(endDate, today);
        if (start.isAfter(end)) throw new BusinessException("시작일은 종료일 이후일 수 없습니다.");

        Map<String, Object> param = new HashMap<>();
        param.put("WORK_CD", workCd);
        param.put("CAR_NO", keyword);
        param.put("START_DT", start.format(DateTimeFormatter.BASIC_ISO_DATE));
        param.put("END_DT", end.format(DateTimeFormatter.BASIC_ISO_DATE));
        param.put("DIS_YN", missingReturnPlate);
        param.put("FIRST_ROW", (page - 1L) * size + 1);
        param.put("LAST_ROW", (long) page * size);
        return Map.of("rows", mapper.getImages(param), "total", mapper.countImages(param), "page", page, "size", size);
    }

    public byte[] image(UserDto user, String serviceId, int slot) {
        requireStaff(user);
        if (serviceId == null || !serviceId.matches("[A-Za-z0-9-]{1,40}") || slot < 1 || slot > 6) {
            throw new BusinessException("잘못된 사진 요청입니다.");
        }
        Map<String, Object> service = accessGuard.requireAccess(user, serviceId, ServiceAction.READ_ATTACHMENT);
        if (!Set.of("011", "030").contains(Objects.toString(service.get("WORK_CD"), ""))) {
            throw new BusinessException("사진을 찾을 수 없습니다.", 404);
        }
        return numPlateService.getCompatibleProcessImage(serviceId, slot);
    }

    private static void requireStaff(UserDto user) {
        if (user == null) throw new BusinessException("로그인 정보가 없습니다.", 401);
        if (!Set.of("UA", "UC", "UU").contains(Objects.toString(user.getMEMBER_GB(), ""))) {
            throw new BusinessException("직원 계정으로 이용해 주세요.", 403);
        }
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
