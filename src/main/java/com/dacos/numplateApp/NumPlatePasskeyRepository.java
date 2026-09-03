package com.dacos.numplateApp;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Repository;

import com.dacos.numplateApp.mapper.NumPlateMapper;
import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.RegisteredCredential;
import com.yubico.webauthn.data.AuthenticatorTransport;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor;

/** WebAuthn 라이브러리가 요구하는 공개키 저장소를 MyBatis 테이블에 연결한다. */
@Repository
public class NumPlatePasskeyRepository implements CredentialRepository {

    private final NumPlateMapper mapper;

    public NumPlatePasskeyRepository(NumPlateMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
        return mapper.getPasskeysByPhoneHash(username).stream()
                .map(this::descriptor)
                .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public Optional<ByteArray> getUserHandleForUsername(String username) {
        return mapper.getPasskeysByPhoneHash(username).stream().findFirst()
                .map(row -> byteArray(row, "USER_HANDLE"));
    }

    @Override
    public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
        return mapper.getPasskeysByUserHandle(userHandle.getBase64Url()).stream().findFirst()
                .map(row -> Objects.toString(row.get("MANAGER_TEL_HASH"), ""));
    }

    @Override
    public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
        return mapper.getPasskeysByCredentialId(credentialId.getBase64Url()).stream()
                .filter(row -> userHandle.getBase64Url().equals(Objects.toString(row.get("USER_HANDLE"), "")))
                .findFirst().map(this::registeredCredential);
    }

    @Override
    public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
        return mapper.getPasskeysByCredentialId(credentialId.getBase64Url()).stream()
                .map(this::registeredCredential)
                .collect(Collectors.toUnmodifiableSet());
    }

    public void save(Map<String, Object> credential) {
        mapper.insertPasskey(credential);
    }

    public int updateCounter(Map<String, Object> credential) {
        return mapper.updatePasskeyCounter(credential);
    }

    public String phoneHash(String phone) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(phone.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private PublicKeyCredentialDescriptor descriptor(Map<String, Object> row) {
        return PublicKeyCredentialDescriptor.builder()
                .id(byteArray(row, "CREDENTIAL_ID"))
                .transports(transports(row))
                .build();
    }

    private RegisteredCredential registeredCredential(Map<String, Object> row) {
        return RegisteredCredential.builder()
                .credentialId(byteArray(row, "CREDENTIAL_ID"))
                .userHandle(byteArray(row, "USER_HANDLE"))
                .publicKeyCose(byteArray(row, "PUBLIC_KEY_COSE"))
                .signatureCount(number(row.get("SIGNATURE_COUNT")))
                .transports(transports(row))
                .backupEligible("Y".equals(Objects.toString(row.get("BACKUP_ELIGIBLE_YN"), "N")))
                .backupState("Y".equals(Objects.toString(row.get("BACKUP_STATE_YN"), "N")))
                .build();
    }

    private Set<AuthenticatorTransport> transports(Map<String, Object> row) {
        String value = Objects.toString(row.get("TRANSPORTS"), "");
        if (value.isBlank()) return Set.of();
        return Arrays.stream(value.split(","))
                .map(String::trim).filter(item -> !item.isEmpty())
                .map(AuthenticatorTransport::of)
                .collect(Collectors.toUnmodifiableSet());
    }

    private ByteArray byteArray(Map<String, Object> row, String key) {
        try {
            return ByteArray.fromBase64Url(Objects.toString(row.get(key), ""));
        } catch (Exception exception) {
            throw new IllegalStateException("Invalid stored passkey " + key, exception);
        }
    }

    private long number(Object value) {
        return value instanceof Number number ? number.longValue()
                : Long.parseLong(Objects.toString(value, "0"));
    }
}
