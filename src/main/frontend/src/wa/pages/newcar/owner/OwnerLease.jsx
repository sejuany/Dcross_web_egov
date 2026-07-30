
import React, { useMemo, useState, useEffect } from 'react';

import { gf, log } from '../../../../utils/utils';

// 그 외 캐피탈 모달창
import LeaseCompanyModal from './LeaseCompanyModal';
// 분리 입력 (주민번호, 사업자번호, 휴대폰 등)
import SplitInput from '../../common/SplitInput';

// 주소 기능
import useAddressHandler from '../../../../hooks/useAddressHandler';

const OwnerLease = ({
	dsService,
	dsNewCar,
	setDsNewCar,
	dsOwnerInfo,
	dsCarNoDetach,
	dsBaseList,
	setDsOwnerInfo,
	handleChange,
	onSave
}) => {
	// 외국인등록번호 선택 시 최종확인 단계에서 첨부해야 하는 서류를 안내한다.
	const showForeignerGuide = dsNewCar.REG_GB === 'F';
	// 법인 등록번호 선택 시 화면 변경 
		const isCorporate = dsNewCar.REG_GB === 'B';
	// 그 외 리스사 모달창
	const [showLeaseModal, setShowLeaseModal] = useState(false);
	// 자주 사용하는 리스사
	const LEASE_COMPANIES = [
	    '우리금융캐피탈', '산은캐피탈', '비엔케이캐피탈', '엔에이치농협캐피탈', '케이비캐피탈', '오릭스캐피탈', '하나캐피탈'
	];
	// 주소 기능 추가
	const { handleLeaseCompany } = useAddressHandler({ dsNewCar, dsBaseList, setDsNewCar, setDsOwnerInfo });
	
	// 계약자와 동일
	const handleSameCustomer = (e) => {

	    setDsOwnerInfo(prev => ({
	        ...prev,
	        DEBTOR_NM: e.target.checked
	            ? (dsCarNoDetach.CUSTOMER_NM ?? '')
	            : ''
	    }));

	};

	// 현재 선택된 리스사
	const currentCompany = useMemo(() => {
	    const base = dsBaseList.find(item =>
	        String(item.BASE_ID) === String(dsNewCar.BASE_BRANCH_ID)
	    );
		
	    if (!base) {
	        return null;
	    }

	    return {
	        BASE_ID: base.BASE_ID,
	        BASE_NM: base.BASE_NM.replace(/주식회사/g, '').replace(/\(.*?\)/g, '').trim()
	    };

	}, [dsBaseList, dsNewCar.BASE_BRANCH_ID]);


	// 자주 사용하는 리스사 (본점만)
	const leaseCompanies = useMemo(() => {

	    return LEASE_COMPANIES
	        .map(company => {

				const headOffice = dsBaseList.find(item =>
				    item.BASE_NM.includes('(본점)') &&
				    (
				        item.BASE_NM.includes(company) ||
				        company.includes(item.BASE_NM.replace(/주식회사/g, '').replace(/\(.*?\)/g, '').trim())
				    )
				);

	            return headOffice
	                ? {
	                    BASE_ID: headOffice.BASE_ID,
	                    BASE_NM: company
	                }
	                : null;

	        })
	        .filter(Boolean);

	}, [dsBaseList]);


	// Select 표시 목록
	const selectCompanies = useMemo(() => {

	    const list = [...leaseCompanies];

	    if (
	        currentCompany &&
	        !list.some(item => String(item.BASE_ID) === String(currentCompany.BASE_ID))
	    ) {
	        list.unshift(currentCompany);
	    }

	    return list;

	}, [leaseCompanies, currentCompany]);

    return (
        <>
            {/* 리스사 선택 */}
			<div className="wa-form-row">

			    <label className="wa-form-label">
			        리스사 선택
			    </label>

			    <div className="wa-form-control">

			        <div className="wa-inline-group">
		
						<select
						    className="wa-select wa-flex"
						    value={String(dsNewCar.BASE_BRANCH_ID ?? '')}
						    onChange={e => handleLeaseCompany(e.target.value)}
						>
						    <option value="">선택</option>

							{selectCompanies.map(item => (
							    <option
							        key={item.BASE_ID}
							        value={item.BASE_ID}
							    >
							        {item.BASE_NM}
							    </option>
							))}
						</select>

						<button
						    type="button"
						    className="wa-lease-btn"
						    onClick={() => setShowLeaseModal(true)}
						>
						    그 외 캐피탈
						</button>

			        </div>

			    </div>

			</div>
			
			{/* 그 외 캐피탈 선택 모달창 */}
			{showLeaseModal && (
				<LeaseCompanyModal
					dsService={dsService}
					dsNewCar={dsNewCar}
				    dsBaseList={dsBaseList}
					handleChange={handleChange}
				    onSelect={baseId => handleLeaseCompany(baseId)}
				    onClose={() => setShowLeaseModal(false)}
					onSave={onSave}
				/>
			)}


			<div className="wa-form-row">

			    <div className="wa-form-label-wrap">

			        <label className="wa-form-label">리스 계약자명</label>

					<label className="wa-form-sub-label">
			            계약자와 동일
			            <input type="checkbox" onChange={handleSameCustomer} />
			        </label>

			    </div>

			    <div className="wa-form-control">

					<input
	                    className="wa-input"
	                    autoComplete="off"
	                    name="DEBTOR_NM"
	                    data-type="owner"
	                    value={dsOwnerInfo.DEBTOR_NM ?? ''}
	                    onChange={handleChange}
	                    placeholder="이름을 입력하세요"
	                />

			    </div>

			</div>
			

			<div className="wa-form-row">
			    <label className="wa-form-label">
			        리스 계약자 등록번호
			    </label>
			    <div className="wa-form-control">
			        <div className="wa-inline-group">
						<select
						    className="wa-select"
						    name="DEBTOR_GB"
						    data-type="owner"
						    value={dsOwnerInfo.DEBTOR_GB ?? ''}
						    onChange={handleChange}
						>
						    <option value="">선택</option>
						    <option value="R">주민등록번호</option>
						    <option value="F">외국인등록번호</option>
						    <option value="C">사업자번호</option>
						</select>

						{dsOwnerInfo.DEBTOR_GB === 'C' ? (
						    <SplitInput
								key={dsOwnerInfo.DEBTOR_GB}
						        value={dsOwnerInfo.DEBTOR_BIZ_NO}
						        lengths={[3, 2, 5]}
						        placeholders={['123', '45', '67890']}
						        onChange={value =>
						            setDsOwnerInfo(prev => ({
						                ...prev,
						                DEBTOR_BIZ_NO: value
						            }))
						        }
						    />
						) : (
						    <SplitInput
								key={dsOwnerInfo.DEBTOR_GB}
						        value={dsOwnerInfo.DEBTOR_REG_NO}
						        lengths={[6, 7]}
						        onChange={value =>
						            setDsOwnerInfo(prev => ({
						                ...prev,
						                DEBTOR_REG_NO: value
						            }))
						        }
						    />
						)}

			        </div>
			    </div>
			</div>

			<div className="wa-form-row">
			    <label className="wa-form-label">
			        리스 계약자 휴대폰번호
			    </label>
			    <div className="wa-form-control">
					<div className="wa-inline-group">
						<SplitInput
						    value={dsOwnerInfo.DEBTOR_TEL_NO}
						    lengths={[3, 4, 4]}
							fixedValues={['010']}
							placeholders={['010', '1234', '5678']}
						    onChange={value =>
						        setDsOwnerInfo(prev => ({
						            ...prev,
						            DEBTOR_TEL_NO: value
						        }))
						    }
						/>
			        </div>
			    </div>
			</div>
			
        </>
    );
};

export default OwnerLease;
