import { X } from 'lucide-react';

import '../../../styles/LeaseCompanyModal.css';


// 그 외 캐피탈 선택 모달
const LeaseCompanyModal = ({
    onClose
}) => {

    return (

        <div className="wa-modal-overlay">

            <div className="wa-lease-modal">

                {/* 모달 헤더 */}
                <div className="wa-lease-modal-header">

                    <span>캐피탈 선택</span>

                    <button
                        type="button"
                        className="wa-modal-close"
                        onClick={onClose}
                    >
                        <X size={18} />
                    </button>

                </div>

                {/* 모달 내용 */}
                <div className="wa-lease-modal-body">

                    {/* 리스사 선택 */}
                    <div className="wa-form-row">

                        <label className="wa-form-label">
                            리스사 선택
                        </label>

                        <div className="wa-form-control">

                            <select className="wa-select">
                                <option>선택</option>
                            </select>

                        </div>

                    </div>

                </div>

                {/* 완료 버튼 */}
                <div className="wa-lease-modal-footer">

                    <button
                        type="button"
                        className="wa-primary-btn"
                    >
                        완료
                    </button>

                </div>

            </div>

        </div>

    );

};

export default LeaseCompanyModal;