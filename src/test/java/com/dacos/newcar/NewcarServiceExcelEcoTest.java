package com.dacos.newcar;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

public class NewcarServiceExcelEcoTest {

    @Test
    void resolvesEcoYnByPolestarModel() {
        assertEquals("N", NewcarService.resolveExcelEcoYn("Polestar 4", "Plus Performance", "rear"));
        assertEquals("Y", NewcarService.resolveExcelEcoYn("Polestar 4", "Plus", "front"));
        assertEquals("Y", NewcarService.resolveExcelEcoYn("Polestar 3", "Performance", "Dual rear motor"));
        assertEquals("N", NewcarService.resolveExcelEcoYn("Polestar 3", "Plus", "front motor"));
        assertEquals("Y", NewcarService.resolveExcelEcoYn("Polestar 2", "Performance", "front motor"));
    }
    @Test
    void validatesMessagePlateList() {
        assertEquals(2, NewcarService.normalizeNumplateMessageList(java.util.List.of("11가1111", "22나2222")).size());
        assertThrows(RuntimeException.class, () ->
                NewcarService.normalizeNumplateMessageList(java.util.List.of("11가1111", "11가1111")));
    }
}
