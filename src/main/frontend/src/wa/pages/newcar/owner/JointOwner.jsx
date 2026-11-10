import { useRef } from 'react';

import { UserRound } from 'lucide-react';

import AddressSearch from '../../common/AddressSearch';

const JointOwner = ({
	dsNewCar,
	dsOwnerInfo,
	dsOwnerInfo1,
	isMultiOwner,
	setDsNewCar,
	setDsOwnerInfo,
	setDsOwnerInfo1,
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
			        <div className={`wa-inline-group wa-joint-ratio-group${isMultiOwner ? ' wa-joint-ratios-three' : ''}`}>

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
				                placeholder={isMultiOwner ? '공동1' : '공동'}
				            />
							<span>{isMultiOwner ? '공동소유자1 비율' : '공동소유자 비율'}</span>
						</div>
			            <span>%</span>

			            {isMultiOwner && (
			                <>
			                    <div className="wa-ratio-input">
			                        <input
			                            className="wa-input"
			                            autoComplete="off"
			                            data-type="owner1"
			                            name="DEBTOR_RATIO"
			                            value={dsOwnerInfo1.DEBTOR_RATIO ?? ''}
			                            onChange={handleChange}
			                            placeholder="공동2"
			                        />
			                        <span>공동소유자2 비율</span>
			                    </div>
			                    <span>%</span>
			                </>
			            )}

						<div className="wa-ratio-input">
						    <input
						        className="wa-input"
						        autoComplete="off"
								name="RATIO_NO"
				                data-type="newcar"
				                value={dsNewCar.RATIO_NO ?? ''}
				                onChange={handleChange}
				                placeholder="100"
						        readOnly={!isMultiOwner}
						    />
						    <span>대표소유자 비율</span>
						</div>
			            <span>%</span>
	
			        </div>
			    </div>
			</div>
			
			<hr className="wa-joint-owner-divider" />
			<div className="wa-joint-owner-card">
			    <header className="wa-joint-owner-card-header">
			        <h3 className="wa-joint-owner-title">
			            <UserRound size={18} className="wa-joint-owner-icon" aria-hidden="true" />
			            {isMultiOwner ? '공동소유자1 정보' : '공동소유자 정보'}
			        </h3>
			        <span className="wa-joint-owner-number" aria-hidden="true">01</span>
			    </header>
			<div className="wa-joint-owner-card-body">

			{/* 공동소유자 성명 */}
			<div className="wa-form-row">
			    <label className="wa-form-label">
			        {isMultiOwner ? '공동소유자1 성명' : '공동소유자 성명'}
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
			        {isMultiOwner ? '공동소유자1 등록번호' : '공동소유자 등록번호'}
			    </label>

			    <div className="wa-form-control">
			        <div className="wa-inline-group wa-joint-registration-group">

			            <select
			                className="wa-select"
			                name="DEBTOR_GB"
			                data-type="owner"
			                value={dsOwnerInfo.DEBTOR_GB ?? ''}
			                onChange={handleChange}
			            >
			                <option value="">선택</option>
			                <option value="R">주민등록번호</option>
			                <option value="B">법인등록번호</option>
			                <option value="F">외국인등록번호</option>
			            </select>

						<SplitInput
						    name="DEBTOR_REG_NO"
						    data-type="owner"
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
							    placeholders={['000', '00', '00000']}
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
			        {isMultiOwner ? '공동소유자1 휴대폰번호' : '공동소유자 휴대폰번호'}
			    </label>
			    <div className="wa-form-control">
			        <div className="wa-inline-group">
						<SplitInput
						    name="DEBTOR_TEL_NO"
						    data-type="owner"
						    value={dsOwnerInfo.DEBTOR_TEL_NO}
						    lengths={[3, 4, 4]}
							fixedValues={['010']}
						    placeholders={['010', '0000', '0000']}
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
			
			
			{/* 공동소유자 주소 */}
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
			</div>
			</div>

			{isMultiOwner && (
			    <div className="wa-joint-owner-card wa-joint-owner-card-secondary">
			        <header className="wa-joint-owner-card-header">
			        <h3 className="wa-joint-owner-title">
			            <UserRound size={18} className="wa-joint-owner-icon" aria-hidden="true" />
			            공동소유자2 정보
			        </h3>
			            <span className="wa-joint-owner-number" aria-hidden="true">02</span>
			        </header>
			        <div className="wa-joint-owner-card-body">

			        <div className="wa-form-row">
			            <label className="wa-form-label">공동소유자2 성명</label>
			            <div className="wa-form-control">
			                <input
			                    className="wa-input"
			                    autoComplete="off"
			                    name="DEBTOR_NM"
			                    data-type="owner1"
			                    value={dsOwnerInfo1.DEBTOR_NM ?? ''}
			                    onChange={handleChange}
			                    placeholder="이름을 입력하세요"
			                />
			            </div>
			        </div>

			        <div className="wa-form-row">
			            <label className="wa-form-label">공동소유자2 등록번호</label>
			            <div className="wa-form-control">
			                <div className="wa-inline-group wa-joint-registration-group">
			                    <select
			                        className="wa-select"
			                        name="DEBTOR_GB"
			                        data-type="owner1"
			                        value={dsOwnerInfo1.DEBTOR_GB ?? ''}
			                        onChange={handleChange}
			                    >
			                        <option value="">선택</option>
			                        <option value="R">주민등록번호</option>
			                        <option value="B">법인등록번호</option>
			                        <option value="F">외국인등록번호</option>
			                    </select>
			                    <SplitInput
			                        name="DEBTOR_REG_NO"
			                        data-type="owner1"
			                        value={dsOwnerInfo1.DEBTOR_REG_NO}
			                        lengths={[6, 7]}
			                        maskLast={['R', 'F'].includes(dsOwnerInfo1.DEBTOR_GB)}
			                        onChange={value =>
			                            setDsOwnerInfo1(prev => ({ ...prev, DEBTOR_REG_NO: value }))
			                        }
			                    />
			                </div>
			                {dsOwnerInfo1.DEBTOR_GB === 'F' && (
			                    <div className="wa-guide-text">
			                        *최종확인 페이지에서 외국인 등록증을 첨부하여 주십시오.
			                    </div>
			                )}
			            </div>
			        </div>

			        {dsOwnerInfo1.DEBTOR_GB === 'B' && (
			            <div className="wa-form-row">
			                <label className="wa-form-label">공동소유자2 사업자등록번호</label>
			                <div className="wa-form-control">
			                    <div className="wa-inline-group">
			                        <SplitInput
			                            name="DEBTOR_BIZ_NO"
			                            data-type="owner1"
			                            value={dsOwnerInfo1.DEBTOR_BIZ_NO}
			                            lengths={[3, 2, 5]}
			                            placeholders={['000', '00', '00000']}
			                            onChange={value =>
			                                setDsOwnerInfo1(prev => ({ ...prev, DEBTOR_BIZ_NO: value }))
			                            }
			                        />
			                    </div>
			                </div>
			            </div>
			        )}

			        <div className="wa-form-row">
			            <label className="wa-form-label">공동소유자2 휴대폰번호</label>
			            <div className="wa-form-control">
			                <div className="wa-inline-group">
			                    <SplitInput
			                        name="DEBTOR_TEL_NO"
			                        data-type="owner1"
			                        value={dsOwnerInfo1.DEBTOR_TEL_NO}
			                        lengths={[3, 4, 4]}
			                        fixedValues={['010']}
			                        placeholders={['010', '0000', '0000']}
			                        onChange={value =>
			                            setDsOwnerInfo1(prev => ({ ...prev, DEBTOR_TEL_NO: value }))
			                        }
			                    />
			                </div>
			            </div>
			        </div>
			        </div>
			    </div>
			)}
			
			
		</>
	)
};

export default JointOwner;
