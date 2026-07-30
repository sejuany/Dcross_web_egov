import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import '../../styles/WaNewcarRequest.css';
import { gf } from '../../../utils/utils';

import '../../styles/WaNewcarRequest.css';

const WaNoticeModal = ({
	open,
	notice,
	onClose,
	onConfirm,
}) => {
	// 체크 박스
    const [checked, setChecked] = useState([]);

    // 팝업이 열릴 때 체크 초기화
    useEffect(() => {
        if (open) {
            setChecked(
                new Array(notice?.checks?.length || 0).fill(false)
            );
        }
    }, [open, notice]);

    if (!open) {
        return null;
    }

    // 체크박스 변경
    const handleCheck = (index) => {
        setChecked(prev =>
            prev.map((item, i) => i === index ? !item : item)
        );
    };
	
	// 확인 버튼
	const handleConfirm = async () => {

	    const isAllChecked =
	        checked.length === (notice?.checks?.length || 0) &&
	        checked.every(Boolean);

	    if (!isAllChecked) {
	        await gf.alert('안내 내용을 모두 확인 후 진행해 주세요.');
	        return;
	    }

	    onClose();

		// 확인 버튼 후 효과 필요한 경우 던져주면 됨 
	    onConfirm?.();
	};
	

    return (
        <div className="wa-attach-modal-backdrop">

            <div className="wa-attach-modal wa-notice-modal">

                {/* 헤더 */}
                <div className="wa-attach-modal-header">

                    <h3>{notice?.title}</h3>

                    <button
                        type="button"
                        className="wa-attach-modal-close"
                        onClick={onClose}
                    >
                        <X size={18} />
                    </button>

                </div>

                {/* 본문 */}
                <div className="wa-attach-modal-body wa-notice-body">

                    {/* 파란 박스 */}
					{!!notice?.items?.length && (
					    <div className="wa-notice-box">
					        {notice.items.map((item, index) => (
					            <React.Fragment key={index}>
					                {notice.titles
					                    ?.filter(t => t.index === index)
					                    .map(t => (
					                        <div key={t.text} className="wa-notice-title">
					                            {t.text}
					                        </div>
					                    ))}

					                <ul className="wa-notice-list">
					                    <li>{item}</li>
					                </ul>
					            </React.Fragment>
					        ))}
					    </div>
					)}

                    {/* 체크박스 */}
                    {!!notice?.checks?.length && (
                        <div className="wa-notice-check-area">

                            {notice.checks.map((text, index) => (

                                <label
                                    key={index}
                                    className="wa-notice-check"
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked[index] || false}
                                        onChange={() => handleCheck(index)}
                                    />

                                    <span>
                                        {text}
                                    </span>

                                </label>

                            ))}

                        </div>
                    )}

                    {/* 하단 파란 글씨 */}
                    {!!notice?.footer?.length && (
                        <div className="wa-notice-footer">

                            {notice.footer.map((text, index) => (
                                <div
                                    key={index}
                                    className="wa-notice-footer-line"
                                >
                                    {text}
                                </div>
                            ))}

                        </div>
                    )}

					{/* 버튼 */}
					<div className="wa-attach-btn-div">

					    <button
					        type="button"
					        className="wa-attach-cancel-btn"
					        onClick={onClose}
					    >
					        닫기
					    </button>

					    <button
					        type="button"
					        className="wa-attach-confirm-btn"
					        onClick={handleConfirm}
					    >
					        확인
					    </button>

					</div>
                </div>

            </div>

        </div>
    );
};

export default WaNoticeModal;