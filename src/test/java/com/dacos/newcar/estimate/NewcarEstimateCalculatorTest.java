package com.dacos.newcar.estimate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

class NewcarEstimateCalculatorTest {

    @Test
    void nonRentalPassengerUsesSevenPercentAndFinalTruncDoesNotCountAsExemption() {
        NewcarEstimateResult result = calculatorReturning("0").calculate(
                baseContext()
                        .buyAmt(new BigDecimal("100000003"))
                        .build());

        assertAmount("7000000", result.getAcqAmount());
        assertAmount("7000000.21", result.getGrossAcqAmount());
        assertAmount("0", result.getAcqSubtractAmount());
        assertEquals("0", result.getNtaxApplicationCode());
        assertNull(result.getUregAmount());
    }

    @Test
    void procCUsesTwoPercentAcquisitionAndVehicleSpecificRegistrationRate() {
        NewcarEstimateResult van = calculatorReturning("0").calculate(
                baseContext()
                        .procCd("C")
                        .carCd("승합")
                        .getinNo(new BigDecimal("11"))
                        .build());
        NewcarEstimateResult add = calculatorReturning("0").calculate(
                baseContext()
                        .procCd("C")
                        .taskCd("ADD")
                        .build());

        assertAmount("2000000", van.getAcqAmount());
        assertAmount("3000000", van.getUregAmount());
        assertAmount("0.03", van.getUregRate());
        assertAmount("2000000", add.getUregAmount());
    }

    @Test
    void lightCarSubtractsSevenHundredFiftyThousandBeforeFinalClampAndTrunc() {
        NewcarEstimateResult result = calculatorReturning("0").calculate(
                baseContext()
                        .buyAmt(new BigDecimal("50000000"))
                        .carCd("경차")
                        .carCc(new BigDecimal("999"))
                        .build());

        assertAmount("1250000", result.getAcqAmount());
        assertAmount("750000", result.getAcqSubtractAmount());
        assertEquals("11", result.getNtaxApplicationCode());
    }

    @Test
    void alphaGradeIsNotParsedForNonDisabilityTarget() {
        NewcarEstimateResult result = calculatorReturning("0").calculate(
                baseContext()
                        .ntaxTargetCd("03")
                        .ntaxTargetGradeCd("A")
                        .build());

        assertAmount("0", result.getAcqAmount());
        assertEquals("8", result.getNtaxApplicationCode());
    }

    @Test
    void disabilityGradeOutsideProcedureLimitDoesNotReceiveNtaxExemption() {
        NewcarEstimateResult result = calculatorReturning("0").calculate(
                baseContext()
                        .ntaxTargetCd("04")
                        .ntaxTargetGradeCd("4")
                        .build());

        assertAmount("7000000", result.getAcqAmount());
        assertEquals("0", result.getNtaxApplicationCode());
    }

    @Test
    void threeChildAtExactlyTwoMillionPaysFifteenPercent() {
        NewcarEstimateResult result = calculatorReturning("0").calculate(
                baseContext()
                        .procCd("C")
                        .carCd("승용")
                        .getinNo(new BigDecimal("7"))
                        .ntaxTargetCd("06")
                        .build());

        assertAmount("300000", result.getAcqAmount());
        assertAmount("1700000", result.getAcqSubtractAmount());
        assertEquals("11", result.getNtaxApplicationCode());
    }

    @Test
    void incheonVisualGradeFourBelowTwoMillionKeepsOriginalTax() {
        NewcarEstimateResult result = calculatorReturning("0").calculate(
                baseContext()
                        .procCd("C")
                        .area("인천광역시")
                        .buyAmt(new BigDecimal("50000000"))
                        .ntaxTargetCd("05")
                        .ntaxTargetGradeCd("4")
                        .build());

        assertAmount("1000000", result.getAcqAmount());
        assertAmount("0", result.getAcqSubtractAmount());
        assertEquals("0", result.getNtaxApplicationCode());
    }

    @Test
    void twoChildUsesExactHalfUntilFinalTenWonTruncation() {
        NewcarEstimateResult result = calculatorReturning("0").calculate(
                baseContext()
                        .buyAmt(new BigDecimal("1001"))
                        .ntaxTargetCd("15")
                        .build());

        assertAmount("30", result.getAcqAmount());
        assertAmount("35", result.getAcqSubtractAmount());
        assertEquals("11", result.getNtaxApplicationCode());
    }

    @Test
    void missingPassengerCountDoesNotBecomeZeroForTwoChildCap() {
        NewcarEstimateResult result = calculatorReturning("0").calculate(
                baseContext()
                        .procCd("C")
                        .buyAmt(new BigDecimal("200000000"))
                        .getinNo(null)
                        .ntaxTargetCd("15")
                        .build());

        assertAmount("2000000", result.getAcqAmount());
        assertAmount("2000000", result.getAcqSubtractAmount());
    }

    @Test
    void missingDimensionsDoNotClassifySeoulElectricCarAsSmall() {
        NewcarEstimateCalculator calculator = new NewcarEstimateCalculator((area, carGb, compare) -> {
            assertEquals("서울특별시", area);
            assertEquals("e", carGb);
            assertAmount("1500", compare);
            return "0";
        });

        calculator.calculate(
                electricSeoulContext()
                        .length(null)
                        .width(null)
                        .height(null)
                        .build());
    }

    @Test
    void bothPolestarExceptionsKeepAcqTaxButRetainElectricBondRelief() {
        String[] excludedNames = {
                "Polestar 4 Coupe Performance",
                "  POLESTAR   4 long range dual motor  "
        };

        for (String carName : excludedNames) {
            AtomicInteger calls = new AtomicInteger();
            NewcarEstimateCalculator calculator = new NewcarEstimateCalculator((area, carGb, compare) -> {
                calls.incrementAndGet();
                assertEquals("서울특별시", area);
                assertEquals("e", carGb);
                assertAmount("500", compare);
                return "0.05";
            });

            NewcarEstimateResult result = calculator.calculate(
                    electricSeoulContext()
                            .carNm(carName)
                            .build());

            assertAmount("7000000", result.getAcqAmount());
            assertAmount("0", result.getAcqSubtractAmount());
            assertAmount("5000000", result.getBondGrossAmount());
            assertAmount("2500000", result.getBondSubtractAmount());
            assertAmount("2500000", result.getBondPurchaseAmount());
            assertEquals(1, calls.get());
        }
    }

    @Test
    void otherEligibleElectricCarStillReceivesAcqRelief() {
        NewcarEstimateResult result = calculatorReturning("0.05").calculate(
                electricSeoulContext()
                        .carNm("Polestar 3 Long Range Dual Motor")
                        .build());

        assertAmount("5600000", result.getAcqAmount());
        assertAmount("1400000", result.getAcqSubtractAmount());
    }

    @Test
    void gyeonggiElectricBondIsFullyExemptWithoutRuleLookup() {
        NewcarEstimateCalculator calculator = new NewcarEstimateCalculator((area, carGb, compare) -> {
            throw new AssertionError("전액면제 건은 TM_BOND를 조회하면 안 됩니다.");
        });

        NewcarEstimateResult result = calculator.calculate(
                electricSeoulContext()
                        .area("경기도")
                        .build());

        assertAmount("0", result.getBondPurchaseAmount());
    }

    @Test
    void metropolitanBondRoundingRaisesTwoThousandFiveHundredBoundary() {
        NewcarEstimateResult twelveFive = calculatorReturning("0.0125").calculate(
                baseContext()
                        .area("서울특별시")
                        .buyAmt(new BigDecimal("1000000"))
                        .build());
        NewcarEstimateResult seventeenFive = calculatorReturning("0.0175").calculate(
                baseContext()
                        .area("서울특별시")
                        .buyAmt(new BigDecimal("1000000"))
                        .build());

        assertAmount("15000", twelveFive.getBondPurchaseAmount());
        assertAmount("20000", seventeenFive.getBondPurchaseAmount());
    }

    @Test
    void ordinaryAreaBondRoundingAlwaysDropsBelowNextFiveThousand() {
        NewcarEstimateResult result = calculatorReturning("0.0175").calculate(
                baseContext()
                        .area("전라남도")
                        .buyAmt(new BigDecimal("1000000"))
                        .build());

        assertAmount("15000", result.getBondPurchaseAmount());
    }

    @Test
    void chungbukKeepsUnderTenThousandAndDropsHigherAmountToTenThousandUnit() {
        NewcarEstimateResult under = calculatorReturning("9999").calculate(
                baseContext()
                        .area("충청북도")
                        .build());
        NewcarEstimateResult over = calculatorReturning("19999").calculate(
                baseContext()
                        .area("충청북도")
                        .build());

        assertAmount("9999", under.getBondPurchaseAmount());
        assertAmount("10000", over.getBondPurchaseAmount());
    }

    @Test
    void tmBondValueWithoutDotIsFixedAmountNotRate() {
        NewcarEstimateResult result = calculatorReturning("12345").calculate(
                baseContext().area("충청북도").build());

        assertEquals("AMOUNT", result.getBondValueType());
        assertAmount("12345", result.getBondGrossAmount());
        assertAmount("10000", result.getBondPurchaseAmount());
    }

    @Test
    void oracleTruncMovesNegativeValueTowardZero() {
        assertAmount("-10", NewcarEstimateCalculator.oracleTrunc(new BigDecimal("-15"), -1));
    }

    @Test
    void missingBondRuleFailsInsteadOfSilentlyReturningWrongAmount() {
        NewcarEstimateCalculator calculator = new NewcarEstimateCalculator((area, carGb, compare) -> null);

        assertThrows(IllegalStateException.class, () -> calculator.calculate(baseContext().build()));
    }

    private static NewcarEstimateCalculator calculatorReturning(String bondValue) {
        return new NewcarEstimateCalculator((area, carGb, compare) -> bondValue);
    }

    private static NewcarEstimateContext.NewcarEstimateContextBuilder baseContext() {
        return NewcarEstimateContext.builder()
                .serviceId("SVC-TEST")
                .procCd("N")
                .taskCd("NEW")
                .area("전라남도")
                .buyAmt(new BigDecimal("100000000"))
                .carCd("승용")
                .carCc(new BigDecimal("2000"))
                .getinNo(new BigDecimal("5"))
                .fuelCd("a")
                .length(new BigDecimal("4600"))
                .width(new BigDecimal("1700"))
                .height(new BigDecimal("1600"))
                .maxCap(new BigDecimal("1000"))
                .totalCap(new BigDecimal("2000"))
                .tyCd("1")
                .fmNm("FM12345")
                .fomNm("MOTOR")
                .carNm("테스트 차량")
                .ntaxTargetCd("00")
                .ntaxTargetGradeCd("0")
                .bubyn("Y")
                .hybridFmExclusions("|OTHER-FM|")
                .hybridOkPatterns("|MOTOR|");
    }

    private static NewcarEstimateContext.NewcarEstimateContextBuilder electricSeoulContext() {
        return baseContext()
                .area("서울특별시")
                .fuelCd("e")
                .getinNo(new BigDecimal("5"))
                .ntaxTargetCd("00");
    }

    private static void assertAmount(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual),
                () -> "expected amount " + expected + " but was " + actual);
    }
}
