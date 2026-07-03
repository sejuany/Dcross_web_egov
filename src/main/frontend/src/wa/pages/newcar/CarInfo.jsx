import React from 'react';
import { CarFront, Leaf } from 'lucide-react';

const CarInfo = () => {

    return (
        <>
		
			<div className="simple-content">
				{/* 차량명 */}
				<div className="wa-form-row">
				    <label className="wa-form-label">차량명</label>
	
				    <div className="wa-form-control">
				        <div className="wa-inline-group">
				            <input
				                className="wa-input wa-flex"
				                placeholder="차량명을 입력하세요"
				            />
	
				            <input
				                className="wa-input"
				                style={{ width: '140px' }}
				                placeholder=""
				            />
				        </div>
				    </div>
				</div>
				
				{/* 저공해 차량 확인 */}
				<button
				    type="button"
				    className="wa-check-btn"
				>
				    <Leaf size={18} />
				    저공해 차량 확인
				</button>
				
				<hr className="wa-divider" />
				
				{/* 다목적 차량 */}
				<button
				    type="button"
				    className="wa-sub-btn"
				>
				    <CarFront size={18} />
				    다목적 차량일 시 클릭
				</button>
				
				<hr className="wa-divider" />
				
				
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
				            >
				                번호 선택
				            </button>
				        </div>
				    </div>
				</div>
		    </div>
				
        </>
    );

};

export default CarInfo;
