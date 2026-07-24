import React, { useEffect, useMemo, useState } from 'react';

import { gf, log } from '../../../../utils/utils';

import LeaseCompanyModal from './LeaseCompanyModal';
import AddressSearch from '../../common/AddressSearch';

// 분리 입력 (주민번호, 사업자번호, 휴대폰 등)
import SplitInput from '../../common/SplitInput';

const OwnerUserLease = ({
	dsNewCar,
	setDsNewCar,
	dsCarNoDetach,
	dsBaseList,
	setDsOwnerInfo,
	handleChange,
	address
}) => {
	// 외국인등록번호 선택 시 최종확인 단계에서 첨부해야 하는 서류를 안내한다.
	const showForeignerGuide = dsNewCar.REG_GB === 'F';
	// 그 외 리스사 모달창
	const [showLeaseModal, setShowLeaseModal] = useState(false);
	// 법인 등록번호 선택 시 화면 변경 
	const isCorporate = dsNewCar.REG_GB === 'B';
	// 등록번호 종류를 선택한 경우에만 주소 입력을 표시한다.
	// 초기 화면에서는 구매 방식 선택과 기본 정보 입력에 집중할 수 있도록 주소를 숨긴다.
	const showAddress = Boolean(dsNewCar.REG_GB);
	// 자주 사용하는 리스사
	const LEASE_COMPANIES = [
	    '우리금융캐피탈', '산은캐피탈', 'BNK캐피탈', 'NH농협캐피탈', 'KB캐피탈', '오릭스캐피탈',
	    '하나캐피탈'
	];
	// 주소 기능 추가
	const {
	    handleLeaseCompany,
	    handleAddressSelect,
	    handleClearAddress
	} = address;
	
	// 계약자와 동일
	const handleSameCustomer = (e) => {

	    setDsNewCar(prev => ({
	        ...prev,
	        OWNER_NM: e.target.checked
	            ? (dsCarNoDetach.CUSTOMER_NM ?? '')
	            : ''
	    }));

	};
	
	// 사용본거지 밑 체크 
	const handleSameAddress = (e) => {

	    setDsNewCar(prev => ({

	        ...prev,
	        BASE_ADDRESS: e.target.checked ? prev.ADDRESS : '',
	        BASE_ADDRESS_DT: e.target.checked ? prev.ADDRESS_DT : '',
	        BASE_POST_NO: e.target.checked ? prev.POST_NO : '',
	        BASE_BUBJUNG_CD: e.target.checked ? prev.BUBJUNG_CD : '',
	        RT_ACC_NO: e.target.checked ? prev.RT_ACC_NM : '',
	        ADDR_INFO2: e.target.checked ? prev.ADDR_INFO : ''
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
	        BASE_NM: base.BASE_NM.replace(/\(.*\)/, '').trim()
	    };

	}, [dsBaseList, dsNewCar.BASE_BRANCH_ID]);


	// 자주 사용하는 리스사 (본점만)
	const leaseCompanies = useMemo(() => {

	    return LEASE_COMPANIES
	        .map(company => {

	            const headOffice = dsBaseList.find(item =>
	                item.BASE_NM.includes(company) &&
	                item.BASE_NM.includes('(본점)')
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
						    value={dsNewCar.BASE_BRANCH_ID ?? ''}
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
				    dsBaseList={dsBaseList}
				    onSelect={baseId => handleLeaseCompany(baseId)}
				    onClose={() => setShowLeaseModal(false)}
				/>
			)}

            {/* 리스 종료일 (만료일) IMSIGV_DT */}
			<div className="wa-form-row">
			    <label className="wa-form-label">
			        리스 종료일
			    </label>

			    <div className="wa-form-control">
			        <input
			            type="date"
			            className="wa-input"
			            value={dsNewCar.IMSIGV_DT ?? ''}
			            onChange={e =>
			                setDsNewCar(prev => ({
			                    ...prev,
			                    IMSIGV_DT: e.target.value
			                }))
			            }
			        />
			    </div>
			</div>

            <hr className="wa-divider" />

            {/* 대표소유자 */}
            <div className="wa-form-row">
                <div className="wa-form-label-wrap">
                    <label className="wa-form-label">대표 소유자명(상호)</label>

                    <label className="wa-form-sub-label">
                        계약자와 동일
						<input type="checkbox"
						        onChange={handleSameCustomer}
						 />
                    </label>
                </div>

                <div className="wa-form-control">
                    <input
                        className="wa-input"
                        name="OWNER_NM"
                        data-type="newcar"
                        value={dsNewCar.OWNER_NM ?? ''}
                        onChange={handleChange}
                        placeholder="이름을 입력하세요"
                    />
                </div>
            </div>

			{/* 등록번호 */}
			<div className="wa-form-row">
			    <label className="wa-form-label">
			        등록번호
			    </label>
			    <div className="wa-form-control">
			        <div className="wa-inline-group">
						<select
						    className="wa-select"
						    name="REG_GB"
						    data-type="newcar"
						    value={dsNewCar.REG_GB ?? ''}
						    onChange={handleChange}
						>
						    <option value="">선택</option>
						    <option value="R">주민등록번호</option>
						    <option value="F">외국인등록번호</option>
						    <option value="B">법인등록번호</option>
						</select>

						<SplitInput
						    value={dsNewCar.REG_NO}
						    lengths={[6, 7]}
						    onChange={value =>
						        setDsNewCar(prev => ({
						            ...prev,
						            REG_NO: value
						        }))
						    }
						/>
			        </div>

					{showForeignerGuide && (
					    <div className="wa-guide-text">
					        *최종확인 페이지에서 외국인 등록증을 첨부하여 주십시오.
					    </div>
					)}
			    </div>
			</div>
			
			{/* 사업자등록번호 */}
			{isCorporate && (
			    <div className="wa-form-row">
			        <label className="wa-form-label">
			            사업자등록번호
			        </label>

			        <div className="wa-form-control">
			            <div className="wa-inline-group">

							<SplitInput
							    value={dsNewCar.BIZ_NO}
							    lengths={[3, 2, 5]}
							    placeholders={['123', '45', '67890']}
							    onChange={value =>
							        setDsNewCar(prev => ({
							            ...prev,
							            BIZ_NO: value
							        }))
							    }
							/>

			            </div>
			        </div>
			    </div>
			)}
			
			{/* 휴대폰번호 */}
			<div className="wa-form-row">
			    <label className="wa-form-label">
			        휴대폰번호
			    </label>
			    <div className="wa-form-control">
			        <div className="wa-inline-group">
						<SplitInput
						    value={dsNewCar.MPHONE_NO}
						    lengths={[3, 4, 4]}
						    placeholders={['010', '1234', '5678']}
						    onChange={value =>
						        setDsNewCar(prev => ({
						            ...prev,
						            MPHONE_NO: value
						        }))
						    }
						/>
			        </div>
			    </div>
			</div>
			

			{showAddress && (
				<AddressSearch
				    label={isCorporate ? '본점 소재지' : '등본상 주소'}
				    placeholder={
				        isCorporate
				            ? '사업자등록증에 기재된 본점 소재지 입력 (건물, 지번 또는 도로명 검색)'
				            : '건물, 지번 또는 도로명 검색'
				    }
					type="ADDRESS"
					prefix=""
					detailName="ADDRESS_DT"
					postName="POST_NO"
				    dsNewCar={dsNewCar}
				    setDsNewCar={setDsNewCar}
				    handleChange={handleChange}
					
					onSelect={handleAddressSelect}
				    onClear={handleClearAddress}
				    onSameChange={handleSameAddress}
				/>
			)}

			{isCorporate && (
				<AddressSearch
				    label="사용본거지"
					sameLabel="본점소재지"
				    placeholder="자동차보험 가입 시 등록할 주소 입력 (건물, 지번 또는 도로명 검색)"
					type="BASE_ADDRESS"
					prefix="BASE_"
					detailName="BASE_ADDRESS_DT"
					postName="BASE_POST_NO"
				    dsNewCar={dsNewCar}
				    setDsNewCar={setDsNewCar}
				    handleChange={handleChange}
					showSameCheckbox
					
					onSelect={handleAddressSelect}
				    onClear={handleClearAddress}
				    onSameChange={handleSameAddress}
				/>
			)}
			
        </>
    );
};

export default OwnerUserLease;