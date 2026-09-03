package com.dacos.attach;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.Resource;

import com.dacos.common.BusinessException;

class AttachServiceFileSecurityTest {

    public static void main(String[] args) throws Exception {
        AttachServiceFileSecurityTest test = new AttachServiceFileSecurityTest();
        test.rejectsExecutableAndSpoofedUploads();
        test.acceptsValidPng();
        test.forcesUnknownFilesToDownload();
    }

    @Test
    void rejectsExecutableAndSpoofedUploads() {
        MockMultipartFile html = new MockMultipartFile(
                "file", "attack.html", "text/html", "<script>alert(1)</script>".getBytes());
        MockMultipartFile fakePng = new MockMultipartFile(
                "file", "attack.png", "image/png", "<script>alert(1)</script>".getBytes());

        assertThrows(BusinessException.class, () -> AttachService.validateUploadFile(html, ".html"));
        assertThrows(BusinessException.class, () -> AttachService.validateUploadFile(fakePng, ".png"));
    }

    @Test
    void acceptsValidPng() {
        byte[] png = Base64.getDecoder().decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
        MockMultipartFile file = new MockMultipartFile("file", "image.png", "image/png", png);

        assertDoesNotThrow(() -> AttachService.validateUploadFile(file, ".png"));
    }

    @Test
    void forcesUnknownFilesToDownload() throws Exception {
        Path html = Files.createTempFile("attach-security-", ".html");
        try {
            ResponseEntity<Resource> response =
                    new AttachService(null, null, null).buildSafeFileResponse(html, "attack.html");

            assertEquals(MediaType.APPLICATION_OCTET_STREAM, response.getHeaders().getContentType());
            assertEquals("nosniff", response.getHeaders().getFirst("X-Content-Type-Options"));
            assertTrue(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION).startsWith("attachment;"));
        } finally {
            Files.deleteIfExists(html);
        }
    }
}
