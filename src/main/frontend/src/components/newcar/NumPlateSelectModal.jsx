
import React, { useState, useEffect, useRef } from 'react';
import './NumPlateSelectModal.css';
import axios from 'axios';
import { gf } from '../../utils/utils'; // 공통 유틸 함수

const NumberPlateModal = ({ 
	isOpen, onClose, carIdNo, taskCd, onSelect,
	dsService, dsNewCar, dsCarNoDetach, dsUserInfo
 }) => {
	
    const [carType, setCarType] = useState('SEDAN');
    const [condition, setCondition] = useState('NOT');
	const [keyword, setKeyword] = useState('');
	const [list, setList] = useState([]);
	const [selected, setSelected] = useState('');
	const [tel, setTel] = useState('');
	const preCarNoRef = useRef(''); // ref 내부 기억용
	
	// 모달 열릴 때 초기 조회
	useEffect(() => {
		if (isOpen) fetchList();
	}, [isOpen])
	
	// 선택 가능한 번호판 조회
	const fetchList = async() => {
		

		let assignCd =
		    `${dsUserInfo.COMPANY_ID}${dsUserInfo.BRANCH_ID}`;
			
		console.log("assignCd : " + assignCd);
		
		const dsWhere = {
			SERVICE_ID: dsService.SERVICE_ID,
			PRE_CAR_NO: preCarNoRef.current,
			CAR_KD: carKdNumChange(carType),
			NUM_KIND: dsNewCar.NUMPLATE_GB,
			CARID_NO: dsNewCar.CARID_NO,
			LIMIT: '10',
			GOVT_ID: dsService.GOVT_ID,
			CONDITION: condition,
			WANT_CAR_NO: keyword,
			ASSIGN_CD: assignCd,
			TASK_CD: taskCd,
			HOLE_YN: dsCarNoDetach.HOLE_YN,
			SEAL_YN: dsCarNoDetach.SEAL_YN
		};
		
		const res = await axios.post('/api/newcar/numplateList', dsWhere);
		
		console.log(res.data);
		console.log(typeof res.data);
		
		// 차량번호
		const lData = (res.data || []).filter(
		    no => String(no).toLowerCase() !== 'null'
		);
		
		// 세팅
		setList(lData);
		// 조회된 차량번호
		preCarNoRef.current = lData.join(',');
	};
	
	// 미사용 번호판 상태복구
	const releaseNumplate = async ()=> {
		
		if (!preCarNoRef.current) {
		    return;
		}

		const dsWhere = {
			SERVICE_ID: dsService.SERVICE_ID,
			PRE_CAR_NO: preCarNoRef.current,
			CAR_KD: carKdNumChange(carType),
			HOLE_YN: dsCarNoDetach.HOLE_YN,
			LIMIT: '10',
			NUM_KIND: dsNewCar.NUMPLATE_GB,
			GOVT_ID: dsService.GOVT_ID,
			CONDITION: 'DEL'
		};
		
		// 미사용 번호판 상태복구
		await axios.post('/api/newcar/numplateRelease', dsWhere);
		
	};
	

	const resetModal = () => {

	    // 조건 초기화
	    setCarType('SEDAN');
	    setCondition('NOT');

	    // 입력값 초기화
	    setKeyword('');
	    setSelected('');
	    setList([]);

	    // ref 초기화
	    preCarNoRef.current = '';
	};
	
	// 모달창 닫기
	const handleClose = async () => {

	    try {
			// 미사용 번호판 상태복구
	        await releaseNumplate();
	    } catch (err) {
	        console.error('번호판 상태 복구 실패', err);
	    } finally {
			// 조건 초기화
			resetModal();
			
			onClose();
	    }
		
	};
	
	// 번호판 선택
	const handleSelect = async() => {
		if(!selected) {
			alert('번호 선택이 필요합니다.');
			return;
		}
		
		const dsWhere = {
		    SERVICE_ID: dsService.SERVICE_ID,
		    CAR_NO: selected,
		    PRE_CAR_NO: preCarNoRef.current,
		    CAR_KD: carKdNumChange(carType),
		    CARID_NO: carIdNo,
		    GOVT_ID: dsService.GOVT_ID,
		    NUM_KIND: dsNewCar.NUMPLATE_GB,
		    HOLE_YN: dsCarNoDetach.HOLE_YN,
		    SEAL_YN: dsCarNoDetach.SEAL_YN,
			CONDITION: 'DEL',
			LIMIT: '10'
		};
		
		let bTrue = false;
		const selectedCarNo = selected;
		
		try {
			
			// 기존 번호판 해제
			await releaseNumplate();

			// 번호판 신청처리
			const res = await axios.post('/api/newcar/numplateSelect', dsWhere);
			
			if (!res.data.success) {
			    alert(res.data.message);
			    return;
			}
			
			alert('선택되었습니다.');
			bTrue = true;
			
		} catch(e) {
			
			console.error(e);
			
			alert('[번호선택] 처리 중 오류가 발생했습니다.');
			
		} finally {

			resetModal();

			onSelect(bTrue, selectedCarNo);

			onClose();
		}
	};
	
	const handleSendSMS = async () => {
	    if (!tel || tel.length < 10) {
	        alert('핸드폰 번호를 확인해주세요.');
	        return;
	    } 
		const ok = await gf.confirm('차량번호를 전송하시겠습니까?');
		if (!ok) {
		    return;
		}
		
		try {

			await axios.post('/api/newcar/numplateSms', {
			    PAY_HP_NO: tel.replaceAll('-', ''),
				MSG_TYPE: '3',
			    TEXT: `선택 가능한 차량번호 : ${preCarNoRef.current}`
			});
			
			alert('전송 완료');
			
		}
		
		catch(e) {

			console.error(e);

			alert('[차량번호 전송] 처리 중 오류가 발생했습니다.');

		}

	};
	
	const carKdNumChange = (str) => {
	    switch (str) {
	        case 'VAN': 
				return '80';
	        case 'TRUCK': 
				return '97';
	        case 'SPCAR': 
				return '99';
	        default: 
				return '70';
	    }
	};

	
	if(!isOpen) return null; 

	return (
	    <div className="modal-overlay">
	        <div className="modal-container NumPlateSelect">

	            {/* Header */}
	            <div className="modal-header numplate-header">
					<div>
					    <h2>번호판 선택</h2>
					    <p>차량번호를 조회하고 원하는 번호를 선택하세요.</p>
					</div>

	                <button
	                    type="button"
	                    className="modal-close-btn"
	                    onClick={handleClose}
	                >
	                    ✕
	                </button>
	            </div>

	            {/* Body */}
	            <div className="modal-body numplate-body">

	                {/* 검색영역 */}
	                <div className="numplate-search-wrap">

	                    <div className="search-row">
	                        <label>차종</label>

	                        <select
	                            value={carType}
	                            onChange={e => setCarType(e.target.value)}
	                        >
	                            <option value="SEDAN">승용</option>
	                            <option value="VAN">승합</option>
	                        </select>
	                    </div>

	                    <div className="search-row search-row-input">
	                        <label>번호</label>

	                        <div className="search-input-group">
	                            <input
	                                value={keyword}
	                                placeholder="번호를 입력하세요."
	                                onChange={e => setKeyword(e.target.value)}
	                            />

	                            <button
	                                type="button"
	                                className="btn-search"
	                                onClick={fetchList}
	                            >
	                                조회
	                            </button>
	                        </div>
	                    </div>
	                </div>

	                {/* 목록 */}
	                <div className="numplate-list-wrap">

	                    <div className="list-header">
	                        <span>번호 목록</span>
	                        <span>총 {list.length}건</span>
	                    </div>

	                    <div className="grid-box">
	                        <table>
	                            <tbody>
	                                {list.length > 0 ? (
	                                    list.map((no) => (
	                                        <tr
	                                            key={no}
	                                            onClick={() => setSelected(no)}
	                                            className={selected === no ? 'selected' : ''}
	                                        >
	                                            <td className="radio-col">
	                                                <input
	                                                    type="radio"
	                                                    checked={selected === no}
	                                                    readOnly
	                                                />
	                                            </td>

	                                            <td className="number-col">
	                                                {no}
	                                            </td>
	                                        </tr>
	                                    ))
	                                ) : (
	                                    <tr>
	                                        <td className="empty-row">
	                                            조회 결과가 없습니다.
	                                        </td>
	                                    </tr>
	                                )}
	                            </tbody>
	                        </table>
	                    </div>
	                </div>

	                {/* 문자전송 */}
	                <div className="sms-row">
	                    <input
	                        value={tel}
	                        placeholder="휴대폰번호 입력"
	                        onChange={e => setTel(e.target.value)}
	                    />

	                    <button
	                        type="button"
	                        className="btn-send"
	                        onClick={handleSendSMS}
	                    >
	                        전송
	                    </button>
	                </div>
	            </div>

	            {/* Footer */}
	            <div className="modal-footer numplate-footer">
	                <button
	                    type="button"
	                    className="btn-close"
	                    onClick={handleClose}
	                >
	                    닫기
	                </button>

	                <button
	                    type="button"
	                    className="btn-select"
	                    onClick={handleSelect}
	                >
	                    선택
	                </button>
	            </div>
	        </div>
	    </div>
	);
};

export default NumberPlateModal;
