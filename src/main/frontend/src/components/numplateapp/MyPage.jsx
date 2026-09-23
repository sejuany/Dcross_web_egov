import React, { useState } from 'react';
import axios from 'axios';

export default function MyPage() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value.replace(/[^0-9]/g, '').slice(0, 4) });
  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    if (form.newPassword !== form.confirmPassword) return setMessage('신규 비밀번호가 일치하지 않습니다.');
    setSaving(true);
    try {
      await axios.post('/api/numplateapp/password', form);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage('비밀번호를 변경했습니다.');
    } catch (error) {
      setMessage(error.response?.data?.message || '비밀번호를 변경하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="numplate-process-page">
      <div className="numplate-page-title"><h1>마이페이지</h1></div>
      <form className="numplate-request-form" onSubmit={submit}>
        <label><span>현재 비밀번호</span><input name="currentPassword" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength="4" value={form.currentPassword} onChange={change} autoComplete="current-password" required /></label>
        <label><span>신규 비밀번호</span><input name="newPassword" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength="4" value={form.newPassword} onChange={change} autoComplete="new-password" required /></label>
        <label><span>신규 비밀번호 확인</span><input name="confirmPassword" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength="4" value={form.confirmPassword} onChange={change} autoComplete="new-password" required /></label>
        {message && <p className="numplate-inline-message" role="status">{message}</p>}
        <button className="numplate-primary-button" type="submit" disabled={saving}>{saving ? '변경 중…' : '비밀번호 변경'}</button>
      </form>
    </section>
  );
}
