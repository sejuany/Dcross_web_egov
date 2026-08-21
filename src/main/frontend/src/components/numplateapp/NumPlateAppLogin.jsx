import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import './NumPlateApp.css';

const isNumPlateUser = (user) => (user?.login_GB || user?.LOGIN_GB) === 'NUMPLATE_APP';

/** 휴대폰 번호와 ETC6 비밀번호로 번호판 담당자 전용 세션을 시작한다. */
export default function NumPlateAppLogin() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [form, setForm] = useState({ phone: '', password: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 이미 전용 세션이 있으면 로그인 화면을 다시 보여주지 않는다.
    if (isNumPlateUser(user)) navigate('/numplateapp', { replace: true });
  }, [navigate, user]);

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
      // AuthContext가 사용자 정보를 sessionStorage에 보관하고 만료 타이머를 시작한다.
      login(data.user);
      navigate('/numplateapp', { replace: true });
    } catch (error) {
      setMessage(error.response?.data?.message || '휴대폰 번호 또는 비밀번호를 확인해 주세요.');
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
          <button className="numplate-primary-button" type="submit" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
        </form>

        {message && <p className="numplate-login-message" role="alert">{message}</p>}
      </section>
    </main>
  );
}
