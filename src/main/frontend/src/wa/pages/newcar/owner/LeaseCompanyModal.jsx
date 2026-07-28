import { X } from 'lucide-react';
import axios from 'axios';
import React, { useMemo, useState } from 'react';

import '../../../styles/LeaseCompanyModal.css';


// 그 외 캐피탈 선택 모달
const LeaseCompanyModal = ({
	dsService,
	dsNewCar,
	dsOwnerInfo,
	dsBaseList,
	onSelect,
	onClose,
	onSave,
	handleChange
}) => {
	const [company, setCompany] = useState('');
	const [directCompany, setDirectCompany] = useState(''); // 직접입력창
	
	// 리스사 목록 (본점만)
	const leaseCompanies = useMemo(() => {

	    return dsBaseList
	        .filter(item => item.BASE_NM.includes('(본점)'))
			.map(item =>
	            item.BASE_NM
	                .replace(/\(.*?\)/, '')      // (본점) 제거
	                .replace(/\s*주식회사$/, '') // 뒤의 '주식회사' 제거
	                .trim()
	        );

	}, [dsBaseList]);
	

	// 신차사업팀에 직접입력일 때 알람 띄우기
	const setBoard = async () => {
		
		try {
			console.log(setBoard);
			console.log(dsNewCar);
			
	        await axios.post("/api/common/procedure/board", {
	            SERVICE_ID: dsService.SERVICE_ID,
	            CONTENT_TX: "[신차사업] 리스사 직접입력 확인",
	            GUBUN: "2"
	        });

	    } catch (error) {
	        console.error(error);
	    }
	};
	
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
								onChange={e => {
								    const value = e.target.value;
								    setCompany(value);

								    if (value !== 'INPUT') {
								        setDirectCompany('');
								    }
								}}
							>
							    <option value="">선택</option>
	
							    {leaseCompanies.map(company => (
							        <option key={company} value={company}>
							            {company}
							        </option>
							    ))}
								
								<option value="INPUT">직접 입력</option>
							</select>

                        </div>
						
                    </div>
					
				{/* 리스사명 */}
				{company === 'INPUT' 
					&& (dsNewCar?.PROC_CD === 'I' || dsNewCar?.PROC_CD === 'C') && (
					dsNewCar.PROC_CD === 'I' ? (
		                <div className="wa-form-row">
						
		                    <label className="wa-form-label">
		                        리스사명
		                    </label>
							<div className="wa-form-control">
								
							    <input
							        type="text"
							        className="wa-input"
									name="OWNER_NM"
									data-type="newcar"									    
									value={dsNewCar.OWNER_NM ?? ''}
									onChange={handleChange}
									placeholder="리스사명을 입력해주세요."
							    />
									
							</div>
							
						</div>
					) : (
						<div className="wa-form-row">
												
		                    <label className="wa-form-label">
		                        리스사명
		                    </label>
							<div className="wa-form-control">
								
							    <input
							        type="text"
							        className="wa-input"
									name="DEBTOR_NM"
									data-type="owner"									    
									value={dsOwnerInfo.DEBTOR_NM ?? ''}
									onChange={handleChange}
									placeholder="리스사명을 입력해주세요."
							    />
									
							</div>
							
						</div>
					   )
				)}

                </div>

                {/* 완료 버튼 */}
                <div className="wa-lease-modal-footer">

					<button
					    type="button"
					    className="wa-primary-btn"
						onClick={async () => {

							let headOffice;
							
							if (company === 'INPUT') {
								
								headOffice = dsBaseList.find(item =>item.BASE_NM.includes('직접입력'));
								
								// 신차사업팀에 직접입력일 때 알람 띄우기
								await setBoard();
								
							} else {
								headOffice = dsBaseList.find(item =>
							        item.BASE_NM.includes(company) &&
							        item.BASE_NM.includes('(본점)')
							    );
								
							}
							
							const result = onSelect(headOffice.BASE_ID);

							await onSave(
							    result?.dsNewCar ?? null,
							    "SAV",
							    null,
							    result?.dsOwnerInfo ?? null,
							    null,
							    true
							);

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