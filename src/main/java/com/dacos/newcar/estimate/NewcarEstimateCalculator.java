package com.dacos.newcar.estimate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Component;

/**
 * 운영 패키지 {@code sp_NewCarTaxBondConfirm}의 취득세, 등록면허세, 공채 계산을
 * DB 변경 없이 재현하는 순수 계산기다.
 *
 * <p>Oracle NUMBER의 중간 계산값을 잃지 않도록 모든 금액 계산에
 * {@link BigDecimal}을 사용하며, 프로시저와 같이 최종 단계에서만 절사한다.</p>
 */
@Component
public class NewcarEstimateCalculator {

    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private static final BigDecimal NEGATIVE_ONE = BigDecimal.ONE.negate();
    private static final BigDecimal TEN = BigDecimal.TEN;
    private static final BigDecimal FIVE_THOUSAND = new BigDecimal("5000");
    private static final BigDecimal TEN_THOUSAND = new BigDecimal("10000");
    private static final BigDecimal SEVEN_HUNDRED_THOUSAND = new BigDecimal("700000");
    private static final BigDecimal SEVEN_HUNDRED_FIFTY_THOUSAND = new BigDecimal("750000");
    private static final BigDecimal ONE_MILLION_FOUR_HUNDRED_THOUSAND = new BigDecimal("1400000");
    private static final BigDecimal ONE_MILLION_FIVE_HUNDRED_THOUSAND = new BigDecimal("1500000");
    private static final BigDecimal TWO_MILLION = new BigDecimal("2000000");
    private static final BigDecimal TWO_MILLION_FIVE_HUNDRED_THOUSAND = new BigDecimal("2500000");

    private static final Set<String> ACQ_ECO_EXCLUDED_CAR_NAMES = Set.of(
            normalizeCarName("타이칸 크로스 투리스모 터보 (5인승)"),
            normalizeCarName("Polestar 4 Coupe Performance"),
            normalizeCarName("Polestar 4 Long Range Dual Motor"));

    private static final String ORIGINAL_BOND_ECO_EXCLUDED_CAR_NAME =
            "타이칸 크로스 투리스모 터보 (5인승)";

    private final NewcarBondRuleResolver bondRuleResolver;

    public NewcarEstimateCalculator(NewcarBondRuleResolver bondRuleResolver) {
        this.bondRuleResolver = bondRuleResolver;
    }

    /**
     * 예상 취득세, 등록면허세, 공채 매입기준금액을 계산한다.
     */
    public NewcarEstimateResult calculate(NewcarEstimateContext context) {
        if (context == null) {
            throw new IllegalArgumentException("신규등록 예상금액 계산 정보가 없습니다.");
        }
        if (context.getBuyAmt() == null) {
            throw new IllegalArgumentException("취득가액(BUY_AMT)이 없습니다.");
        }

        EcoEligibility ecoEligibility = resolveEcoEligibility(context);
        AcquisitionCalculation acquisition = calculateAcquisition(context, ecoEligibility);
        BondCalculation bond = calculateBond(context, ecoEligibility);

        BigDecimal grossAcqAmount = acquisition.grossAmount();
        BigDecimal acqSubtractAmount = oracleTrunc(acquisition.reliefSubtractAmount(), 0);
        String ntaxApplicationCode = acquisition.reliefApplied()
                ? (acquisition.amount().compareTo(ZERO) == 0 ? "8" : "11")
                : "0";

        return NewcarEstimateResult.builder()
                .acqAmount(acquisition.amount())
                .uregAmount(acquisition.uregAmount())
                .bondPurchaseAmount(bond.amount())
                .acqRate(acquisition.acqRate())
                .uregRate(acquisition.uregRate())
                .grossAcqAmount(grossAcqAmount)
                .acqSubtractAmount(acqSubtractAmount)
                .bondGrossAmount(bond.grossAmount())
                .bondSubtractAmount(bond.subtractAmount())
                .bondCarGb(bond.carGb())
                .bondCompare(bond.compare())
                .bondArea(bond.area())
                .bondValue(bond.value())
                .bondValueType(bond.valueType())
                .ntaxApplicationCode(ntaxApplicationCode)
                .acqReason(String.join(" / ", acquisition.reasons()))
                .bondReason(String.join(" / ", bond.reasons()))
                .build();
    }

    private AcquisitionCalculation calculateAcquisition(
            NewcarEstimateContext context,
            EcoEligibility ecoEligibility) {

        String procCd = oracleString(context.getProcCd());
        String taskCd = oracleString(context.getTaskCd());
        String carCd = oracleString(context.getCarCd());
        String ntaxTargetCd = oracleString(context.getNtaxTargetCd());

        BigDecimal acqRate;
        BigDecimal uregRate = null;

        if ("C".equals(procCd)) {
            acqRate = new BigDecimal("0.02");

            if ("ADD".equals(taskCd)) {
                uregRate = new BigDecimal("0.02");
            } else if ("경차".equals(carCd) || "영업".equals(carCd)) {
                uregRate = new BigDecimal("0.02");
            } else if ("승합".equals(carCd) || "화물".equals(carCd)) {
                uregRate = new BigDecimal("0.03");
            } else {
                uregRate = new BigDecimal("0.05");
            }
        } else if ("경차".equals(carCd) || "영업".equals(carCd)) {
            acqRate = new BigDecimal("0.04");
        } else if ("승합".equals(carCd) || "화물".equals(carCd)) {
            acqRate = new BigDecimal("0.05");
        } else {
            acqRate = new BigDecimal("0.07");
        }

        BigDecimal grossAmount = context.getBuyAmt().multiply(acqRate);
        BigDecimal amount = grossAmount;
        BigDecimal uregAmount = uregRate == null
                ? null
                : oracleTrunc(context.getBuyAmt().multiply(uregRate), -1);
        BigDecimal acqSubtract = ZERO;
        List<String> reasons = new ArrayList<>();

        if ("경차".equals(carCd)) {
            amount = amount.subtract(SEVEN_HUNDRED_FIFTY_THOUSAND);
            reasons.add("경차 취득세 750,000원 감면");
        }

        boolean ntaxTarget = true;
        if ("04".equals(ntaxTargetCd)) {
            ntaxTarget = !greaterThan(
                    oracleNumber(context.getNtaxTargetGradeCd()),
                    new BigDecimal("3"));
        } else if ("05".equals(ntaxTargetCd)) {
            ntaxTarget = !greaterThan(
                    oracleNumber(context.getNtaxTargetGradeCd()),
                    new BigDecimal("4"));
        }

        if (isCommonNtaxTarget(ntaxTargetCd) && ntaxTarget) {
            if ("인천광역시".equals(oracleString(context.getArea()))
                    && "05".equals(ntaxTargetCd)
                    && "4".equals(oracleString(context.getNtaxTargetGradeCd()))) {
                if (greaterThanOrEqual(amount, TWO_MILLION)) {
                    amount = amount.multiply(new BigDecimal("0.15"));
                    reasons.add("인천 시각장애 4급 취득세 15% 과세");
                }
            } else if (isSpecialVehicleEligible(context)) {
                amount = ZERO;
                reasons.add("비과세 대상 취득세 전액면제");
            }
        } else if ("06".equals(ntaxTargetCd)) {
            if ("승용".equals(carCd)) {
                if (lessThanOrEqual(context.getGetinNo(), new BigDecimal("6"))) {
                    amount = amount.subtract(ONE_MILLION_FOUR_HUNDRED_THOUSAND);
                    reasons.add("3자녀 취득세 1,400,000원 감면");
                } else if (greaterThanOrEqual(context.getGetinNo(), new BigDecimal("7"))) {
                    amount = applyTwoMillionThreshold(amount);
                    reasons.add("3자녀 취득세 2,000,000원 경계 감면");
                }
            } else if ("승합".equals(carCd)
                    && lessThanOrEqual(context.getGetinNo(), new BigDecimal("15"))) {
                amount = applyTwoMillionThreshold(amount);
                reasons.add("3자녀 승합차 취득세 감면");
            } else if ("화물".equals(carCd)
                    && lessThanOrEqual(context.getMaxCap(), new BigDecimal("1000"))) {
                amount = applyTwoMillionThreshold(amount);
                reasons.add("3자녀 화물차 취득세 감면");
            }
        } else if ("15".equals(ntaxTargetCd)) {
            acqSubtract = amount.multiply(new BigDecimal("0.5"));
            if ("승용".equals(carCd)
                    && lessThanOrEqual(context.getGetinNo(), new BigDecimal("6"))
                    && acqSubtract.compareTo(SEVEN_HUNDRED_THOUSAND) > 0) {
                acqSubtract = SEVEN_HUNDRED_THOUSAND;
            }
            amount = amount.subtract(acqSubtract);
            reasons.add("2자녀 취득세 50% 감면");
        }

        String fuelCd = oracleString(context.getFuelCd());
        if (isHybridFuel(fuelCd) && "N".equals(oracleString(context.getBubyn()))) {
            if (ecoEligibility.acquisitionEligible()
                    && (ntaxTargetCd == null || "00".equals(ntaxTargetCd))) {
                amount = amount.subtract(new BigDecimal("400000"));
                reasons.add("하이브리드 취득세 400,000원 감면");
            }
        } else if ("e".equals(fuelCd) || "q".equals(fuelCd)) {
            boolean taycanFallback = !isOriginalEcoExcludedCar(context.getCarNm())
                    && equalTo(context.getGetinNo(), new BigDecimal("5"))
                    && contains(context.getCarNm(), "타이칸");
            if (ecoEligibility.acquisitionEligible() || taycanFallback) {
                if (ntaxTargetCd == null || "00".equals(ntaxTargetCd)) {
                    amount = amount.subtract(ONE_MILLION_FOUR_HUNDRED_THOUSAND);
                    reasons.add("전기차 취득세 1,400,000원 감면");
                } else if ("15".equals(ntaxTargetCd)
                        && acqSubtract.compareTo(ONE_MILLION_FOUR_HUNDRED_THOUSAND) < 0) {
                    amount = amount.subtract(ONE_MILLION_FOUR_HUNDRED_THOUSAND.subtract(acqSubtract));
                    reasons.add("2자녀 감면 대신 전기차 1,400,000원 감면");
                }
            }
        }

        BigDecimal amountAfterRelief = positive(amount);
        BigDecimal reliefSubtractAmount = positive(grossAmount.subtract(amountAfterRelief));
        boolean reliefApplied = reliefSubtractAmount.compareTo(ZERO) > 0;
        amount = oracleTrunc(amountAfterRelief, -1);

        return new AcquisitionCalculation(
                amount,
                uregAmount,
                acqRate,
                uregRate,
                grossAmount,
                reliefSubtractAmount,
                reliefApplied,
                reasons);
    }

    private BondCalculation calculateBond(
            NewcarEstimateContext context,
            EcoEligibility ecoEligibility) {

        String area = oracleString(context.getArea());
        String areaForRule = area;
        String carCd = oracleString(context.getCarCd());
        String fuelCd = oracleString(context.getFuelCd());
        String procCd = oracleString(context.getProcCd());
        String taskCd = oracleString(context.getTaskCd());
        String ntaxTargetCd = oracleString(context.getNtaxTargetCd());

        BigDecimal bond = NEGATIVE_ONE;
        BigDecimal bondSubtract = ZERO;
        BigDecimal bondGross = ZERO;
        String carGb = null;
        BigDecimal compare = null;
        String bondValue = null;
        String bondValueType = "EXEMPT";
        List<String> reasons = new ArrayList<>();

        if (isBetween(ntaxTargetCd, "01", "05")
                || "07".equals(ntaxTargetCd)
                || "13".equals(ntaxTargetCd)) {
            bond = ZERO;
            reasons.add("비과세 대상 공채 전액면제");
        }

        if ("영업".equals(carCd)) {
            bond = ZERO;
            reasons.add("영업용 공채 전액면제");
        }

        if (Set.of("부산광역시", "대구광역시", "경상남도 창원시").contains(area)
                && (notEqual(carCd, "승용")
                    || lessThan(context.getCarCc(), TWO_MILLION.movePointLeft(3))
                    || "3".equals(oracleString(context.getTyCd()))
                    || isBetween(context.getGetinNo(), new BigDecimal("7"), new BigDecimal("10")))) {
            bond = ZERO;
            reasons.add(area + " 차종 조건 공채 면제");
        }

        if ("승용".equals(carCd) && lessThan(context.getCarCc(), new BigDecimal("1600"))) {
            boolean seoulElectricNormal = "서울특별시".equals(area)
                    && isElectricOrHydrogen(fuelCd)
                    && "00".equals(ntaxTargetCd);
            boolean seoulUnderOneThousand = "서울특별시".equals(area)
                    && lessThan(context.getCarCc(), new BigDecimal("1000"))
                    && ("00".equals(ntaxTargetCd) || "15".equals(ntaxTargetCd));
            if (seoulElectricNormal || seoulUnderOneThousand) {
                bond = NEGATIVE_ONE;
            } else {
                bond = ZERO;
                reasons.add("1600cc 미만 승용차 공채 매입의무 면제");
            }
        }

        if ("경기도".equals(area)
                && ("e".equals(fuelCd) || "q".equals(fuelCd) || "r".equals(fuelCd))) {
            bond = ZERO;
            reasons.add("경기도 전기차 공채 전액면제");
        }
        if ("인천광역시".equals(area) && isHybridFuel(fuelCd)) {
            bond = ZERO;
            reasons.add("인천 하이브리드 공채 전액면제");
        }
        if ("부산광역시".equals(area)
                && ("e".equals(fuelCd) || isBetween(fuelCd, "l", "q"))) {
            bond = ZERO;
            reasons.add("부산 친환경차 공채 전액면제");
        }
        if ("대구광역시".equals(area)
                && ("e".equals(fuelCd) || isBetween(fuelCd, "l", "q"))) {
            bond = ZERO;
            reasons.add("대구 친환경차 공채 전액면제");
        }
        if (Set.of("경상남도", "경상남도 함양군", "경상남도 함안군", "경상남도 창원시").contains(area)
                && ("e".equals(fuelCd) || isBetween(fuelCd, "l", "q"))) {
            bond = ZERO;
            reasons.add("경상남도 친환경차 공채 전액면제");
        }
        if (Set.of("전라북도", "전북특별자치도").contains(area)
                && ("06".equals(ntaxTargetCd) || "15".equals(ntaxTargetCd))) {
            bond = ZERO;
            reasons.add("전북 다자녀 공채 전액면제");
        }
        if ("경기도".equals(area) && "LEASE".equals(taskCd) && notEqual(procCd, "C")) {
            bond = ZERO;
            reasons.add("경기도 리스차량 공채 전액면제");
        }
        if ("인천광역시".equals(area)
                && greaterThanOrEqual(context.getCarCc(), new BigDecimal("2000"))
                && ("C".equals(procCd) || "LEASE".equals(taskCd))) {
            bond = ZERO;
            reasons.add("인천 리스차량 공채 전액면제");
        }
        if ("대구광역시".equals(area) && ("C".equals(procCd) || "LEASE".equals(taskCd))) {
            bond = ZERO;
            reasons.add("대구 리스차량 공채 전액면제");
        }
        if ("충청북도".equals(area) && ("C".equals(procCd) || "LEASE".equals(taskCd))) {
            bond = ZERO;
            reasons.add("충북 리스차량 공채 전액면제");
        }

        if (bond.compareTo(NEGATIVE_ONE) == 0) {
            if (isElectricOrHydrogen(fuelCd) && ecoEligibility.bondEligible()) {
                if ("부산광역시".equals(area)) {
                    bondSubtract = TWO_MILLION_FIVE_HUNDRED_THOUSAND;
                } else if ("서울특별시".equals(area)) {
                    bondSubtract = lessThanOrEqual(context.getGetinNo(), new BigDecimal("6"))
                            ? TWO_MILLION_FIVE_HUNDRED_THOUSAND
                            : ZERO;
                } else if ("대구광역시".equals(area) || "인천광역시".equals(area)) {
                    bondSubtract = TWO_MILLION_FIVE_HUNDRED_THOUSAND;
                } else if (Set.of(
                        "강원도", "강원특별자치도", "광주광역시", "경상북도", "충청북도",
                        "충청남도", "전라북도", "전북특별자치도", "전남광주통합특별시").contains(area)) {
                    bondSubtract = ONE_MILLION_FIVE_HUNDRED_THOUSAND;
                } else if (!"제주특별자치도".equals(area) && !"울산광역시".equals(area)) {
                    bond = ZERO;
                    reasons.add("전기/수소차 공채 전액면제");
                }
            } else if (isHybridFuel(fuelCd) && ecoEligibility.bondEligible()) {
                if (Set.of("서울특별시", "부산광역시", "대구광역시").contains(area)) {
                    if (lessThan(context.getGetinNo(), new BigDecimal("7"))) {
                        bondSubtract = ONE_MILLION_FOUR_HUNDRED_THOUSAND;
                    }
                } else if (Set.of(
                        "제주특별자치도", "강원도", "강원특별자치도", "광주광역시",
                        "경상북도", "충청북도", "충청남도", "울산광역시",
                        "전라북도", "전북특별자치도", "경기도").contains(area)) {
                    bondSubtract = ZERO;
                } else {
                    bondSubtract = ONE_MILLION_FIVE_HUNDRED_THOUSAND;
                }
            }

            if (bond.compareTo(NEGATIVE_ONE) == 0) {
                BondSearch search = resolveBondSearch(context, areaForRule);
                areaForRule = search.area();
                carGb = search.carGb();
                compare = search.compare();
                bondValue = bondRuleResolver.resolveBondValue(areaForRule, carGb, compare);
                if (bondValue == null || bondValue.isBlank()) {
                    throw new IllegalStateException("적용할 TM_BOND 규칙이 없습니다.");
                }

                BigDecimal ruleValue = new BigDecimal(bondValue.trim());
                if (bondValue.contains(".")) {
                    bondValueType = "RATE";
                    bondGross = oracleTrunc(context.getBuyAmt().multiply(ruleValue), 0);
                } else {
                    bondValueType = "AMOUNT";
                    bondGross = ruleValue;
                }

                bond = bondGross.subtract(bondSubtract);
            }
        }

        if (bond.compareTo(ZERO) > 0) {
            bond = roundBond(bond, area);
        }
        bond = positive(bond);

        return new BondCalculation(
                bond,
                bondGross,
                bondSubtract,
                carGb,
                compare,
                areaForRule,
                bondValue,
                bondValueType,
                reasons);
    }

    private BondSearch resolveBondSearch(NewcarEstimateContext context, String originalArea) {
        String area = originalArea;
        String carCd = oracleString(context.getCarCd());
        String fuelCd = oracleString(context.getFuelCd());
        String tyCd = oracleString(context.getTyCd());
        String carGb;
        BigDecimal compare;

        if ("승용".equals(carCd) || "경차".equals(carCd)) {
            carGb = "1";
            if ("서울특별시".equals(area)) {
                if (isBetween(context.getGetinNo(), new BigDecimal("7"), new BigDecimal("10"))
                        && "승용".equals(carCd)) {
                    carGb = "2";
                    compare = new BigDecimal("1011");
                } else if (isElectricOrHydrogen(fuelCd)) {
                    carGb = "e";
                    if ("3".equals(tyCd) && lessThan(context.getGetinNo(), new BigDecimal("7"))) {
                        compare = new BigDecimal("10000");
                    } else if (allLessThanOrEqualDimensions(context, 4700, 1700, 2000)) {
                        compare = new BigDecimal("500");
                    } else if (allGreaterThanDimensions(context, 4700, 1700, 2000)) {
                        compare = new BigDecimal("5000");
                    } else {
                        compare = new BigDecimal("1500");
                    }
                } else if ("3".equals(tyCd)) {
                    compare = new BigDecimal("10000");
                } else if (lessThan(context.getCarCc(), new BigDecimal("1000"))) {
                    compare = context.getCarCc();
                } else if (greaterThanOrEqual(context.getCarCc(), new BigDecimal("1000"))
                        && lessThan(context.getCarCc(), new BigDecimal("1600"))
                        && allLessThanOrEqualDimensions(context, 4700, 1700, 2000)) {
                    compare = context.getCarCc();
                } else if (greaterThanOrEqual(context.getCarCc(), new BigDecimal("2000"))
                        || allGreaterThanDimensions(context, 4700, 1700, 2000)) {
                    compare = context.getCarCc();
                } else {
                    compare = new BigDecimal("1800");
                }
            } else if ("부산광역시".equals(area)) {
                compare = context.getCarCc();
                if ((greaterThanOrEqual(context.getCarCc(), new BigDecimal("2000"))
                        || allGreaterThanDimensions(context, 4700, 1700, 2000))
                        && "승용".equals(carCd)) {
                    compare = new BigDecimal("20000");
                } else if ("3".equals(tyCd)) {
                    compare = new BigDecimal("1000");
                } else if (isBetween(context.getGetinNo(), new BigDecimal("7"), new BigDecimal("10"))) {
                    compare = new BigDecimal("20000");
                }
            } else if ("대구광역시".equals(area)) {
                compare = context.getCarCc();
                if ("3".equals(tyCd)) {
                    compare = new BigDecimal("1000");
                } else if (isBetween(context.getGetinNo(), new BigDecimal("7"), new BigDecimal("10"))) {
                    compare = new BigDecimal("20000");
                }
            } else if (Set.of("경상남도", "경상남도 함양군", "경상남도 함안군").contains(area)) {
                area = "경상남도";
                compare = context.getCarCc();
                if (isBetween(context.getGetinNo(), new BigDecimal("7"), new BigDecimal("10"))) {
                    compare = new BigDecimal("20000");
                } else if ("3".equals(tyCd)) {
                    compare = new BigDecimal("1600");
                }
            } else if ("인천광역시".equals(area)) {
                compare = context.getCarCc();
                if (isElectricOrHydrogen(fuelCd)) {
                    carGb = "1";
                    if (allGreaterThanDimensions(context, 4700, 1700, 2000)
                            || anyGreaterThanDimension(context, 4700, 1700, 2000)) {
                        compare = ZERO;
                    }
                } else {
                    carGb = "1";
                    if (isBetween(context.getGetinNo(), new BigDecimal("7"), new BigDecimal("10"))
                            || (greaterThanOrEqual(context.getCarCc(), ZERO)
                                && lessThan(context.getCarCc(), new BigDecimal("2000")))) {
                        compare = ZERO;
                    } else if (greaterThanOrEqual(context.getCarCc(), new BigDecimal("2000"))) {
                        compare = "3".equals(tyCd) ? ZERO : new BigDecimal("2000");
                    }
                }
            } else if ("제주특별자치도".equals(area)) {
                compare = context.getCarCc();
                if ("3".equals(tyCd)) {
                    compare = new BigDecimal("1600");
                } else if (isBetween(context.getGetinNo(), new BigDecimal("7"), new BigDecimal("10"))) {
                    compare = new BigDecimal("20000");
                }
            } else {
                compare = context.getCarCc();
            }
        } else if ("승합".equals(carCd)) {
            carGb = "2";
            if (Set.of("경상남도", "경상남도 함양군", "경상남도 함안군").contains(area)) {
                area = "경상남도";
            }
            compare = context.getCarCc();
            if (greaterThanOrEqual(context.getGetinNo(), new BigDecimal("11"))) {
                compare = context.getGetinNo().add(new BigDecimal("1000"));
                if ("인천광역시".equals(area)) {
                    compare = ZERO;
                }
            }
            if (Set.of(
                    "강원특별자치도", "경기도", "경상북도", "전라남도", "울산광역시",
                    "대전광역시", "세종특별자치시", "광주광역시", "충청남도").contains(area)) {
                compare = context.getCarCc();
            }
        } else if ("화물".equals(carCd)) {
            carGb = "3";
            if ("서울특별시".equals(area)) {
                compare = context.getMaxCap();
                if (contains(context.getCarNm(), "Cybertruck")) {
                    compare = new BigDecimal("3500");
                } else if (greaterThanOrEqual(context.getTotalCap(), new BigDecimal("10000"))) {
                    compare = new BigDecimal("4700");
                }
            } else if (lessThan(context.getCarCc(), new BigDecimal("1000"))) {
                compare = new BigDecimal("20000");
            } else if ("인천광역시".equals(area)) {
                compare = ZERO;
            } else if (Set.of("경상남도 함양군", "경상남도 함안군").contains(area)) {
                area = "경상남도";
                compare = context.getMaxCap();
            } else {
                compare = context.getMaxCap();
            }
            if (Set.of("경상북도", "충청남도", "대전광역시", "세종특별자치시").contains(area)) {
                compare = context.getCarCc();
            }
        } else {
            throw new IllegalStateException("TM_BOND 조회용 차종을 결정할 수 없습니다: " + carCd);
        }

        if (compare == null) {
            throw new IllegalStateException("TM_BOND 조회용 비교값을 결정할 수 없습니다.");
        }
        return new BondSearch(area, carGb, compare);
    }

    private EcoEligibility resolveEcoEligibility(NewcarEstimateContext context) {
        boolean fmExcluded = pipeContains(
                context.getHybridFmExclusions(),
                trim(context.getFmNm()));
        boolean originalNameExcluded = isOriginalEcoExcludedCar(context.getCarNm());
        boolean engineEligible = pipeContains(context.getHybridOkPatterns(), context.getFomNm())
                || pipeContains(
                        context.getHybridOkPatterns(),
                        nullToEmpty(context.getFomNm())
                                + "{"
                                + firstFive(context.getFmNm())
                                + "}");

        // 운영 프로시저의 Polestar 이름 제외는 취득세에만 적용한다.
        // 사용자가 공채 친환경 감면은 유지하도록 명시했으므로 공채 판단과 분리한다.
        boolean baseEligible = !fmExcluded && !originalNameExcluded && engineEligible;
        boolean acquisitionEligible = baseEligible
                && !ACQ_ECO_EXCLUDED_CAR_NAMES.contains(normalizeCarName(context.getCarNm()));
        return new EcoEligibility(acquisitionEligible, baseEligible);
    }

    private static boolean isSpecialVehicleEligible(NewcarEstimateContext context) {
        String carCd = oracleString(context.getCarCd());
        if ("승용".equals(carCd)) {
            return lessThanOrEqual(context.getCarCc(), new BigDecimal("2000"))
                    || greaterThanOrEqual(context.getGetinNo(), new BigDecimal("7"));
        }
        if ("승합".equals(carCd)) {
            return lessThanOrEqual(context.getGetinNo(), new BigDecimal("15"));
        }
        return "화물".equals(carCd)
                && lessThanOrEqual(context.getMaxCap(), new BigDecimal("1000"));
    }

    private static boolean isCommonNtaxTarget(String code) {
        return code != null
                && !"00".equals(code)
                && !"06".equals(code)
                && !"07".equals(code)
                && !"10".equals(code)
                && !"15".equals(code);
    }

    private static BigDecimal applyTwoMillionThreshold(BigDecimal amount) {
        return amount.compareTo(TWO_MILLION) >= 0
                ? amount.multiply(new BigDecimal("0.15"))
                : ZERO;
    }

    private static BigDecimal roundBond(BigDecimal amount, String area) {
        BigDecimal integerAmount = oracleTrunc(amount, 0);
        if (Set.of("서울특별시", "대구광역시", "부산광역시").contains(area)) {
            BigDecimal base = integerAmount.divideToIntegralValue(TEN_THOUSAND).multiply(TEN_THOUSAND);
            BigDecimal remainder = integerAmount.subtract(base);
            if (remainder.compareTo(new BigDecimal("2500")) < 0) {
                return base;
            }
            if (remainder.compareTo(new BigDecimal("7500")) < 0) {
                return base.add(FIVE_THOUSAND);
            }
            return base.add(TEN_THOUSAND);
        }
        if ("충청북도".equals(area)) {
            return integerAmount.compareTo(TEN_THOUSAND) < 0
                    ? integerAmount
                    : integerAmount.divideToIntegralValue(TEN_THOUSAND).multiply(TEN_THOUSAND);
        }
        return integerAmount.divideToIntegralValue(FIVE_THOUSAND).multiply(FIVE_THOUSAND);
    }

    /**
     * Oracle TRUNC(number, scale)와 같이 0 방향으로 버린다.
     */
    static BigDecimal oracleTrunc(BigDecimal value, int scale) {
        if (value == null) {
            return null;
        }
        if (scale >= 0) {
            return value.setScale(scale, RoundingMode.DOWN);
        }
        BigDecimal unit = TEN.pow(-scale);
        return value.divideToIntegralValue(unit).multiply(unit);
    }

    private static BigDecimal positive(BigDecimal value) {
        return value.compareTo(ZERO) < 0 ? ZERO : value;
    }

    private static BigDecimal oracleNumber(String value) {
        String normalized = oracleString(value);
        return normalized == null ? null : new BigDecimal(normalized);
    }

    private static String oracleString(String value) {
        return value == null || value.isEmpty() ? null : value;
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String firstFive(String value) {
        if (value == null) {
            return "";
        }
        return value.substring(0, Math.min(5, value.length()));
    }

    private static boolean pipeContains(String pipeValues, String value) {
        if (pipeValues == null || value == null) {
            return false;
        }
        return pipeValues.contains("|" + value + "|");
    }

    private static String normalizeCarName(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
    }

    private static boolean isOriginalEcoExcludedCar(String carName) {
        return ORIGINAL_BOND_ECO_EXCLUDED_CAR_NAME.equals(trim(carName));
    }

    private static boolean isHybridFuel(String fuelCd) {
        return isBetween(fuelCd, "l", "p");
    }

    private static boolean isElectricOrHydrogen(String fuelCd) {
        return "e".equals(fuelCd) || "q".equals(fuelCd);
    }

    private static boolean contains(String value, String token) {
        return value != null && value.contains(token);
    }

    private static boolean notEqual(String value, String expected) {
        return value != null && !value.equals(expected);
    }

    private static boolean isBetween(String value, String low, String high) {
        return value != null && value.compareTo(low) >= 0 && value.compareTo(high) <= 0;
    }

    private static boolean equalTo(BigDecimal value, BigDecimal expected) {
        return value != null && value.compareTo(expected) == 0;
    }

    private static boolean lessThan(BigDecimal value, BigDecimal expected) {
        return value != null && value.compareTo(expected) < 0;
    }

    private static boolean lessThanOrEqual(BigDecimal value, BigDecimal expected) {
        return value != null && value.compareTo(expected) <= 0;
    }

    private static boolean greaterThan(BigDecimal value, BigDecimal expected) {
        return value != null && value.compareTo(expected) > 0;
    }

    private static boolean greaterThanOrEqual(BigDecimal value, BigDecimal expected) {
        return value != null && value.compareTo(expected) >= 0;
    }

    private static boolean isBetween(BigDecimal value, BigDecimal low, BigDecimal high) {
        return value != null && value.compareTo(low) >= 0 && value.compareTo(high) <= 0;
    }

    private static boolean allLessThanOrEqualDimensions(
            NewcarEstimateContext context,
            int length,
            int width,
            int height) {
        return lessThanOrEqual(context.getLength(), BigDecimal.valueOf(length))
                && lessThanOrEqual(context.getWidth(), BigDecimal.valueOf(width))
                && lessThanOrEqual(context.getHeight(), BigDecimal.valueOf(height));
    }

    private static boolean allGreaterThanDimensions(
            NewcarEstimateContext context,
            int length,
            int width,
            int height) {
        return greaterThan(context.getLength(), BigDecimal.valueOf(length))
                && greaterThan(context.getWidth(), BigDecimal.valueOf(width))
                && greaterThan(context.getHeight(), BigDecimal.valueOf(height));
    }

    private static boolean anyGreaterThanDimension(
            NewcarEstimateContext context,
            int length,
            int width,
            int height) {
        return greaterThan(context.getLength(), BigDecimal.valueOf(length))
                || greaterThan(context.getWidth(), BigDecimal.valueOf(width))
                || greaterThan(context.getHeight(), BigDecimal.valueOf(height));
    }

    private record AcquisitionCalculation(
            BigDecimal amount,
            BigDecimal uregAmount,
            BigDecimal acqRate,
            BigDecimal uregRate,
            BigDecimal grossAmount,
            BigDecimal reliefSubtractAmount,
            boolean reliefApplied,
            List<String> reasons) {
    }

    private record BondCalculation(
            BigDecimal amount,
            BigDecimal grossAmount,
            BigDecimal subtractAmount,
            String carGb,
            BigDecimal compare,
            String area,
            String value,
            String valueType,
            List<String> reasons) {
    }

    private record BondSearch(String area, String carGb, BigDecimal compare) {
    }

    private record EcoEligibility(boolean acquisitionEligible, boolean bondEligible) {
    }
}
