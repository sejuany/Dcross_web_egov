import { X } from 'lucide-react';

import React, { useMemo, useState } from 'react';

import '../../../styles/LeaseCompanyModal.css';


// 그 외 캐피탈 선택 모달
const LeaseCompanyModal = ({
	dsBaseList,
	onSelect,
	onClose
}) => {
	const [company, setCompany] = useState('');
	
	// 리스사 목록 (본점만)
	const leaseCompanies = useMemo(() => {

	    return dsBaseList
	        .filter(item => item.BASE_NM.includes('(본점)'))
	        .map(item =>
	            item.BASE_NM.replace(/\(.*\)/, '').trim()
	        );

	}, [dsBaseList]);
	
    return (

        <div className="wa-modal-overlay">

            <div className="wa-lease-modal">

                {/* 모달 헤더 */}
                <div className="wa-lease-modal-header">

                    <span>캐피탈 선택</span>

                    <button
                        type="button"
                        className="wa-modal-close"
                        onClick={onClose}
                    >
                        <X size={18} />
                    </button>

                </div>

                {/* 모달 내용 */}
                <div className="wa-lease-modal-body">

                    {/* 리스사 선택 */}
                    <div className="wa-form-row">

                        <label className="wa-form-label">
                            리스사 선택
                        </label>

                        <div className="wa-form-control">
	
							<select
							    className="wa-select"
							    value={company}
							    onChange={e => setCompany(e.target.value)}
							>
							    <option value="">선택</option>
	
							    {leaseCompanies.map(company => (
							        <option key={company} value={company}>
							            {company}
							        </option>
							    ))}
							</select>

                        </div>

                    </div>

                </div>

                {/* 완료 버튼 */}
                <div className="wa-lease-modal-footer">

					<button
					    type="button"
					    className="wa-primary-btn"
						onClick={() => {

						    const headOffice = dsBaseList.find(item =>
						        item.BASE_NM.includes(company) &&
						        item.BASE_NM.includes('(본점)')
						    );

						    onSelect(headOffice.BASE_ID);

						    onClose();
						}}
					>
                        완료
                    </button>

                </div>

            </div>

        </div>

    );

};

export default LeaseCompanyModal;