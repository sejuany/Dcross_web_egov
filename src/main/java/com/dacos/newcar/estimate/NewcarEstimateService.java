package com.dacos.newcar.estimate;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.newcar.NewcarService;
import com.dacos.newcar.mapper.NewcarMapper;

import lombok.RequiredArgsConstructor;

/**
 * 화면 입력값, 차량제원 및 운영 코드 설정을 조립하여 순수 계산기에 전달한다.
 * 이 서비스는 예상금액 조회 과정에서 DB 데이터를 변경하지 않는다.
 */
@Service
@RequiredArgsConstructor
public class NewcarEstimateService {

    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private static final Set<String> CAR_TYPES = Set.of("경차", "영업", "승용", "승합", "화물");

    private final NewcarService newcarService;
    private final NewcarMapper newcarMapper;
    private final NewcarEstimateCalculator calculator;

    public Map<String, Object> estimate(NewcarEstimateRequest request, UserDto user) {
        if (request == null) {
            throw new BusinessException("예상금액 계산 요청값이 없습니다.", 400);
        }

        Map<String, Object> service = nullSafeMap(request.getDsService());
        Map<String, Object> newCar = nullSafeMap(request.getDsNewCar());
        String companyId = text(user == null ? null : user.getCOMPANY_ID());
        String carName = firstText(newCar, service, "CAR_NM");

        if (companyId.isEmpty()) {
            throw new BusinessException("로그인 회사정보를 확인할 수 없습니다.", 401);
        }
        if (carName.isEmpty()) {
            throw new BusinessException("차량명을 입력해주세요.", 400);
        }

        // 회사는 요청값을 신뢰하지 않고 로그인 세션의 회사로 차량제원 조회 범위를 제한한다.
        Map<String, Object> carSpec = newcarService.getCarSpec(companyId, carName);
        Map<String, Object> codeConfig = newcarMapper.getEstimateCodeConfig();
        if (codeConfig == null || codeConfig.isEmpty()) {
            throw new BusinessException("예상금액 계산용 공통코드 설정을 찾을 수 없습니다.", 500);
        }

        BigDecimal buyAmt = firstNumber(newCar, carSpec, "BUY_AMT");
        if (buyAmt.signum() <= 0) {
            throw new BusinessException("취득가액을 입력해주세요.", 400);
        }

        // 차량제원은 새로 조회한 차명의 DB 값을 우선하여 이전 차명에서 남은 화면값 사용을 막는다.
        BigDecimal carCc = firstNullableNumber(carSpec, newCar, "CAR_CC");
        String area = resolveArea(firstText(
                newCar,
                service,
                "BASE_ADDRESS",
                "BOND_AREA"));
        if (area.isEmpty()) {
            throw new BusinessException("사용본거지 주소를 입력해주세요.", 400);
        }

        String multiPurposeYn = firstText(carSpec, Map.of(), "MULTI_PURPOSE_YN");
        String tyCd = multiPurposeYn.isEmpty()
                ? firstText(carSpec, newCar, "TY_CD", "VH_TY_CD")
                : ("Y".equalsIgnoreCase(multiPurposeYn) ? "3" : "");

        NewcarEstimateContext context = NewcarEstimateContext.builder()
                .serviceId(firstText(newCar, service, "SERVICE_ID"))
                .procCd(firstText(newCar, service, "PROC_CD"))
                .taskCd(firstText(newCar, service, "TASK_CD"))
                .area(area)
                .buyAmt(buyAmt)
                .carCd(resolveCarType(carSpec, newCar, carCc))
                .carCc(carCc)
                .getinNo(firstNullableNumber(carSpec, newCar, "GETIN_NO"))
                .fuelCd(firstText(carSpec, newCar, "FUEL_CD"))
                .length(firstNullableNumber(carSpec, newCar, "LENGTH", "CAR_LENGTH", "VHCL_LENGTH"))
                .width(firstNullableNumber(carSpec, newCar, "WIDTH", "CAR_WIDTH", "VHCL_WIDTH"))
                .height(firstNullableNumber(carSpec, newCar, "HEIGHT", "CAR_HEIGHT", "VHCL_HEIGHT"))
                .maxCap(firstNullableNumber(
                        carSpec,
                        newCar,
                        "MAX_CAP",
                        "MXMM_LDG",
                        "MAX_LOAD",
                        "MAX_LOAD_AMT",
                        "LOAD_AMT"))
                .totalCap(firstNullableNumber(
                        carSpec,
                        newCar,
                        "TOTAL_CAP",
                        "TOTAL_WEIGHT",
                        "TOTAL_WGHT"))
                .tyCd(tyCd)
                .fmNm(firstText(carSpec, newCar, "FM_NM"))
                .fomNm(firstText(carSpec, newCar, "FOM_NM"))
                .carNm(carName)
                .ntaxTargetCd(defaultText(firstText(newCar, service, "NTAX_TRGET_CD"), "00"))
                .ntaxTargetGradeCd(defaultText(firstText(newCar, service, "NTAX_TRGET_GR_CD"), "0"))
                .bubyn(text(codeConfig.get("BUBYN")))
                .hybridFmExclusions(text(codeConfig.get("HYBRID")))
                .hybridOkPatterns(text(codeConfig.get("HYB_OK")))
                .build();

        NewcarEstimateResult result = calculator.calculate(context);
        return toResponse(result, newCar, carSpec);
    }

    private Map<String, Object> toResponse(
            NewcarEstimateResult result,
            Map<String, Object> newCar,
            Map<String, Object> carSpec) {
        if (result == null) {
            throw new BusinessException("예상금액 계산 결과가 없습니다.", 500);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("ACQ_AMT", result.getAcqAmount());
        response.put("GROSS_ACQ_AMT", result.getGrossAcqAmount());
        response.put("ACQ_SUBTRACT_AMT", result.getAcqSubtractAmount());
        response.put("UREG_AMT", result.getUregAmount());
        response.put("BOND_PURCHASE_AMT", result.getBondPurchaseAmount());
        response.put("BOND_GROSS_AMT", result.getBondGrossAmount());
        response.put("BOND_SUBTRACT_AMT", result.getBondSubtractAmount());
        response.put("ACQ_RATIO", result.getAcqRate());
        response.put("UREG_RATIO", result.getUregRate());
        response.put("BOND_VALUE", result.getBondValue());
        response.put("BOND_VALUE_TYPE", result.getBondValueType());
        response.put("BOND_AREA", result.getBondArea());
        response.put("BOND_CAR_GB", result.getBondCarGb());
        response.put("BOND_COMPARE", result.getBondCompare());
        response.put(
                "NTAX_APPLC_CD",
                defaultText(result.getNtaxApplicationCode(), text(newCar.get("NTAX_APPLC_CD"))));
        response.put("ACQ_REASON", result.getAcqReason());
        response.put("BOND_REASON", result.getBondReason());
        response.put("CAR_SPEC", buildCarSpecSnapshot(carSpec));
        return response;
    }

    /**
     * CS.*는 계산 내부에서만 사용하고 응답에는 직렬화가 안전한 제원 필드만 노출한다.
     */
    private Map<String, Object> buildCarSpecSnapshot(Map<String, Object> carSpec) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        for (String key : new String[] {
                "MAKER",
                "INITMODEL",
                "CAR_NM",
                "MADE_DT",
                "MADE_YY",
                "CAR_CC",
                "GETIN_NO",
                "CAR_KD",
                "CAR_KD_CD",
                "FM_NM",
                "FOM_NM",
                "FUEL_CD",
                "MULTI_PURPOSE_YN",
                "BUY_AMT",
                "TY_CD",
                "VH_TY_CD",
                "VHCTY_ASORT_CODE"
        }) {
            if (carSpec.containsKey(key)) {
                snapshot.put(key, carSpec.get(key));
            }
        }

        putNormalizedSpec(snapshot, "LENGTH", carSpec, "LENGTH", "CAR_LENGTH", "VHCL_LENGTH");
        putNormalizedSpec(snapshot, "CAR_LENGTH", carSpec, "LENGTH", "CAR_LENGTH", "VHCL_LENGTH");
        putNormalizedSpec(snapshot, "WIDTH", carSpec, "WIDTH", "CAR_WIDTH", "VHCL_WIDTH");
        putNormalizedSpec(snapshot, "HEIGHT", carSpec, "HEIGHT", "CAR_HEIGHT", "VHCL_HEIGHT");
        putNormalizedSpec(
                snapshot,
                "MAX_CAP",
                carSpec,
                "MAX_CAP",
                "MXMM_LDG",
                "MAX_LOAD",
                "MAX_LOAD_AMT",
                "LOAD_AMT");
        putNormalizedSpec(
                snapshot,
                "MXMM_LDG",
                carSpec,
                "MAX_CAP",
                "MXMM_LDG",
                "MAX_LOAD",
                "MAX_LOAD_AMT",
                "LOAD_AMT");
        putNormalizedSpec(snapshot, "TOTAL_CAP", carSpec, "TOTAL_CAP", "TOTAL_WEIGHT", "TOTAL_WGHT");
        return snapshot;
    }

    private void putNormalizedSpec(
            Map<String, Object> snapshot,
            String responseKey,
            Map<String, Object> carSpec,
            String... sourceKeys) {
        Object value = firstValue(carSpec, Map.of(), sourceKeys);
        if (value != null) {
            snapshot.put(responseKey, value);
        }
    }

    private String resolveCarType(
            Map<String, Object> newCar,
            Map<String, Object> carSpec,
            BigDecimal carCc) {
        String explicit = firstText(newCar, carSpec, "CAR_CD");
        if (CAR_TYPES.contains(explicit)) {
            return explicit;
        }

        String carKind = firstText(newCar, carSpec, "CAR_KD");
        for (String type : CAR_TYPES) {
            if (carKind.contains(type)) {
                return type;
            }
        }

        String carKindCode = firstText(newCar, carSpec, "CAR_KD_CD");
        if ("4".equals(carKindCode) && carCc != null && carCc.signum() > 0
                && carCc.compareTo(new BigDecimal("1000")) <= 0) {
            return "경차";
        }

        String vehicleType = firstText(
                newCar,
                carSpec,
                "VHCTY_ASORT_CODE",
                "VEHICLE_ASORT_CODE",
                "CAR_ASORT_CD");
        return switch (vehicleType) {
            case "2" -> "승합";
            case "3" -> "화물";
            default -> "승용";
        };
    }

    private String resolveArea(String address) {
        String normalized = text(address);
        for (String county : new String[] {
                "경상남도 함양군",
                "경상남도 함안군",
                "경상남도 창원시"
        }) {
            if (normalized.startsWith(county)) {
                return county;
            }
        }
        int separator = normalized.indexOf(' ');
        return separator < 0 ? normalized : normalized.substring(0, separator);
    }

    private BigDecimal firstNumber(
            Map<String, Object> primary,
            Map<String, Object> fallback,
            String... keys) {
        BigDecimal number = firstNullableNumber(primary, fallback, keys);
        return number == null ? ZERO : number;
    }

    /**
     * Oracle NULL 비교와 같은 결과를 유지하도록 선택 제원 누락값은 0으로 치환하지 않는다.
     */
    private BigDecimal firstNullableNumber(
            Map<String, Object> primary,
            Map<String, Object> fallback,
            String... keys) {
        Object value = firstValue(primary, fallback, keys);
        if (value == null) {
            return null;
        }

        String normalized = text(value).replace(",", "");
        if (normalized.isEmpty()) {
            return null;
        }

        try {
            return new BigDecimal(normalized);
        } catch (NumberFormatException e) {
            throw new BusinessException(keys[0] + " 값이 숫자가 아닙니다.", 400);
        }
    }

    private String firstText(
            Map<String, Object> primary,
            Map<String, Object> fallback,
            String... keys) {
        return text(firstValue(primary, fallback, keys));
    }

    private Object firstValue(
            Map<String, Object> primary,
            Map<String, Object> fallback,
            String... keys) {
        for (String key : keys) {
            Object value = primary.get(key);
            if (!text(value).isEmpty()) {
                return value;
            }
        }
        for (String key : keys) {
            Object value = fallback.get(key);
            if (!text(value).isEmpty()) {
                return value;
            }
        }
        return null;
    }

    private Map<String, Object> nullSafeMap(Map<String, Object> source) {
        return source == null ? Map.of() : source;
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? Objects.toString(fallback, "") : value;
    }

    private String text(Object value) {
        return Objects.toString(value, "").trim();
    }
}
