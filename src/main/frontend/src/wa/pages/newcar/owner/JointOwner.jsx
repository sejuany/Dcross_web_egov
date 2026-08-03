import { useRef } from 'react';

import { Search } from 'lucide-react';

import AddressSearch from '../../common/AddressSearch';

const JointOwner = ({
	dsNewCar,
	dsOwnerInfo,
	setDsNewCar,
	setDsOwnerInfo,
	handleChange,
	SplitInput,
	onSelect,
	onClear
}) => {
	
    // 공동소유자 등록번호 종류에 따라 입력항목을 변경한다.
    const isCorporate = dsOwnerInfo.DEBTOR_GB === 'B';

    // 등록번호 종류를 선택한 경우에만 주소 입력을 표시한다.
    const showAddress = Boolean(dsOwnerInfo.DEBTOR_GB);

    // 외국인등록번호 선택 시 최종확인 단계의 첨부서류를 안내한다.
    const showForeignerGuide = dsOwnerInfo.DEBTOR_GB === 'F';
	
	// 대표소유자 주소와 동일한 경우 체크 
	// 대표소유자 주소와 동일한 경우 체크
	const handleSameAddress = (e) => {

	    const checked = e.target.checked;

	    setDsOwnerInfo(prev => ({
	        ...prev,
	        DEBTOR_ADDR: checked ? dsNewCar.BASE_ADDRESS : '',
	        DEBTOR_ADDR_DT: checked ? dsNewCar.BASE_ADDRESS_DT : '',
	        DEBTOR_ROAD_CD: checked ? dsNewCar.BASE_POST_NO : '',
	    }));
	};
	
    return (
    	<>
			{/* 공동소유자 비율 */}
			<div className="wa-form-row">
			    <label className="wa-form-label">
			        공동소유자 비율
			    </label>
	
			    <div className="wa-form-control">
			        <div className="wa-inline-group">

						<div className="wa-ratio-input">
				            <input
				                className="wa-input"
				                autoComplete="off"
				                data-type="owner"
				                name="DEBTOR_RATIO"
				                value={dsOwnerInfo.DEBTOR_RATIO ?? ''}
								onChange={(e) => {
								    handleChange(e);
								}}
				                placeholder="공동"
				            />
							<span>공동소유자 비율</span>
						</div>
			            <span>%</span>

						<div className="wa-ratio-input">
						    <input
						        className="wa-input"
						        autoComplete="off"
								name="RATIO_NO"
				                data-type="newcar"
				                value={dsNewCar.RATIO_NO ?? ''}
				                onChange={handleChange}
						        readOnly 
						    />
						    <span>대표소유자 비율</span>
						</div>
			            <span>%</span>
	
			        </div>
			    </div>
			</div>
			
			{/* 공동소유자 성명 */}
			<div className="wa-form-row">
			    <label className="wa-form-label">
			        공동소유자 성명
			    </label>
	
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
			
			{/* 공동소유자 등록번호 */}
			<div className="wa-form-row">
			    <label className="wa-form-label">
			        공동소유자 등록번호
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
			                {/*<option value="B">법인등록번호</option>*/}
			            </select>

						<SplitInput
						    value={dsOwnerInfo.DEBTOR_REG_NO}
						    lengths={[6, 7]}
							maskLast={['R', 'F'].includes(dsOwnerInfo.DEBTOR_GB)}
						    onChange={value =>
						        setDsOwnerInfo(prev => ({
						            ...prev,
						            DEBTOR_REG_NO: value
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
			
			
			{/* 공동소유자 주소
			{showAddress && (
				<AddressSearch
					data={dsOwnerInfo}
					dataType="owner"
				    label='공동소유자 주소'
				    placeholder='건물, 지번 또는 도로명 검색'
				    type="DEBTOR_ADDR"
				    detailName="DEBTOR_ADDR_DT"
					postName="DEBTOR_ROAD_CD"
				    dsNewCar={dsOwnerInfo}
				    handleChange={handleChange}
				    onSelect={onSelect}
				    onClear={onClear}
					
					showSameCheckbox
					onSameChange={handleSameAddress}
					sameLabel='대표소유자 주소'
				/>
			)}
			*/}
			
		</>
	)
};

export default JointOwner;
