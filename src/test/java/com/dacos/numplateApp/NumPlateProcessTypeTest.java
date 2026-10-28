package com.dacos.numplateApp;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class NumPlateProcessTypeTest {

    @Test
    void acceptsKnownTypesAndDefaultsUnknownValues() {
        assertEquals("ALL", NumPlateService.normalizeProcessType(null));
        assertEquals("ALL", NumPlateService.normalizeProcessType("ALL"));
        assertEquals("INSTALL", NumPlateService.normalizeProcessType("INSTALL"));
        assertEquals("DELIVERY", NumPlateService.normalizeProcessType("DELIVERY"));
        assertEquals("ALL", NumPlateService.normalizeProcessType("UNKNOWN"));
        assertEquals("ALL", NumPlateService.normalizeProcessType(""));
    }
}
