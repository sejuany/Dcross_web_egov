import React, {useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { gf } from '../../../utils/utils'; // 공통 유틸 함수

import axios from 'axios';

import NumberPlateModal from '../common/WaNumPlateSelectModal'; // 번호판 모달
import WaRadioGroup from '../common/WaRadioGroup'; // 번호판 모달

const CarInfo = ({
    dsService,
    dsNewCar,
    setDsNewCar,
    dsCarNoDetach,
    dsUserInfo,
    handleChange,
    saveProcess
}) => {
	// 번호선택 모달창
	const [isNumplateModalOpen, setIsNumplateModalOpen] = useState(false);
	// 법인 번호판 (등록구분 : 법인, 8,000만원 이상)
	const isCorpNumplate =
	    dsNewCar.REG_GB === 'B' && Number(dsNewCar.BUY_AMT) > 80000000;
	// 하이브리드 차량 여부
	const isHybrid =
	    ['l', 'm', 'n', 'o', 'p'].includes(dsNewCar.FUEL_CD);
	
	
	// 번호선택 버튼 눌렀을 때 체크
	const handleOpenModal = async () => {
		
		console.log("SERVICE_ID : " + dsService.SERVICE_ID);
		
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
				
				{/* 하이브리드 번호판 */}
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
				        <select className="wa-select">
				            <option>스페이스 서울</option>
				        </select>
				    </div>
				</div>
				
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
