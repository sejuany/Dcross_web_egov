package com.dacos.numplateApp;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class NumPlateInstallTimeTest {

    @Test
    void convertsVisitTimeToLegacyInstallTime() {
        assertEquals("113", NumPlateService.toInstallTime("11:30"));
        assertEquals("100", NumPlateService.toInstallTime("10:00"));
        assertEquals("124", NumPlateService.toInstallTime("12:40"));
        assertEquals("132", NumPlateService.toInstallTime("13:20"));
        assertEquals("122", NumPlateService.toInstallTime("12:20"));
        assertEquals("110", NumPlateService.toInstallTime("11:00"));
        assertEquals("", NumPlateService.toInstallTime(""));
    }
}
