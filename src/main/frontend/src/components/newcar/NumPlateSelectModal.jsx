
import React, { useState, useEffect } from 'react';
import './NumPlateSelectModal.css';
import axios from 'axios';


const NumberPlateModal = ({ isOpen, onClose, serviceId, carIdNo, taskCd, onSelect }) => {
    const [carType, setCarType] = useState('SEDAN');
    const [condition, setCondition] = useState('NOT');
	const [keyword, setKeyword] = useState('');
	const [list, setList] = useState('');
	const [selected, setSelected] = useState('');
	const [tel, setTel] = useState('');
	
	// 모달 열릴 때 초기 조회
	useEffect(() => {
		if (isOpen) fetchList();
	}, [isOpen])
	
	const fetchList = async() => {
		const res = await axios.post('/api/newcar/numplateList', {
			serviceId,
			carIdNo,
			carKd: carKdNumChange(carType),
			condition,
			keyword,
			taskCd
		});
		setList(res.data.list || []);
	};
	
	const handleSelect = async() => {
		if(!selected) {
			alert('번호 선택이 필요합니다.');
			return;
		}
		
		await axios.post('/api/newcar/numplateSelect', {
			serviceId,
			carNo: selected,
			carIdNo,
			taskCd
		});
		
		onSelect(selected);
		onClose();
	};
	
	const handleSendSMS = async () => {
	    if (!tel || tel.length < 10) {
	        alert('번호 확인');
	        return;
	    }

	    await axios.post('/api/newcar/numplateSms', {
	        tel,
	        text: `선택 가능한 차량번호 : ${list.join(',')}`
	    });

	    alert('전송 완료');
	};
	
	const carKdNumChange = (str) => {
	    switch (str) {
	        case 'VAN': return '80';
	        case 'TRUCK': return '97';
	        case 'SPCAR': return '99';
	        default: return '70';
	    }
	};

	
	if(!isOpen) return null; 

    return (
		<div className="modal-overlay">
		    <div className="modal-container NumPlateSelect">

                {/* Header */}
				<div className="modal-header">
                    <span>번호판 선택</span>
                    <button onClick={onClose}>✕</button>
                </div>

                {/* Search Area */}
                <div className="modal-body">

					<div className="search-row">
					    <label>차종</label>
					    <select value={carType} onChange={e => setCarType(e.target.value)}>
					        <option value="SEDAN">승용</option>
					        <option value="VAN">승합</option>
					    </select>
					</div>

					<div className="search-row">
					    <label>조건</label>
					    <select value={condition} onChange={e => setCondition(e.target.value)}>
					        <option value="NOT">전체</option>
					        <option value="ONLY">조건</option>
					    </select>
					</div>

					<div className="search-row">
					    <label>번호</label>
					    <input value={keyword} onChange={e => setKeyword(e.target.value)} />
					</div>
					
					<button onClick={fetchList}>조회</button>
					
					{/*------ 조회결과 없음 ------*/}
					<div className="grid-box">
					    <table>
					        <tbody>
					            {list.length > 0 ? list.map((no) => (
					                <tr key={no} onClick={() => setSelected(no)}
					                    className={selected === no ? 'selected' : ''}>
					                    <td>
					                        <input type="radio" checked={selected === no} readOnly />
					                    </td>
					                    <td>{no}</td>
					                </tr>
					            )) : (
					                <tr>
					                    <td>조회 결과 없음</td>
					                </tr>
					            )}
					        </tbody>
					    </table>
					</div>
					
					<div className="sms-row">
					    <input value={tel} onChange={e => setTel(e.target.value)} />
					    <button onClick={handleSendSMS}>전송</button>
					</div>
					
                </div>

                {/* Footer */}
				<div className="modal-footer">
				    <button onClick={onClose}>닫기</button>
				    <button onClick={handleSelect}>선택</button>
				</div>
            </div>
        </div>
    );
};

export default NumberPlateModal;