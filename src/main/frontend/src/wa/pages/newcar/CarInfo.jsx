import React, { useState, useEffect } from 'react';
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
	onSelect,
	onClear
}) => {
	
	// 번호선택 모달창
	const [isNumplateModalOpen, setIsNumplateModalOpen] = useState(false);
	// 법인 번호판 (등록구분 : 법인, 8,000만원 이상)
	const isCorpNumplate =
	    dsNewCar.REG_GB === 'B' && Number(dsNewCar.BUY_AMT) > 80000000;
	// 하이브리드 차량 여부
	const isHybrid =
	    ['l', 'm', 'n', 'o', 'p'].includes(dsNewCar.FUEL_CD);
	// 배송지 직접입력 여부
	const isDirectDelivery = dsCarNoDetach.DELIVERY_GB === 'INPUT';

	// 번호선택 버튼 눌렀을 때 체크
	const handleOpenModal = async () => {
		
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
	
	// 번호판 배송지 변경
	const handleDeliveryChange = (e) => {
		
	    // 기존 공통 처리
	    handleChange(e);
		
	    const deliveryInfo = (codes.DLADD || []).find(
	        item => item.CODE_ID === e.target.value
	    );

		// 직접입력은 자동 세팅하지 않음
		if (e.target.value === 'INPUT') {
		    return;
		}
		
	    const [
	        deliveryAddr = '',
	        deliveryAddrDt = '',
	        receiveNm = '',
	        receiveTelNo = ''
	    ] = (deliveryInfo?.CODE_NM || '').split('/');

		// DETAIL_NM : 우편번호
		const deliveryPostNo = deliveryInfo?.DETAIL_NM || '';
		
	    setDsCarNoDetach(prev => ({
	        ...prev,
	        DELIVERY_ADDR: deliveryAddr,
	        DELIVERY_ADDR_DT: deliveryAddrDt,
	        DELIVERY_POST_NO: deliveryPostNo,
	        RECEIVE_NM: receiveNm,
	        RECEIVE_TEL_NO: receiveTelNo
	    }));
		
	};
	
	// 주소 잘 저장 됐는지 확인 하는 용도 
	useEffect(() => {
	    console.log({
	        DELIVERY_ADDR: dsCarNoDetach.DELIVERY_ADDR,
	        DELIVERY_ADDR_DT: dsCarNoDetach.DELIVERY_ADDR_DT,
	        RECEIVE_NM: dsCarNoDetach.RECEIVE_NM,
	        RECEIVE_TEL_NO: dsCarNoDetach.RECEIVE_TEL_NO,
			DELIVERY_POST_NO: dsCarNoDetach.DELIVERY_POST_NO
	    });
	}, [dsCarNoDetach]);
	
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

				{/* 번호 선택 */}
				<div className="wa-form-row">
				    <label className="wa-form-label">
				        번호 선택
				    </label>

				    <div className="wa-form-control">
				        <div className="wa-inline-group">
							<input
							    className="wa-input"
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
				            >
								<CircleCheck size={18} /> 
				                번호 선택
				            </button>
				        </div>
				    </div>
				</div>
				
				{/* 번호판 배송지 */}
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
							options={dsDLVGB}
						/>
				    </div>
				</div>
				
				{/* 번호판 배송지 직접입력 */}
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
						    onSelect={onSelect}
						    onClear={onClear}
				        />
				    </>
				)}
				
		    </div>
			

			{/* 번호선택 모달창 */}
			<NumberPlateModal
				isOpen={isNumplateModalOpen}
				dsService={dsService}
				dsNewCar={dsNewCar}
				dsCarNoDetach={dsCarNoDetach}
				dsUserInfo={dsUserInfo}
				onClose={() => setIsNumplateModalOpen(false)}
				onSelect={(isSucces, carNo) => {

					console.log('선택된 번호:', carNo);


					if (isSucces) {

						const newDsNewCar = {
							...dsNewCar,
							REQ_CAR_NO: carNo
						};

						setDsNewCar(newDsNewCar);
						saveProcess(newDsNewCar, "NUM_SAV");
					}
				}}

			/>
        </>
    );

};

export default CarInfo;
