import React, { useId, useState } from 'react';
import { gf } from '../../../../utils/utils';

const PrivateBusinessChoice = ({ label = '대표소유자 구분', value, onChange }) => {
    const [confirming, setConfirming] = useState(false);
    const radioName = useId();

    const selectPrivateBusiness = async () => {
        setConfirming(true);
        onChange('');
        try {
            const confirmed = await gf.confirm(
                '개인사업자는 주민등록번호 / 외국인등록번호만 입력 가능합니다. (법인등록번호 입력 불가)',
                '개인사업자 확인',
                { okText: '예', cancelText: '아니요' }
            );
            if (confirmed) onChange('PRIVATE');
        } finally {
            setConfirming(false);
        }
    };

    return (
        <div className="wa-form-row wa-private-business-row">
            <label className="wa-form-label" id={`${radioName}-label`}>{label}</label>
            <div className="wa-form-control">
                <div className="wa-private-business-options" role="radiogroup" aria-labelledby={`${radioName}-label`}>
                    {[
                        { value: 'PERSONAL', label: '개인' },
                        { value: 'PRIVATE', label: '개인사업자' },
                        { value: 'CORPORATE', label: '법인사업자' }
                    ].map(option => (
                        <label key={option.value} className={`wa-option-btn ${value === option.value ? 'active' : ''}`}>
                            <input type="radio" className="wa-owner-type-radio" name={radioName}
                                value={option.value} checked={value === option.value} disabled={confirming}
                                onChange={() => option.value === 'PRIVATE'
                                    ? selectPrivateBusiness() : onChange(option.value)} />
                            {option.label}
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PrivateBusinessChoice;
