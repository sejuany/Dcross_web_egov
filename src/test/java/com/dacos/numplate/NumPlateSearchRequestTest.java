package com.dacos.numplate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.dacos.numplateApp.dto.NumPlateSearchRequest;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

/** Java 21/Jakarta Validation 전환 후에도 기존 검색 입력 형식이 유지되는지 검증한다. */
class NumPlateSearchRequestTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void validatesLegacyDateAndIdentifierInputs() {
        NumPlateSearchRequest valid = new NumPlateSearchRequest();
        valid.setSTART_DT("20260820");
        valid.setCAR_NO("12가3456");
        assertTrue(validator.validate(valid).isEmpty());

        NumPlateSearchRequest invalid = new NumPlateSearchRequest();
        invalid.setSTART_DT("2026-08-20");
        invalid.setCAR_NO("1".repeat(21));
        assertFalse(validator.validate(invalid).isEmpty());
    }
}
