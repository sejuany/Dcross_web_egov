import React, { useState } from 'react';
import { Users, CheckCircle2 } from 'lucide-react';
import { gf } from '../../../../utils/utils';

// 분리 입력 (주민번호, 사업자번호, 휴대폰 등)
import SplitInput from '../../common/SplitInput';

import '../../../styles/owner/OwnerNormal.css';
import AddressSearch from '../../common/AddressSearch'; // 주소 입력

import JointOwner from './JointOwner';


const OwnerPersonal = ({
    dsNewCar,
	dsCarNoDetach,
	setDsNewCar,
	dsOwnerInfo,
	setDsOwnerInfo,
    handleChange,
	saveProcess,
	address
}) => {
/* =========================================================
 * State
 * 화면에서 사용하는 데이터
 * ========================================================= */
	// 외국인등록번호 선택 시 최종확인 단계에서 첨부해야 하는 서류를 안내한다.
	const showForeignerGuide = dsNewCar.REG_GB === 'F';
	// 법인 등록번호 선택 시 화면 변경 
	const isCorporate = dsNewCar.REG_GB === 'B';
	// 등록번호 종류를 선택한 경우에만 주소 입력을 표시한다.
	// 초기 화면에서는 구매 방식 선택과 기본 정보 입력에 집중할 수 있도록 주소를 숨긴다.
	const showAddress = Boolean(dsNewCar.REG_GB);
	// 공동명의 버튼 클릭
	const [showJointOwner, setShowJointOwner] = useState(false);
	// 공동명의 입력 여부 (강제 표시)
	const forceOpen =
	    Number(dsNewCar.RATIO_NO || 100) !== 100 ||
	    Number(dsOwnerInfo.DEBTOR_RATIO || 0) > 0;

	// 공동명의 영역 표시 여부
	const isJointOwnerOpen = showJointOwner || forceOpen;

/* =========================================================
 * Effect
 * ========================================================= */
	// 계약자와 동일
	const handleSameCustomer = (e) => {
	
	    setDsNewCar(prev => ({
	        ...prev,
	        OWNER_NM: e.target.checked
	            ? (dsCarNoDetach.CUSTOMER_NM ?? '')
	            : ''
	    }));
	
	};
	
	// 주소 기능 추가
	const {
	    handleAddressSelect,
	    handleClearAddress,
	} = address;

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
	
	const handleToggleJointOwner = async () => {

	    // 현재 열려있으면 삭제 여부 확인
	    if (isJointOwnerOpen) {

	        const ok = await gf.confirm(
	            '공동소유자 정보를 삭제하시겠습니까? 확인을 누르면 공동소유 정보가 삭제 되며, 단독소유로 변경 됩니다.',
	            '공동소유자 삭제',
	        );

	        if (!ok) {
	            return;
	        }

	        const nextOwnerInfo = {
	            ...dsOwnerInfo,
	            DEBTOR_GB: '',
	            DEBTOR_NM: '',
	            DEBTOR_REG_NO: '',
	            DEBTOR_BIZ_NO: '',
	            DEBTOR_RATIO: '',
	            DEBTOR_TEL_NO: '',
	            DEBTOR_ADDR: '',
	            DEBTOR_ADDR_DT: '',
	            DEBTOR_ROAD_CD: ''
	        };

	        const nextNewCar = {
	            ...dsNewCar,
	            RATIO_NO: '100'
	        };

	        setDsNewCar(nextNewCar);
	        setDsOwnerInfo(nextOwnerInfo);

	        await saveProcess(
	            nextNewCar,
	            "SAV",
	            null,
	            nextOwnerInfo
	        );

	        setShowJointOwner(false);

	    } else {

	        // 공동명의 입력창 열기
	        setShowJointOwner(true);

	    }
	};
	
    return (
	    <>
			{/* 대표소유자 */}
			<div className="wa-form-row">
			    <div className="wa-form-label-wrap">
			        <label className="wa-form-label">대표소유자명</label>
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
			            autoComplete="off"
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
							maskLast={['R', 'F'].includes(dsNewCar.REG_GB)}
							inputClassName="wa-number-center"
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
								inputClassName="wa-number-center"
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
						    fixedValues={['010']}
						    placeholders={['010', '1234', '5678']}
							inputClassName="wa-number-center"
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
	
			{/* 등본상 주소 */}
			{showAddress && (
					
				<AddressSearch
				    label={isCorporate ? '본점 소재지' : '등본상 주소'}
				    placeholder={
				        isCorporate
				            ? '사업자등록증에 기재된 본점 소재지 입력 (건물, 지번 또는 도로명 검색)'
				            : '건물, 지번 또는 도로명 검색'
				    }
					type="ADDRESS"
					detailName="ADDRESS_DT"
					postName="POST_NO"
				    dsNewCar={dsNewCar}
				    handleChange={handleChange}
					onSelect={handleAddressSelect}
					onClear={handleClearAddress}
				/>
			)}
			
			{/* 사용본거지 */}
			{isCorporate && (
				<AddressSearch
					label="사용본거지"
					sameLabel={isCorporate ? '본점 소재지' : '등본상 주소'}
					placeholder="자동차보험 가입 시 등록할 주소 입력 (건물, 지번 또는 도로명 검색)"
					type="BASE_ADDRESS"
					detailName="BASE_ADDRESS_DT"
					postName="BASE_POST_NO"
					dsNewCar={dsNewCar}
					handleChange={handleChange}
					onSelect={handleAddressSelect}
					onClear={handleClearAddress}
					showSameCheckbox
					onSameChange={handleSameAddress}
				/>
			)}
		
			
		    {/* 공동소유 */}
			{!isCorporate && (
				<button
				    type="button"
				    className={`wa-joint-btn ${isJointOwnerOpen ? 'active' : ''}`}
				    onClick={handleToggleJointOwner}
				>
				    <CheckCircle2
				        size={16}
				        className={`wa-check-icon ${isJointOwnerOpen ? 'active' : ''}`}
				    />

				    <Users size={18} className="wa-joint-icon" />

				    공동 명의 시 클릭
				</button>
			)}
			
			
			{isJointOwnerOpen && (
			    <div className="wa-joint-owner">
			        <JointOwner
						dsNewCar={dsNewCar}
			            dsOwnerInfo={dsOwnerInfo}
						setDsNewCar={setDsNewCar}
			            setDsOwnerInfo={setDsOwnerInfo}
			            handleChange={handleChange}
			            SplitInput={SplitInput}
			            onSelect={handleAddressSelect}
			            onClear={handleClearAddress}
			        />
			    </div>
			)}
		</>
    );
};

export default OwnerPersonal;
