import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './MemberEdit.css';
import PasswordChangeModal from './PasswordChangeModal';

const emptyForm = {
  LOGIN_ID: '',
  MEMBER_NM: '',
  TEL_NO: '',
  MPHONE_NO: '',
  LOGIN_GB: 'P',
  REGIST_NO: '',
  USE_YN: ''
};

const MemberEdit = () => {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  useEffect(() => {
    loadMemberInfo();
  }, []);

  const loadMemberInfo = async () => {
    try {
      setLoading(true);
      const res = await axios.post('/api/member/my-info', {});

      if (!res.data?.success) {
        alert(res.data?.message || '회원정보를 불러올 수 없습니다.');
        return;
      }

      const info = res.data.memberInfo || {};

      setForm({
        LOGIN_ID: info.LOGIN_ID || info.MEMBER_ID || '',
        MEMBER_NM: info.MEMBER_NM || '',
        TEL_NO: info.TEL_NO || '',
        MPHONE_NO: info.MPHONE_NO || '',
        LOGIN_GB: info.LOGIN_GB || 'P',
        REGIST_NO: info.REGIST_NO || '',
        USE_YN: info.USE_YN || ''
      });
    } catch (e) {
      console.error(e);
      alert('회원정보 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatTelNo = (value) => {
    const num = value.replace(/\D/g, '').slice(0, 11);

    if (!num) return '';

    if (num.startsWith('02')) {
      if (num.length <= 2) return num;
      if (num.length <= 5) return `${num.slice(0, 2)}-${num.slice(2)}`;
      if (num.length <= 9) {
        return `${num.slice(0, 2)}-${num.slice(2, num.length - 4)}-${num.slice(-4)}`;
      }
      return `${num.slice(0, 2)}-${num.slice(2, 6)}-${num.slice(6, 10)}`;
    }

    if (num.length <= 3) return num;
    if (num.length <= 6) return `${num.slice(0, 3)}-${num.slice(3)}`;
    if (num.length <= 10) {
      return `${num.slice(0, 3)}-${num.slice(3, num.length - 4)}-${num.slice(-4)}`;
    }
    return `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7, 11)}`;
  };

  const formatMobileNo = (value) => {
    const num = value.replace(/\D/g, '').slice(0, 11);

    if (!num) return '';
    if (num.length <= 3) return num;
    if (num.length <= 7) return `${num.slice(0, 3)}-${num.slice(3)}`;
    return `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7, 11)}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    let nextValue = value;

    if (name === 'TEL_NO') {
      nextValue = formatTelNo(value);
    } else if (name === 'MPHONE_NO') {
      nextValue = formatMobileNo(value);
    }

    setForm((prev) => ({
      ...prev,
      [name]: nextValue
    }));
  };

  const handleLoginGbChange = (value) => {
    setForm((prev) => ({
      ...prev,
      LOGIN_GB: value,
      REGIST_NO: ''
    }));
  };

  const registFront = useMemo(() => {
    if (form.LOGIN_GB === 'C') return '';
    return form.REGIST_NO ? form.REGIST_NO.substring(0, 6) : '';
  }, [form.REGIST_NO, form.LOGIN_GB]);

  const registBack = useMemo(() => {
    if (form.LOGIN_GB === 'C') return '';
    return form.REGIST_NO && form.REGIST_NO.length > 6
      ? form.REGIST_NO.substring(6, 7)
      : '';
  }, [form.REGIST_NO, form.LOGIN_GB]);

  const handleRegistFrontChange = (e) => {
    const onlyNumber = e.target.value.replace(/\D/g, '').slice(0, 6);
    setForm((prev) => ({
      ...prev,
      REGIST_NO: onlyNumber + registBack
    }));
  };

  const handleRegistBackChange = (e) => {
    const onlyNumber = e.target.value.replace(/\D/g, '').slice(0, 1);
    setForm((prev) => ({
      ...prev,
      REGIST_NO: registFront + onlyNumber
    }));
  };

  const handleCorpRegistChange = (e) => {
    const onlyNumber = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm((prev) => ({
      ...prev,
      REGIST_NO: onlyNumber
    }));
  };

  const validateForm = () => {
    if (!form.MEMBER_NM.trim()) {
      alert('성명을 입력하세요.');
      return false;
    }

    if (!form.TEL_NO.trim()) {
      alert('전화번호를 입력하세요.');
      return false;
    }

    if (!form.REGIST_NO.trim()) {
      alert('로그인 등록번호를 입력하세요.');
      return false;
    }

    const telOnly = form.TEL_NO.replace(/\D/g, '');
    if (telOnly.length < 9) {
      alert('전화번호 형식을 확인하세요.');
      return false;
    }

    if (form.MPHONE_NO.trim()) {
      const mobileOnly = form.MPHONE_NO.replace(/\D/g, '');
      if (mobileOnly.length < 10) {
        alert('휴대폰번호 형식을 확인하세요.');
        return false;
      }
    }

    if (form.LOGIN_GB === 'C') {
      const onlyNumber = form.REGIST_NO.replace(/\D/g, '');
      if (onlyNumber.length !== 10) {
        alert('법인용은 사업자등록번호 10자리를 입력하세요.');
        return false;
      }
    } else {
      const onlyNumber = form.REGIST_NO.replace(/\D/g, '');
      if (onlyNumber.length !== 7) {
        alert('개인용/휴대폰은 주민번호 앞 6자리 + 뒤 1자리, 총 7자리를 입력하세요.');
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!window.confirm('회원 기본정보를 수정하시겠습니까?')) return;

    try {
      setSaving(true);

      const payload = {
        MEMBER_NM: form.MEMBER_NM,
        TEL_NO: form.TEL_NO,
        MPHONE_NO: form.MPHONE_NO,
        LOGIN_GB: form.LOGIN_GB,
        REGIST_NO: form.REGIST_NO
      };

      const res = await axios.post('/api/member/update-basic', payload);

      if (res.data?.success) {
        alert(res.data?.message || '회원정보가 수정되었습니다.');
        loadMemberInfo();
      } else {
        alert(res.data?.message || '회원정보 수정에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('회원정보 수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="member-edit-page">회원정보를 불러오는 중입니다...</div>;
  }

  return (
    <div className="member-edit-page">
      <div className="profile-card">
        <div className="profile-card-header">
          <div className="profile-card-header-left">
            <h2>회원정보수정</h2>
            <p>회원 기본정보를 수정할 수 있습니다.</p>
          </div>
        </div>

        <div className="profile-list">
          <div className="profile-row">
            <div className="profile-label">사용자 ID</div>
            <div className="profile-value">
              <input
                name="LOGIN_ID"
                value={form.LOGIN_ID}
                readOnly
                className="profile-input is-readonly"
              />
            </div>
          </div>

          <div className="profile-row">
            <div className="profile-label">성명</div>
            <div className="profile-value">
              <input
                name="MEMBER_NM"
                value={form.MEMBER_NM}
                onChange={handleChange}
                className="profile-input"
                placeholder="성명을 입력하세요"
              />
            </div>
          </div>

          <div className="profile-row">
            <div className="profile-label">전화번호</div>
            <div className="profile-value">
              <input
                name="TEL_NO"
                value={form.TEL_NO}
                onChange={handleChange}
                className="profile-input"
                placeholder="예: 02-1234-5678"
              />
            </div>
          </div>

          <div className="profile-row">
            <div className="profile-label">휴대폰번호</div>
            <div className="profile-value">
              <input
                name="MPHONE_NO"
                value={form.MPHONE_NO}
                onChange={handleChange}
                className="profile-input"
                placeholder="예: 010-1234-5678"
              />
            </div>
          </div>
          <div className="profile-row align-start">
            <div className="profile-label">인증구분</div>
            <div className="profile-value">
              <div className="auth-type-group">
                <label className="radio-item">
                  <input
                    type="radio"
                    name="LOGIN_GB"
                    checked={form.LOGIN_GB === 'C'}
                    onChange={() => handleLoginGbChange('C')}
                  />
                  <span>법인용</span>
                </label>

                <label className="radio-item">
                  <input
                    type="radio"
                    name="LOGIN_GB"
                    checked={form.LOGIN_GB === 'P'}
                    onChange={() => handleLoginGbChange('P')}
                  />
                  <span>개인용</span>
                </label>

                <label className="radio-item">
                  <input
                    type="radio"
                    name="LOGIN_GB"
                    checked={form.LOGIN_GB === 'H'}
                    onChange={() => handleLoginGbChange('H')}
                  />
                  <span>휴대폰</span>
                </label>
              </div>
            </div>
          </div>

          <div className="profile-row align-start">
            <div className="profile-label">로그인 등록번호</div>
            <div className="profile-value">
              {form.LOGIN_GB === 'C' ? (
                <>
                  <input
                    value={form.REGIST_NO}
                    onChange={handleCorpRegistChange}
                    className="profile-input corp-input"
                    placeholder="사업자등록번호 10자리"
                  />
                  <div className="field-guide">
                    법인용은 사업자등록번호를 입력하세요.
                  </div>
                </>
              ) : (
                <>
                  <div className="regist-split-wrap">
                    <input
                      value={registFront}
                      onChange={handleRegistFrontChange}
                      className="profile-input regist-front"
                      maxLength={6}
                      placeholder="앞 6자리"
                    />
                    <span className="split-dash">-</span>
                    <input
                      value={registBack}
                      onChange={handleRegistBackChange}
                      className="profile-input regist-back"
                      maxLength={1}
                      placeholder="1"
                    />
                  </div>
                  <div className="field-guide">
                    개인용/휴대폰은 주민번호 앞 6자리 + 뒤 1자리만 입력하세요.
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="profile-row">
            <div className="profile-label">비밀번호 변경</div>
            <div className="profile-value inline-action">
              <button
                type="button"
                className="profile-line-button"
                onClick={() => setPasswordModalOpen(true)}
              >
                비밀번호 변경
              </button>
            </div>
          </div>
        </div>

        <div className="profile-card-footer">
          <button
            type="button"
            className="profile-save-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <PasswordChangeModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />
    </div>
  );
};

export default MemberEdit;