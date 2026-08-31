import React, { useState, useEffect, useRef } from 'react';
import { CircleCheck } from 'lucide-react';
import { gf } from '../../../utils/utils'; // 공통 유틸 함수

import axios from 'axios';

import NumberPlateModal from '../common/WaNumPlateSelectModal'; // 번호판 모달
import CommonSelect from '../common/CommonSelect';
import WaRadioGroup from '../common/WaRadioGroup'; // 번호판 모달
import AddressSearch from '../common/AddressSearch'; // 주소 입력 

const CarInfo = ({
    dsService,
    dsNewCar,
    setDsNewCar,
    dsCarNoDetach,
	setDsCarNoDetach,
	codes,
    dsUserInfo,
    handleChange,
    saveProcess,
	dsDLVGB,
	address,
	dsBranchList
}) => {
	
	// 번호선택 모달창
	const [isNumplateModalOpen, setIsNumplateModalOpen] = useState(false);
	// 번호판 배송 지점 목록
	const [deliveryList, setDeliveryList] = useState([]);
	// 법인 번호판 (등록구분 : 법인, 8,000만원 이상)
	const isCorpNumplate =
	    dsNewCar.REG_GB === 'B' && Number(dsNewCar.BUY_AMT) >= 80000000;
	// 하이브리드 차량 여부
	const isHybrid =
	    ['l', 'm', 'n', 'o', 'p'].includes(dsNewCar.FUEL_CD);
	// 배송지 직접입력 여부
	//const isDirectDelivery = dsCarNoDetach.DELIVERY_GB === 'INPUT';
	
	const assignCdRef = useRef('');
	const [numplateDisabled, setNumplateDisabled] = useState(false); 

	useEffect(() => {
		if (dsUserInfo.MEMBER_GB !== 'SU' || !dsService.SERVICE_ID
				|| !dsCarNoDetach.NUMPLATE_MSG_TOKEN || dsNewCar.REQ_CAR_NO) return;
		let stopped = false;
		const poll = async () => {
			try {
				const { data } = await axios.get('/api/newcar/numplate-selection/status', {
					params: { serviceId: dsService.SERVICE_ID }
				});
				if (stopped) return;
				const result = data.result;
				if (result.state === 'SELECTED') {
					setDsNewCar(prev => ({ ...prev, REQ_CAR_NO: result.REQ_CAR_NO }));
					setIsNumplateModalOpen(false);
				} else if (result.state === 'EXPIRED' || result.state === 'NONE') {
					setDsCarNoDetach(prev => ({ ...prev, CONFIRM_NO: '', NUMPLATE_MSG_TOKEN: '' }));
				}
			} catch (e) {
				console.error('번호판 선택 상태 조회 실패', e);
			}
		};
		poll();
		const timer = setInterval(poll, 2000);
		return () => { stopped = true; clearInterval(timer); };
	}, [dsCarNoDetach.NUMPLATE_MSG_TOKEN, dsNewCar.REQ_CAR_NO, dsService.SERVICE_ID,
		dsUserInfo.MEMBER_GB, setDsCarNoDetach, setDsNewCar]);
	
	// ASSIGN_CD 세팅
	useEffect(() => {

	    // 사용자정보 / 지점목록 조회가 끝나기 전이면 대기
	    if (!dsUserInfo?.BRANCH_ID || !dsBranchList?.length || dsUserInfo.MEMBER_GB !== 'SU') {
	        return;
	    }

	    const initAssignCd = async () => {

	        const isBranchInfo = dsBranchList.find(
	            e => String(dsUserInfo.BRANCH_ID) === String(e.BRANCH_ID)
	        );

	        // 현재 사용자의 지점정보가 없는 경우
	        if (!isBranchInfo) {
	            return;
	        }

	        // 배송지 설정이 안 되어 있는 경우
	        if (!isBranchInfo.ASSIGN_CD) {

	            setNumplateDisabled(true);

	            await gf.alert(
	                '배송지 설정을 하셔야 번호판 선택을 할 수 있습니다. 다코스에 문의 바랍니다.'
	            );

	            return;
	        }

	        assignCdRef.current = isBranchInfo.ASSIGN_CD;

	        setNumplateDisabled(false);
	    };

	    initAssignCd();

	}, [dsBranchList, dsUserInfo.BRANCH_ID]);
	
	// 번호판 매니저 및 배송지 설정
	const setDeliveryInfo = async () => {
		console.log("setDeliveryInfo");
		const isBranchInfo = dsBranchList.find(
		    e => String(dsUserInfo.BRANCH_ID) === String(e.BRANCH_ID)
		);
		
		// 번호판 매니저 조회
		// - ASSIGN_CD 기준으로 담당 매니저의 회사/매니저번호 정보 추출
		// - COMPANY_ID : ASSIGN_CD 앞 5자리
		// - BRANCH_ID  : ASSIGN_CD 뒤 2자리
		// ex) DL03101 → COMPANY_ID: DL031, BRANCH_ID: 01
		const assignCd = isBranchInfo.ASSIGN_CD || '';
		const dlCompanyId = assignCd.substring(0, 5);
		const dlBranchId = assignCd.slice(-2);

		console.log("dlCompanyId : " + dlCompanyId + " / dlBranchId : " + dlBranchId);

		const result = await axios.post('/api/common/query', {
		    GUBUN: 'SELECT',
		    QUERY_ID: 'getNumplateAssignList',
			COMPANY_ID: dlCompanyId,
			BRANCH_ID: dlBranchId
		});

		const managerInfo = result.data.data;
		
		const newDsCarNoDetach = {
		    ...dsCarNoDetach,
			// 번호판 택배 발송지
		    DELIVERY_ADDR: managerInfo.ADDRESS || '',
		    DELIVERY_ADDR_DT: managerInfo.ADDRESS_DT || '',
		    DELIVERY_POST_NO: managerInfo.POST_NO || '',
			// 매니저 정보
		    INSTALL_NM: managerInfo.TEL_NO || '',
		    INSTALL_TEL_NO: managerInfo.PHONE_NO || '',

			// 마지막 번호판 배송지
		    LAST_DELIVERY_ADDR:
		        (isBranchInfo.ADDRESS || '') +
		        (isBranchInfo.ADDRESS_DT || ''),
				
			// 수령인(딜러사 회원사명)
		    RECEIVE_NM: isBranchInfo.BRANCH_NM || '',
			// 수령인 번호(지점 대표번호)
		    RECEIVE_TEL_NO: isBranchInfo.TEL_NO || ''
		};
		
		setDsCarNoDetach(newDsCarNoDetach);	
		
		return newDsCarNoDetach;
	}
	
	// 번호선택 버튼 눌렀을 때 체크
	const handleOpenModal = async () => {
		
		if(dsUserInfo.MEMBER_GB !== 'SU') {
			gf.alert('번호판은 SP 계정으로 선택 하실 수 있습니다.');
		    return;
		}
		
		// 차대번호 체크
		if (!dsNewCar.CARID_NO || dsNewCar.CARID_NO.length !== 17) {
		    gf.alert('차대번호 확인 필요');
		    return;
		}
		
	    // SERVICE_ID 체크
	    if (!dsService.SERVICE_ID) {
	        const ok = await gf.confirm('저장 후 사용 가능합니다. 저장하시겠습니까?');
	        if (ok) {
				await saveProcess();
	        }			
	        return;
	    }
		
		console.log(dsCarNoDetach.DELIVERY_GB);
		if(!dsCarNoDetach.DELIVERY_GB) {
			gf.alert('번호판 배송지를 먼저 선택한 후 번호를 선택해주세요.');
			return;
		}
		
	    // 3. 기존 번호 존재 여부
	    let reqCarNo = dsNewCar.REQ_CAR_NO;

	    if (reqCarNo) {
	        const confirmChange = await gf.confirm(`이미 차량번호 ${reqCarNo} 선택됨. 변경하시겠습니까?`);

	        if (!confirmChange) return;

	        // 기존 번호 해제 API 호출
	        await axios.post('/api/newcar/updateNumplateUseYn', {
	            serviceId: dsService.SERVICE_ID,
	            carNo: reqCarNo
	        });

	        // 상태 초기화
	        setDsNewCar(prev => ({ ...prev, REQ_CAR_NO: '' }));
	    }

	    // 4. 모달 오픈
	    setIsNumplateModalOpen(true);
	};
	
    return (
        <>
			<div className="simple-content">
				{/* 대표소유자 */}
				<div className="wa-form-row">
				    <div className="wa-form-label-wrap">
				        <label className="wa-form-label">차량명</label>
				    </div>
				    <div className="wa-form-control">
				        <input
				            className="wa-input"
				            autoComplete="off"
				            name="CAR_NM"
							data-type="newcar"
				            value={dsNewCar.CAR_NM ?? ''}
				            onChange={handleChange}
				            placeholder="차량명을 입력하세요"
				        />
				    </div>
				</div>
				
				{/* 공급가액 */}
				<div className="wa-form-row">
				    <div className="wa-form-label-wrap">
				        <label className="wa-form-label">공급가액</label>
				    </div>
				    <div className="wa-form-control">
				        <input
				            className="wa-input"
				            autoComplete="off"
				            name="BUY_AMT"
				            data-type="newcar"
				            value={Number(dsNewCar.BUY_AMT || 0).toLocaleString()}
				            onChange={handleChange}
				            placeholder="공급가액을 입력하세요"
				        />
				    </div>
				</div>
				
				<hr className="wa-divider" />
	
				{/* 법인 번호판 */}
				{isCorpNumplate &&(
					<div className="wa-form-row">
					    <label className="wa-form-label">
					        번호판 종류
					    </label>

						<WaRadioGroup
						    name="NUMPLATE_GB"
						    value={dsNewCar.NUMPLATE_GB}
						    dataType="newcar"
						    handleChange={handleChange}
						    options={[
						        { label: '법인 필름', value: 'FG' },
						        { label: '법인 페인트', value: '2G' }
						    ]}
						/>
					</div>
				)}
				
				{/* 하이브리드 번호판(폴스타 제외) */}
				{isHybrid &&(
					<div className="wa-form-row">
					    <label className="wa-form-label">
					        번호판 종류
					    </label>

						<WaRadioGroup
						    name="NUMPLATE_GB"
						    value={dsNewCar.NUMPLATE_GB}
						    dataType="newcar"
						    handleChange={handleChange}
						    options={[
						        { label: '전기', value: '7' },
						        { label: '필름', value: 'F' },
						        { label: '페인트', value: '2' }
						    ]}
						/>
					</div>
				)}
				
				{/* 번호판 배송지
				<div className="wa-form-row">
				    <label className="wa-form-label">
				        번호판 배송지
				    </label>
				    <div className="wa-form-control">
						<CommonSelect
							className="wa-select"
							groupId="DLVGB"
							name="DELIVERY_GB"
							value={dsCarNoDetach.DELIVERY_GB ?? ''}
							data-type="detach"
							onChange={handleDeliveryChange}
							options={deliveryList}
						/>
				    </div>
				</div>
				*/}

				{/* 번호 선택 */}
				<div className="wa-form-row">
				    <label className="wa-form-label">
				        번호 선택
				    </label>

				    <div className="wa-form-control">
				        <div className="wa-inline-group">
							<input
							    className="wa-input"
							    autoComplete="off"
							    name="REQ_CAR_NO"
							    value={dsNewCar.REQ_CAR_NO ?? ''}
							    data-type="newcar"
							    onChange={handleChange}
							    style={{ width: '110px' }}
							    readOnly
							/>

				            <button
				                type="button"
				                className="wa-number-btn"
								onClick={handleOpenModal}
								disabled={numplateDisabled}
				            >
								<CircleCheck size={18} /> 
				                번호 선택
				            </button>
				        </div>
				    </div>
				</div>
				
				{/* 번호판 배송지 직접입력 
				{isDirectDelivery && (
				    <>
				        <AddressSearch
				            label="번호판 배송지 주소"
				            placeholder="건물, 지번 또는 도로명 검색"
				            type="DELIVERY_ADDR"
				            detailName="DELIVERY_ADDR_DT"
				            postName="DELIVERY_POST_NO"
							data={dsCarNoDetach}
						    dataType="detach"
						    handleChange={handleChange}
						    onSelect={handleAddressSelect}
						    onClear={handleClearAddress}
				        />
				    </>
				)}
				*/}
		    </div>
			

			{/* 번호선택 모달창 */}
			<NumberPlateModal
				isOpen={isNumplateModalOpen}
				dsService={dsService}
				dsNewCar={dsNewCar}
				dsCarNoDetach={dsCarNoDetach}
				dsUserInfo={dsUserInfo}
				dsBranchList={dsBranchList}
				setDsCarNoDetach={setDsCarNoDetach}
				onClose={() => setIsNumplateModalOpen(false)}
				onSelect={async (isSuccess, carNo) => {

					if (!isSuccess) {
					    return;
					}

					const newDsCarNoDetach = await setDeliveryInfo();

					if (!newDsCarNoDetach) {
					    return;
					}

					const newDsNewCar = {
					    ...dsNewCar,
					    REQ_CAR_NO: carNo
					};

					setDsNewCar(newDsNewCar);
					
					await saveProcess(newDsNewCar,"SAV",null,null,null,true,
						newDsCarNoDetach
					); // 메세지 안 띄울 때 true
						
				}}

			/>
        </>
    );

};

export default CarInfo;
