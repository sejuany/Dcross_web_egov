import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './PasswordChangeModal.css';

const emptyForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

const validatePasswordRule = (password) => {
  const value = String(password || '');

  if (value.length < 8) {
    return {
      valid: false,
      message: '비밀번호를 확인하세요. 비밀번호는 8자 이상입니다.'
    };
  }

  if (/\s/.test(value)) {
    return {
      valid: false,
      message: '공백은 비밀번호에 포함될 수 없습니다.'
    };
  }

  const hasAlpha = /[A-Za-z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSpecial = /[`~!@#$%^&*()_\-+=[\]{}\\|;:'",<.>/?]/.test(value);

  if (!hasAlpha || !hasNumber || !hasSpecial) {
    return {
      valid: false,
      message: '비밀번호에는 영문과 특수문자/숫자가 포함되어야 합니다.'
    };
  }

  return {
    valid: true,
    message: ''
  };
};

const PasswordChangeModal = ({ open, onClose }) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [capsLock, setCapsLock] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setSaving(false);
      setCapsLock({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false
      });
    }
  }, [open]);

  const passwordMatchState = useMemo(() => {
    if (!form.newPassword && !form.confirmPassword) return '';
    if (!form.newPassword || !form.confirmPassword) return '';
    return form.newPassword === form.confirmPassword ? 'match' : 'mismatch';
  }, [form.newPassword, form.confirmPassword]);

  const passwordRuleState = useMemo(() => {
    if (!form.newPassword) return { valid: null, message: '' };
    return validatePasswordRule(form.newPassword);
  }, [form.newPassword]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCapsLock = (e, fieldName) => {
    const isOn = e.getModifierState && e.getModifierState('CapsLock');
    setCapsLock((prev) => ({
      ...prev,
      [fieldName]: isOn
    }));
  };

  const validatePassword = () => {
    if (!form.currentPassword.trim()) {
      alert('현재 비밀번호를 입력하세요.');
      return false;
    }

    if (!form.newPassword.trim()) {
      alert('새 비밀번호를 입력하세요.');
      return false;
    }

    if (!form.confirmPassword.trim()) {
      alert('새 비밀번호 확인을 입력하세요.');
      return false;
    }

    if (form.newPassword !== form.confirmPassword) {
      alert('새 비밀번호와 새 비밀번호 확인이 일치하지 않습니다.');
      return false;
    }

    if (form.currentPassword === form.newPassword) {
      alert('새 비밀번호는 현재 비밀번호와 다르게 입력하세요.');
      return false;
    }

    const ruleCheck = validatePasswordRule(form.newPassword);
    if (!ruleCheck.valid) {
      alert(ruleCheck.message);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validatePassword()) return;
    if (!window.confirm('비밀번호를 변경하시겠습니까?')) return;

    try {
      setSaving(true);

      const res = await axios.post('/api/member/change-password', {
        CURRENT_PASS_WD: form.currentPassword,
        NEW_PASS_WD: form.newPassword
      });

      if (res.data?.success) {
        alert(res.data?.message || '비밀번호가 변경되었습니다.');
        onClose();
      } else {
        alert(res.data?.message || '비밀번호 변경에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const showCapsLock =
    capsLock.currentPassword || capsLock.newPassword || capsLock.confirmPassword;

  return (
    <div className="pw-modal-overlay" onClick={onClose}>
      <div
        className="pw-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pw-modal-header">
          <h3>비밀번호 변경</h3>
          <button type="button" className="pw-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pw-modal-body">
          <div className="pw-form-row">
            <label>현재 비밀번호</label>
            <input
              type="password"
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
              onKeyUp={(e) => handleCapsLock(e, 'currentPassword')}
              onKeyDown={(e) => handleCapsLock(e, 'currentPassword')}
              autoFocus
              placeholder="현재 비밀번호 입력"
            />
          </div>

          <div className="pw-form-row">
            <label>새 비밀번호</label>
            <input
              type="password"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              onKeyUp={(e) => handleCapsLock(e, 'newPassword')}
              onKeyDown={(e) => handleCapsLock(e, 'newPassword')}
              placeholder="8자 이상 영문+숫자+특수문자"
            />
          </div>

          <div className="pw-form-row">
            <label>새 비밀번호 확인</label>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              onKeyUp={(e) => handleCapsLock(e, 'confirmPassword')}
              onKeyDown={(e) => handleCapsLock(e, 'confirmPassword')}
              placeholder="새 비밀번호 다시 입력"
            />
          </div>

          {showCapsLock && (
            <div className="pw-helper warning">
              Caps Lock이 켜져 있습니다.
            </div>
          )}

          {passwordRuleState.valid === false && (
            <div className="pw-helper error">
              {passwordRuleState.message}
            </div>
          )}

          {passwordRuleState.valid === true && (
            <div className="pw-helper success">
              사용 가능한 비밀번호 형식입니다.
            </div>
          )}

          {passwordMatchState === 'match' && (
            <div className="pw-helper success">
              새 비밀번호가 일치합니다.
            </div>
          )}

          {passwordMatchState === 'mismatch' && (
            <div className="pw-helper error">
              새 비밀번호가 일치하지 않습니다.
            </div>
          )}

          <div className="pw-guide">
            비밀번호는 8자 이상이며, 영문/숫자/특수문자를 모두 포함해야 합니다.
          </div>

          <div className="pw-modal-footer">
            <button
              type="button"
              className="pw-btn secondary"
              onClick={onClose}
              disabled={saving}
            >
              취소
            </button>
            <button
              type="submit"
              className="pw-btn primary"
              disabled={saving}
            >
              {saving ? '변경 중...' : '변경'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordChangeModal;