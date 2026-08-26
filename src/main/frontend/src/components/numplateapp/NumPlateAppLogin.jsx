import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import './NumPlateApp.css';

const isNumPlateUser = (user) => (user?.login_GB || user?.LOGIN_GB) === 'NUMPLATE_APP';

const fromBase64Url = (value) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
};

const toBase64Url = (value) => {
  if (value == null) return null;
  const bytes = new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decodeCredentialOptions = ({ publicKey }) => ({
  ...publicKey,
  challenge: fromBase64Url(publicKey.challenge),
  ...(publicKey.user && { user: { ...publicKey.user, id: fromBase64Url(publicKey.user.id) } }),
  ...(publicKey.excludeCredentials && {
    excludeCredentials: publicKey.excludeCredentials.map((item) => ({ ...item, id: fromBase64Url(item.id) })),
  }),
  ...(publicKey.allowCredentials && {
    allowCredentials: publicKey.allowCredentials.map((item) => ({ ...item, id: fromBase64Url(item.id) })),
  }),
});

const encodeCredential = (credential) => {
  const response = {
    clientDataJSON: toBase64Url(credential.response.clientDataJSON),
  };
  if ('attestationObject' in credential.response) {
    response.attestationObject = toBase64Url(credential.response.attestationObject);
    response.transports = credential.response.getTransports?.() || [];
  } else {
    response.authenticatorData = toBase64Url(credential.response.authenticatorData);
    response.signature = toBase64Url(credential.response.signature);
    response.userHandle = toBase64Url(credential.response.userHandle);
  }
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    response,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
};

/** 휴대폰 번호와 ETC6 비밀번호로 번호판 담당자 전용 세션을 시작한다. */
export default function NumPlateAppLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
  const [form, setForm] = useState({ phone: '', password: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [registerPasskey, setRegisterPasskey] = useState(false);
  const requestedPath = location.state?.from;
  const nextPath = typeof requestedPath === 'string' && requestedPath.startsWith('/numplateapp/')
    ? requestedPath : '/numplateapp';

  useEffect(() => {
    // 이미 전용 세션이 있으면 로그인 화면을 다시 보여주지 않는다.
    if (isNumPlateUser(user)) navigate(nextPath, { replace: true });
  }, [navigate, nextPath, user]);

  useEffect(() => {
    if (!window.isSecureContext || !window.PublicKeyCredential) return;
    const checkPlatformAuthenticator = window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
    if (!checkPlatformAuthenticator) return;
    checkPlatformAuthenticator.call(window.PublicKeyCredential)
      .then(setPasskeySupported).catch(() => setPasskeySupported(false));
  }, []);

  const registerBiometricLogin = async () => {
    const { data: options } = await axios.post('/api/numplateapp/passkeys/register/options');
    const credential = await navigator.credentials.create({ publicKey: decodeCredentialOptions(options) });
    await axios.post('/api/numplateapp/passkeys/register/verify', encodeCredential(credential));
  };

  const change = ({ target }) => {
    // 휴대폰 번호는 서버와 동일하게 숫자만 최대 11자리까지 전송한다.
    const value = target.name === 'phone'
      ? target.value.replace(/\D/g, '').slice(0, 11)
      : target.value;
    setForm((current) => ({ ...current, [target.name]: value }));
    setMessage('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { data } = await axios.post('/api/numplateapp/login', form);
      if (registerPasskey && passkeySupported) {
        try {
          await registerBiometricLogin();
        } catch (error) {
          if (error.name !== 'NotAllowedError') {
            window.alert(error.response?.data?.message || '로그인은 완료했지만 생체 로그인 등록은 실패했습니다.');
          }
        }
      }
      // AuthContext가 사용자 정보를 sessionStorage에 보관하고 만료 타이머를 시작한다.
      login(data.user);
      navigate(nextPath, { replace: true });
    } catch (error) {
      setMessage(error.response?.data?.message || '휴대폰 번호 또는 비밀번호를 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const biometricLogin = async () => {
    if (busy) return;
    if (form.phone.length < 8) {
      setMessage('먼저 등록된 휴대폰 번호를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { data: options } = await axios.post('/api/numplateapp/passkeys/login/options', { phone: form.phone });
      const credential = await navigator.credentials.get({ publicKey: decodeCredentialOptions(options) });
      const { data } = await axios.post('/api/numplateapp/passkeys/login/verify', encodeCredential(credential));
      login(data.user);
      navigate(nextPath, { replace: true });
    } catch (error) {
      setMessage(error.name === 'NotAllowedError'
        ? '생체 로그인이 취소되었습니다.'
        : (error.response?.data?.message || '생체 로그인에 실패했습니다. 비밀번호로 로그인해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="numplate-login-page">
      <section className="numplate-login-card">
        <div className="numplate-login-brand" aria-hidden="true">N</div>
        <p className="numplate-login-eyebrow">DACOS MOBILE</p>
        <h1>번호판 업무</h1>
        <p className="numplate-login-guide">등록된 담당자 휴대폰 번호로 로그인해 주세요.</p>

        <form onSubmit={submit}>
          <label>
            <span>휴대폰 번호</span>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={change}
              inputMode="numeric"
              autoComplete="tel"
              minLength={8}
              maxLength={11}
              placeholder="01012345678"
              required
              disabled={busy}
            />
          </label>
          <label>
            <span>비밀번호</span>
            <input name="password" type="password" value={form.password} onChange={change} autoComplete="current-password" maxLength={100} required disabled={busy} />
          </label>
          {passkeySupported && <label className="numplate-passkey-register">
            <input type="checkbox" checked={registerPasskey} onChange={(event) => setRegisterPasskey(event.target.checked)} disabled={busy} />
            <span>로그인 후 Face ID·지문 로그인 등록</span>
          </label>}
          <button className="numplate-primary-button" type="submit" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
          {passkeySupported && <button className="numplate-passkey-button" type="button" onClick={biometricLogin} disabled={busy || form.phone.length < 8}>Face ID·지문으로 로그인</button>}
        </form>

        {message && <p className="numplate-login-message" role="alert">{message}</p>}
      </section>
    </main>
  );
}
