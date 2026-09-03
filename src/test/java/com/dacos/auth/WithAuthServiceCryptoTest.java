package com.dacos.auth;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import com.dacos.config.WithAuthProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** withAuth AES-256-CBC 검증 응답을 실제 설정 형식으로 복호화하는지 확인한다. */
public class WithAuthServiceCryptoTest {

    public static void main(String[] args) throws Exception {
        byte[] key = "0123456789abcdef0123456789abcdef".getBytes(StandardCharsets.UTF_8);
        byte[] iv = "0123456789abcdef".getBytes(StandardCharsets.UTF_8);
        String plain = "{\"resultCode\":\"200\",\"resultData\":{\"name\":\"홍길동\",\"phone\":\"01012345678\"}}";

        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(iv));

        WithAuthProperties properties = new WithAuthProperties();
        properties.setEncryptKey(Base64.getEncoder().encodeToString(key));
        properties.setEncryptIv(Base64.getEncoder().encodeToString(iv));
        WithAuthService service = new WithAuthService(properties, new ObjectMapper());
        String encrypted = Base64.getEncoder().encodeToString(
                cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8)));
        JsonNode result = service.decodeResult(encrypted);

        if (!"200".equals(result.path("resultCode").asText())
                || !"01012345678".equals(result.path("resultData").path("phone").asText())) {
            throw new AssertionError("withAuth 검증 응답 복호화 결과가 올바르지 않습니다.");
        }

        ObjectNode encryptedEnvelope = new ObjectMapper().createObjectNode()
                .put("resultCode", "200")
                .put("resultData", encrypted);
        JsonNode envelopeResult = service.decodeResult(encryptedEnvelope.toString());
        if (!"홍길동".equals(envelopeResult.path("resultData").path("name").asText())) {
            throw new AssertionError("암호화된 resultData 응답 복호화 결과가 올바르지 않습니다.");
        }

        String dataOnly = "{\"name\":\"홍길동\",\"phone\":\"01012345678\"}";
        String encryptedDataOnly = Base64.getEncoder().encodeToString(
                cipher.doFinal(dataOnly.getBytes(StandardCharsets.UTF_8)));
        encryptedEnvelope.put("resultData", encryptedDataOnly);
        JsonNode dataOnlyResult = service.decodeResult(encryptedEnvelope.toString());
        if (!"200".equals(dataOnlyResult.path("resultCode").asText())
                || !"홍길동".equals(dataOnlyResult.path("resultData").path("name").asText())) {
            throw new AssertionError("사용자 정보만 암호화된 응답 복호화 결과가 올바르지 않습니다.");
        }

        String encryptedName = Base64.getEncoder().encodeToString(
                cipher.doFinal("홍길동".getBytes(StandardCharsets.UTF_8)));
        if (!"홍길동".equals(service.decryptField(encryptedName))
                || !"01012345678".equals(service.decryptField("01012345678"))) {
            throw new AssertionError("사용자 정보 필드 복호화 결과가 올바르지 않습니다.");
        }

        if (service.isExpired(1_000L, 1_082L)
                || !service.isExpired(1_000L, 1_121L)) {
            throw new AssertionError("인증 결과 만료 허용 오차 검사가 올바르지 않습니다.");
        }
    }
}
