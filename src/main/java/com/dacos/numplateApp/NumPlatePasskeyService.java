package com.dacos.numplateApp;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.yubico.webauthn.AssertionRequest;
import com.yubico.webauthn.AssertionResult;
import com.yubico.webauthn.FinishAssertionOptions;
import com.yubico.webauthn.FinishRegistrationOptions;
import com.yubico.webauthn.RegistrationResult;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.StartAssertionOptions;
import com.yubico.webauthn.StartRegistrationOptions;
import com.yubico.webauthn.data.AuthenticatorAttachment;
import com.yubico.webauthn.data.AuthenticatorSelectionCriteria;
import com.yubico.webauthn.data.AuthenticatorTransport;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredential;
import com.yubico.webauthn.data.PublicKeyCredentialCreationOptions;
import com.yubico.webauthn.data.RelyingPartyIdentity;
import com.yubico.webauthn.data.ResidentKeyRequirement;
import com.yubico.webauthn.data.UserIdentity;
import com.yubico.webauthn.data.UserVerificationRequirement;

import jakarta.servlet.http.HttpSession;

/** no.dcross.kr 번호판 앱의 패스키 등록·검증 ceremony를 수행한다. */
@Service
public class NumPlatePasskeyService {

    private static final String REGISTER_STATE = "NUMPLATE_PASSKEY_REGISTER";
    private static final String LOGIN_STATE = "NUMPLATE_PASSKEY_LOGIN";
    private static final long CEREMONY_TIMEOUT_MS = 120_000L;

    private final SecureRandom secureRandom = new SecureRandom();
    private final NumPlatePasskeyRepository repository;
    private final NumPlateService numPlateService;
    private final RelyingParty relyingParty;

    public NumPlatePasskeyService(
            NumPlatePasskeyRepository repository,
            NumPlateService numPlateService,
            @Value("${numplate.passkey.rp-id:no.dcross.kr}") String rpId,
            @Value("${numplate.passkey.origin:https://no.dcross.kr}") String origin) {
        this.repository = repository;
        this.numPlateService = numPlateService;
        this.relyingParty = RelyingParty.builder()
                .identity(RelyingPartyIdentity.builder().id(rpId).name("DACOS 번호판 업무").build())
                .credentialRepository(repository)
                .origins(Set.of(origin))
                .allowOriginPort(false)
                .allowOriginSubdomain(false)
                .allowUntrustedAttestation(true)
                .validateSignatureCounter(true)
                .build();
    }

    public String startRegistration(UserDto user, HttpSession session) {
        requireNumPlateUser(user);
        String phone = normalizePhone(user.getMPHONE_NO());
        String phoneHash = repository.phoneHash(phone);
        ByteArray userHandle = repository.getUserHandleForUsername(phoneHash)
                .orElseGet(() -> {
                    byte[] value = new byte[32];
                    secureRandom.nextBytes(value);
                    return new ByteArray(value);
                });
        UserIdentity identity = UserIdentity.builder()
                .name(phoneHash)
                .displayName(Objects.toString(user.getMEMBER_NM(), "번호판 담당자"))
                .id(userHandle)
                .build();
        AuthenticatorSelectionCriteria selection = AuthenticatorSelectionCriteria.builder()
                .authenticatorAttachment(AuthenticatorAttachment.PLATFORM)
                .residentKey(ResidentKeyRequirement.REQUIRED)
                .userVerification(UserVerificationRequirement.REQUIRED)
                .build();
        PublicKeyCredentialCreationOptions request = relyingParty.startRegistration(
                StartRegistrationOptions.builder().user(identity)
                        .authenticatorSelection(selection)
                        .timeout(CEREMONY_TIMEOUT_MS).build());
        session.setAttribute(REGISTER_STATE,
                new RegistrationState(request, phoneHash, userHandle, System.currentTimeMillis()));
        try {
            return request.toCredentialsCreateJson();
        } catch (Exception exception) {
            session.removeAttribute(REGISTER_STATE);
            throw new BusinessException("생체 로그인 등록을 시작하지 못했습니다.");
        }
    }

    @Transactional
    public void finishRegistration(String responseJson, UserDto user, HttpSession session) {
        requireNumPlateUser(user);
        RegistrationState state = takeState(session, REGISTER_STATE, RegistrationState.class);
        if (!repository.phoneHash(normalizePhone(user.getMPHONE_NO())).equals(state.phoneHash())) {
            throw new BusinessException("로그인 계정이 변경되었습니다.", 401);
        }
        try {
            RegistrationResult result = relyingParty.finishRegistration(
                    FinishRegistrationOptions.builder()
                            .request(state.request())
                            .response(PublicKeyCredential.parseRegistrationResponseJson(responseJson))
                            .build());
            if (!result.isUserVerified()) throw new BusinessException("기기 잠금 인증이 필요합니다.", 401);
            Map<String, Object> row = new HashMap<>();
            row.put("CREDENTIAL_ID", result.getKeyId().getId().getBase64Url());
            row.put("MANAGER_TEL_HASH", state.phoneHash());
            row.put("USER_HANDLE", state.userHandle().getBase64Url());
            row.put("PUBLIC_KEY_COSE", result.getPublicKeyCose().getBase64Url());
            row.put("SIGNATURE_COUNT", result.getSignatureCount());
            row.put("TRANSPORTS", result.getKeyId().getTransports().orElseGet(java.util.TreeSet::new)
                    .stream().map(AuthenticatorTransport::getId).collect(Collectors.joining(",")));
            row.put("BACKUP_ELIGIBLE_YN", result.isBackupEligible() ? "Y" : "N");
            row.put("BACKUP_STATE_YN", result.isBackedUp() ? "Y" : "N");
            repository.save(row);
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException("생체 로그인 등록을 확인하지 못했습니다.", 401);
        }
    }

    public String startLogin(String phone, HttpSession session) {
        phone = normalizePhone(phone);
        numPlateService.loginManagerByPasskey(phone); // 사용 중인 관리자 계정인지 먼저 확인한다.
        String phoneHash = repository.phoneHash(phone);
        if (repository.getCredentialIdsForUsername(phoneHash).isEmpty()) {
            throw new BusinessException("이 번호에는 등록된 생체 로그인이 없습니다.", 404);
        }
        AssertionRequest request = relyingParty.startAssertion(
                StartAssertionOptions.builder().username(phoneHash)
                        .userVerification(UserVerificationRequirement.REQUIRED)
                        .timeout(CEREMONY_TIMEOUT_MS).build());
        session.setAttribute(LOGIN_STATE,
                new LoginState(request, phone, phoneHash, System.currentTimeMillis()));
        try {
            return request.toCredentialsGetJson();
        } catch (Exception exception) {
            session.removeAttribute(LOGIN_STATE);
            throw new BusinessException("생체 로그인을 시작하지 못했습니다.");
        }
    }

    @Transactional
    public UserDto finishLogin(String responseJson, HttpSession session) {
        LoginState state = takeState(session, LOGIN_STATE, LoginState.class);
        try {
            AssertionResult result = relyingParty.finishAssertion(
                    FinishAssertionOptions.builder()
                            .request(state.request())
                            .response(PublicKeyCredential.parseAssertionResponseJson(responseJson))
                            .build());
            if (!result.isSuccess() || !result.isUserVerified()
                    || !state.phoneHash().equals(result.getUsername())) {
                throw new BusinessException("생체 인증에 실패했습니다.", 401);
            }
            Map<String, Object> update = Map.of(
                    "CREDENTIAL_ID", result.getCredentialId().getBase64Url(),
                    "MANAGER_TEL_HASH", state.phoneHash(),
                    "SIGNATURE_COUNT", result.getSignatureCount(),
                    "BACKUP_STATE_YN", result.isBackedUp() ? "Y" : "N");
            if (repository.updateCounter(update) != 1) {
                throw new BusinessException("등록된 생체 로그인 정보를 찾을 수 없습니다.", 401);
            }
            return numPlateService.loginManagerByPasskey(state.phone());
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException("생체 인증을 확인하지 못했습니다.", 401);
        }
    }

    private void requireNumPlateUser(UserDto user) {
        if (user == null || !"NUMPLATE_APP".equals(user.getLOGIN_GB())) {
            throw new BusinessException("번호판 앱 로그인이 필요합니다.", 401);
        }
    }

    private String normalizePhone(String value) {
        String phone = Objects.toString(value, "").replaceAll("[^0-9]", "");
        if (phone.length() < 8 || phone.length() > 11) {
            throw new BusinessException("휴대폰 번호를 확인해 주세요.");
        }
        return phone;
    }

    private <T> T takeState(HttpSession session, String key, Class<T> type) {
        Object value = session.getAttribute(key);
        session.removeAttribute(key); // 성공 여부와 관계없이 challenge는 한 번만 사용한다.
        if (!type.isInstance(value)) throw new BusinessException("인증 요청이 만료되었습니다.", 401);
        long created = value instanceof RegistrationState state ? state.createdAt()
                : ((LoginState) value).createdAt();
        if (System.currentTimeMillis() - created > CEREMONY_TIMEOUT_MS) {
            throw new BusinessException("인증 요청이 만료되었습니다.", 401);
        }
        return type.cast(value);
    }

    private record RegistrationState(
            PublicKeyCredentialCreationOptions request, String phoneHash,
            ByteArray userHandle, long createdAt) { }

    private record LoginState(
            AssertionRequest request, String phone, String phoneHash, long createdAt) { }
}
