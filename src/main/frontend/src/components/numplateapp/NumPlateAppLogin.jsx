import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import NumPlateSessionStatus from './NumPlateSessionStatus';
import NumPlateLoginGuide from './NumPlateLoginGuide';
import { isNumPlateUser, isImageManagementUser, numPlateHome } from './numplateAuth';
import './NumPlateApp.css';

const isMobileDevice = () => navigator.userAgentData?.mobile
  || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

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

/** 매니저 휴대폰 로그인과 권한이 확인된 기존 계정 로그인을 제공한다. */
export default function NumPlateAppLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, numPlateSessionLoading, numPlateSessionError, retryNumPlateSession } = useAuth();
  const [form, setForm] = useState({ phone: '', password: '' });
  const [accountForm, setAccountForm] = useState({ userId: '', password: '' });
  const [loginMode, setLoginMode] = useState('manager');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const requestedPath = location.state?.from;
  const desktopLogin = !isMobileDevice();
  const managementLogin = desktopLogin && loginMode === 'images';
  const activeForm = managementLogin ? accountForm : form;
  const nextPath = typeof requestedPath === 'string' && requestedPath.startsWith('/numplateapp/')
    && !/^\/numplateapp\/(login|images)(?:[/?#]|$)/.test(requestedPath)
    ? requestedPath : '/numplateapp';
  const destination = (loggedInUser) => isImageManagementUser(loggedInUser) ? numPlateHome(loggedInUser) : nextPath;

  useEffect(() => {
    // 이미 전용 세션이 있으면 로그인 화면을 다시 보여주지 않는다.
    if (!guideOpen && !numPlateSessionLoading && !numPlateSessionError && isNumPlateUser(user)) {
      navigate(isImageManagementUser(user) ? numPlateHome(user) : nextPath, { replace: true });
    }
  }, [guideOpen, navigate, nextPath, numPlateSessionError, numPlateSessionLoading, user]);

  useEffect(() => {
    if (!window.isSecureContext || !window.PublicKeyCredential) return;
    const checkPlatformAuthenticator = window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
    if (!checkPlatformAuthenticator) return;
    checkPlatformAuthenticator.call(window.PublicKeyCredential)
      .then(setPasskeySupported).catch(() => setPasskeySupported(false));
  }, []);

  const registerBiometricLogin = async () => {
    if (guideOpen) return;
    const { data: options } = await axios.post('/api/numplateapp/passkeys/register/options');
    const credential = await navigator.credentials.create({ publicKey: decodeCredentialOptions(options) });
    await axios.post('/api/numplateapp/passkeys/register/verify', encodeCredential(credential));
  };

  const change = ({ target }) => {
    if (guideOpen) return;
    if (managementLogin) {
      setAccountForm((current) => ({ ...current, [target.name]: target.value.slice(0, target.name === 'userId' ? 40 : 100) }));
      setMessage('');
      return;
    }
    const value = target.value.replace(/\D/g, '').slice(0, target.name === 'phone' ? 11 : 100);
    setForm((current) => ({ ...current, [target.name]: value }));
    setMessage('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (guideOpen || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const credentials = managementLogin ? { ...accountForm, userId: accountForm.userId.trim() } : form;
      const { data } = await axios.post('/api/numplateapp/login', { ...credentials, rememberMe });
      if (!isImageManagementUser(data.user) && !managementLogin && isMobileDevice() && !data.passkeyRegistered && passkeySupported) {
        try {
          await registerBiometricLogin();
        } catch (error) {
          if (error.name !== 'NotAllowedError') {
            window.alert(error.response?.data?.message || '로그인은 완료했지만 생체 로그인 등록은 실패했습니다.');
          }
        }
      }
      login(data.user, data.session);
      navigate(destination(data.user), { replace: true });
    } catch (error) {
      setMessage(error.response?.data?.message || (managementLogin ? '아이디 또는 비밀번호를 확인해 주세요.' : '휴대폰 번호 또는 비밀번호를 확인해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const biometricLogin = async () => {
    if (guideOpen || busy || managementLogin) return;
    setBusy(true);
    setMessage('');
    try {
      const { data: options } = await axios.post('/api/numplateapp/passkeys/login/options', { rememberMe });
      const credential = await navigator.credentials.get({ publicKey: decodeCredentialOptions(options) });
      const { data } = await axios.post('/api/numplateapp/passkeys/login/verify', encodeCredential(credential));
      login(data.user, data.session);
      navigate(destination(data.user), { replace: true });
    } catch (error) {
      setMessage(error.name === 'NotAllowedError'
        ? '생체 로그인이 취소되었습니다.'
        : (error.response?.data?.message || '생체 로그인에 실패했습니다. 비밀번호로 로그인해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  if (numPlateSessionLoading || numPlateSessionError) {
    return <NumPlateSessionStatus loading={numPlateSessionLoading} error={numPlateSessionError} onRetry={retryNumPlateSession} />;
  }

  return (
    <main className="numplate-login-page">
      <section className="numplate-login-card">
        <Link className="numplate-login-logo" to="/login" aria-label="일반 로그인으로 이동"
          onClick={(event) => { if (guideOpen) event.preventDefault(); }}>
          <img src="/logo_navy_horizontal.png" alt="DACOS" />
        </Link>
        <h1>번호판 탈부착</h1>
        {desktopLogin && <div className="numplate-login-mode" role="group" aria-label="로그인 방식">
          <button type="button" aria-pressed={!managementLogin} disabled={busy || guideOpen}
            onClick={() => { setLoginMode('manager'); setMessage(''); }}>매니저 로그인</button>
          <button type="button" aria-pressed={managementLogin} disabled={busy || guideOpen}
            onClick={() => { setLoginMode('images'); setMessage(''); }}>탈부착 관리</button>
        </div>}
        <p className="numplate-login-guide">{managementLogin ? '기존 계정으로 로그인하면 탈부착 관리 권한을 확인합니다.' : '등록된 담당자 휴대폰 번호로 로그인해 주세요.'}</p>

        <form onSubmit={submit} autoComplete={guideOpen ? 'off' : undefined}>
          <label>
            <span>{managementLogin ? '아이디' : '휴대폰 번호'}</span>
            <input
              name={managementLogin ? 'userId' : 'phone'}
              type={managementLogin ? 'text' : 'tel'}
              value={managementLogin ? accountForm.userId : form.phone}
              onChange={change}
              inputMode={managementLogin ? 'text' : 'numeric'}
              autoComplete={guideOpen ? 'off' : (managementLogin ? 'username' : 'tel')}
              minLength={managementLogin ? 1 : 8}
              maxLength={managementLogin ? 40 : 11}
              placeholder={managementLogin ? '기존 계정 아이디' : '01012345678'}
              required
              disabled={busy || guideOpen}
            />
          </label>
          <label>
            <span>비밀번호</span>
            <input name="password" type="password" inputMode={managementLogin ? 'text' : 'numeric'} pattern={managementLogin ? undefined : '[0-9]*'} value={activeForm.password} onChange={change}
              autoComplete={guideOpen ? 'off' : 'current-password'} maxLength={100} required disabled={busy || guideOpen} />
          </label>
          <div className="numplate-login-options">
            <label className="numplate-login-remember">
              <input type="checkbox" checked={rememberMe}
                onChange={(event) => { if (!guideOpen) setRememberMe(event.target.checked); }} disabled={busy || guideOpen} />
              <span>로그인 상태 유지</span>
            </label>
            {!managementLogin && !isNumPlateUser(user) && <NumPlateLoginGuide disabled={busy} onGuideChange={setGuideOpen} />}
          </div>
          <button className="numplate-primary-button" type="submit" disabled={busy || guideOpen}>{busy ? '로그인 중…' : '로그인'}</button>
          {!managementLogin && passkeySupported && <button className="numplate-passkey-button" type="button" onClick={biometricLogin} disabled={busy || guideOpen}>Face ID·지문으로 로그인</button>}
        </form>

        {!guideOpen && message && <p className="numplate-login-message" role="alert">{message}</p>}
      </section>
    </main>
  );
}
