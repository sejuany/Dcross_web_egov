import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';

import axios from 'axios';
import { gf } from '../../../utils/utils'; // 공통 유틸 함수
import '../../styles/WaNewcarRequest.css';

const splitPhone = (value) => {
    const onlyNumber = String(value || '').replace(/\D/g, '');

    return {
        hp1: onlyNumber.substring(0, 3),
        hp2: onlyNumber.substring(3, 7),
        hp3: onlyNumber.substring(7, 11),
    };
};

const WaSendSmsModal = ({
	dsService,
    dsNewCar,
	dsOwnerInfo,
	dsCarNoDetach,
	setDsCarNoDetach,
	dsUserInfo,
	saveProcess,
    open,
    onClose,
}) => {
	const hp1Ref = useRef(null);
	const hp2Ref = useRef(null);
	const hp3Ref = useRef(null);

	const recipientPhone =
		dsNewCar?.NTAX_TRGET_CD !== '00' && dsNewCar?.NTAX_WHO === 'UNION'
			? dsOwnerInfo?.DEBTOR_TEL_NO
			: dsNewCar?.MPHONE_NO;

    const initialPhone = useMemo(() => splitPhone(recipientPhone), [recipientPhone]);

    const [phone, setPhone] = useState(initialPhone);

	useEffect(() => {
		if (open) {
			setPhone(initialPhone);
		}
	}, [open, initialPhone]);

    if (!open) {
        return null;
    }

	const handleChange = (name, value) => {
	    const onlyNumber = value.replace(/\D/g, '');

	    setPhone(prev => ({
	        ...prev,
	        [name]: onlyNumber,
	    }));
		
		// 각 칸에 숫자 전부 입력 했을 때 다음 칸으로 이동하도록 
	    if (name === 'hp1' && onlyNumber.length === 3) {
	        hp2Ref.current?.focus();
	    }

	    if (name === 'hp2' && onlyNumber.length === 4) {
	        hp3Ref.current?.focus();
	    }
	};

    const handleSend = async () => {
        const fullPhone = `${phone.hp1}${phone.hp2}${phone.hp3}`;

        if (fullPhone.length < 10) {
            alert('휴대폰번호를 확인해주세요.');
            return;
        }
		
		const ok = await gf.confirm('문자를 전송하시겠습니까?');
		
		if (!ok) {
		    return;
		}
		
		let token = dsCarNoDetach.TOKEN;
		
		// 토큰이 없는 경우 생성 후 저장
		if (!dsCarNoDetach.TOKEN) {
			
			token = await setToken();
			
			const newDsCarNoDetach = {
			    ...dsCarNoDetach,
			    TOKEN: token
			};

			setDsCarNoDetach(newDsCarNoDetach);

			await saveProcess(null, "SAV", null, null, null, true, newDsCarNoDetach);
		}
		
		const url = `${window.location.origin}/customer/CustomerSign?t=${token}`;
		/*
		const sText = '안녕하세요. 폴스타코리아 주문번호 ' + dsService.LINK_ID + 
		' 차량의 추가 제출서류를 준비하셔서 아래의 URL로 접속하신 후 업로드 바랍니다.\n' +
		'※ 업로드 완료 후 담당 스페셜리스트에게 연락 바랍니다.\n' +
		'담당 스페셜리스트 : ' + formatPhoneNumber(dsUserInfo.MPHONE_NO) + '\r\n' +
		url;
		 */
		const sText = '안녕하세요. 폴스타코리아 차량의 신규등록을 위해 추가 제출서류를 준비하셔서 아래의 URL로 접속하신 후 업로드 바랍니다. \r\n\r\n' +
		 			'주문번호 ' + dsService.LINK_ID + '\r\n차대번호 : ' + dsNewCar.CARID_NO + '\r\n\r\n' + 				
				'※ 업로드 완료 후 담당 스페셜리스트에게 연락 바랍니다.\n' +
				'담당 스페셜리스트 : ' + formatPhoneNumber(dsUserInfo.MPHONE_NO) + '\r\n' +
				url;
		console.log(sText);
		
		try {
			
			// 1. 문자 발송
			await axios.post('/api/newcar/numplateSms', {
			    PAY_HP_NO: fullPhone,
				MSG_TYPE: '3',
			    TEXT: sText,
				SUBJECT: '등록 차량 서류 업로드'
			});
			
			// 2. 전자서명 이력 생성
			await axios.post('/api/common/insertDsign', {
			    SERVICE_ID: dsService.SERVICE_ID,
				CAR_NO: dsNewCar.REQ_CAR_NO,
				DSIGN_GB: 'WSIGN',
				DSIGN_ST: 'REQ',
				INS_USER: dsUserInfo.MEMBER_ID
			});
			
			gf.alert('문자 전송 완료', '파일 업로드 및 서명');
			
			onClose(false);
		}

		catch(e) {

			console.error(e);

			alert('[문자 전송] 처리 중 오류가 발생했습니다.');

		}
    };
	
	// 토큰 생성
	const createToken = () => {
	    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	    return Array.from({ length: 8 }, () =>
	        chars.charAt(Math.floor(Math.random() * chars.length))
	    ).join('');
	};

	// 토큰 세팅
	const setToken = async () => {

	    // 이미 있으면 그대로 사용
	    if (dsCarNoDetach.TOKEN) {
	        return dsCarNoDetach.TOKEN;
	    }

	    let token = '';

	    for (let i = 0; i < 10; i++) {

	        token = createToken();

	        const res = await axios.post('/api/common/token/check', {
	            TOKEN: token,
	            SERVICE_ID: dsService.SERVICE_ID
	        });
			
	        // 중복 없으면 종료
	        if (res.data.result === 0) {
				
				setDsCarNoDetach({
				    ...dsCarNoDetach,
				    TOKEN: token
				});

				if (res.data.result === 0) {
				    return token;
				}
	        }
	    }

	    throw new Error('토큰 생성에 실패했습니다.');
	};
	
	const formatPhoneNumber = (phone) => {
	    if (!phone) return '';

	    const onlyNumber = phone.replace(/\D/g, '');

	    if (onlyNumber.length === 11) {
	        // 01012345678 -> 010-1234-5678
	        return onlyNumber.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
	    }

	    if (onlyNumber.length === 10) {
	        // 0111234567 또는 0101234567 -> 010-123-4567
	        return onlyNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
	    }

	    return phone;
	};

    return (
        <div className="wa-sms-modal-backdrop">
            <div className="wa-sms-modal">
                <div className="wa-sms-modal-header">
                    <div>
                        <h3>서명 및 파일 업로드 링크 발송</h3>
                        <p>아래 번호로 서명 및 파일 업로드 링크를 발송합니다.</p>
                    </div>

                    <button
                        type="button"
                        className="wa-sms-modal-close"
                        onClick={onClose}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="wa-sms-modal-body">
                    <div className="wa-sms-phone-row">
						<input
						    autoComplete="off"
						    ref={hp1Ref}
						    value={phone.hp1}
						    maxLength={3}
						    onChange={(event) => handleChange('hp1', event.target.value)}
						/>
	
						<span>-</span>
	
						<input
						    autoComplete="off"
						    ref={hp2Ref}
						    value={phone.hp2}
						    maxLength={4}
						    onChange={(event) => handleChange('hp2', event.target.value)}
						/>
	
						<span>-</span>
	
						<input
						    autoComplete="off"
						    ref={hp3Ref}
						    value={phone.hp3}
						    maxLength={4}
						    onChange={(event) => handleChange('hp3', event.target.value)}
						/>
                    </div>

                    <button
                        type="button"
                        className="wa-sms-send-btn"
                        onClick={handleSend}
                    >
                        <Send size={16} />
                        발송
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WaSendSmsModal;
