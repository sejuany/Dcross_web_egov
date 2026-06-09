import React, { useEffect, useMemo, useState } from 'react';
import './AddressSearchModal.css';
import axios from 'axios';
import { gf, log } from '../../utils/utils'; // 공통 유틸 함수

const PAGE_SIZE = 5;

const AddressSearchModal = ({
    isOpen,
    onClose,
    onSelect
}) => {

    // 검색어
    const [keyword, setKeyword] = useState('');

    // 주소 목록
    const [addressList, setAddressList] = useState([]);

    // 선택 주소
    const [selectedAddress, setSelectedAddress] = useState(null);

    // 페이지
    const [page, setPage] = useState(1);

    // 조회중
    const [loading, setLoading] = useState(false);
	
	// 조회 유무
	const [searched, setSearched] = useState(false);
	
	// 상세주소
	const [addrDt, setAddrDt] = useState('');

    // 모달 열릴 때 초기화
    useEffect(() => {

        if (!isOpen) {
            return;
        }

        setKeyword('');
        setAddressList([]);
        setSelectedAddress(null);
        setPage(1);
		
		setSearched(false);

    }, [isOpen]);

    // 주소 조회
    const handleSearch = async () => {

		const oAddr = gf.createAddrParam(keyword);
		
		log();
		
		if (!oAddr) {

		    alert(
		        '길이름 + 건물번호 또는 읍/면/동/리 + 번지를 입력해주세요.'
		    );

		    return;
		}
		
		try {
			
			setLoading(true);
			
			const res = await axios.post('/api/common/search/address', oAddr);

			const result = res.data.list || [];
			console.log(res.data.list);

			setAddressList(Array.isArray(result) ? result : []);

			setSelectedAddress(null);

			setPage(1);

			if (result.length === 0) {
			    alert('검색 결과가 없습니다.');
			}
			
			setSearched(true);

        } catch (e) {

            console.error(e);

            alert('주소 조회 중 오류가 발생했습니다.');

        } finally {

            setLoading(false);

        }

    };
	

    // 현재 페이지 데이터
    const currentList = useMemo(() => {

        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;

        return addressList.slice(start, end);

    }, [addressList, page]);

    // 전체 페이지 수
    const totalPage = Math.ceil(addressList.length / PAGE_SIZE);

    // 적용
    const handleApply = () => {

        if (!selectedAddress) {
            alert('주소를 선택해주세요.');
            return;
        }
		
		log("selectedAddress>>>>>");
		log(selectedAddress);
		
		onSelect({
			ADDR: selectedAddress.ROAD_AD,
			ADDR_DT: addrDt,
			POST_NO: selectedAddress.POST_NO,
			BUBJUNG_CD: selectedAddress.BUBJUNG_CD,
			ROAD_CD: selectedAddress.ROAD_CD,
			HJD_CD: selectedAddress.HJD_CD,
			EMD_SN: selectedAddress.EMD_SN,
			JIHA_YN: selectedAddress.JIHA_YN,
			BUILDB_NO: selectedAddress.BUILDB_NO,
			BUILDS_NO: selectedAddress.BUILDS_NO
		});

        onClose();

    };

    // 엔터 검색
    const handleKeyDown = (e) => {

        if (e.key === 'Enter') {
            handleSearch();
        }

    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="addr-modal-overlay">

            <div className="addr-modal">

                {/* Header */}
                <div className="addr-modal-header">

                    <div>
                        <h2>주소 검색</h2>
                        <p>도로명 또는 지번 주소를 검색하세요.</p>
                    </div>

                    <button
                        type="button"
                        className="addr-close-btn"
                        onClick={onClose}
                    >
                        ✕
                    </button>

                </div>

                {/* Search */}
                <div className="addr-search-section">

                    <div className="addr-search-box">

                        <input
                            type="text"
                            value={keyword}
                            placeholder="예) 판교역로 235"
                            onChange={(e) => setKeyword(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />

                        <button
                            type="button"
                            onClick={handleSearch}
                            disabled={loading}
                        >
                            {loading ? '조회중...' : '조회'}
                        </button>

                    </div>

                </div>

                {/* Guide */}
                {!searched && addressList.length === 0 && (

                    <div className="addr-guide-box">

                        <div className="guide-title">
                            Tip
                        </div>

						<div className="guide-item">
						    <strong>전체 주소 검색 가능</strong>
						    <p>서울특별시 중구 세종대로 110</p>
						    <p>경기도 성남시 분당구 판교역로 166</p>
						</div>

						<div className="guide-item">
						    <strong>간단 검색도 가능</strong>
						    <p>판교역로 235</p>
						    <p>호계동 898-0</p>
						</div>

                    </div>

                )}

                {/* Result */}
                {addressList.length > 0 && (

                    <div className="addr-result-section">

                        <div className="addr-result-header">
                            <span>검색 결과</span>
                            <span>총 {addressList.length}건</span>
                        </div>


						<div className="addr-table-wrap">

						    <table>

						        <thead>
						            <tr>
										<th width="6%">선택</th>
						                <th width="12%">우편번호</th>
						                <th>주소</th>
						            </tr>
						        </thead>

						        <tbody>

						            {currentList.map((item, idx) => (

						                <tr
						                    key={`${item.POST_NO}-${idx}`}
						                    onClick={() => setSelectedAddress(item)}
						                    className={
						                        selectedAddress?.POST_NO === item.POST_NO &&
						                        selectedAddress?.ROAD_AD === item.ROAD_AD
						                            ? 'selected'
						                            : ''
						                    }
						                >
										
											{/* 라디오버튼 */}
											<td>
												<input
											        type="radio"
											        checked={
											            selectedAddress?.POST_NO === item.POST_NO &&
											            selectedAddress?.ROAD_AD === item.ROAD_AD
											        }
											    />
											</td>
											
											{/* 우편번호 */}
						                    <td>
						                        {item.POST_NO}
						                    </td>
											
											{/* 주소 */}
						                    <td className="addr-text-cell">

						                        <div className="road">
						                            {item.ZDISPLAY_AD}
						                        </div>

						                    </td>

						                </tr>

						            ))}

						        </tbody>

						    </table>

						</div>


                        {/* Pagination */}
                        {totalPage > 1 && (

                            <div className="addr-pagination">

                                {Array.from({ length: totalPage }, (_, i) => i + 1)
                                    .map(pageNo => (

                                        <button
                                            key={pageNo}
                                            type="button"
                                            className={
                                                page === pageNo
                                                    ? 'active'
                                                    : ''
                                            }
                                            onClick={() => setPage(pageNo)}
                                        >
                                            {pageNo}
                                        </button>

                                    ))}

                            </div>

                        )}

                    </div>

                )}

                {/* Empty */}
                {searched && !loading && addressList.length === 0 && (

                    <div className="addr-empty-box">
                        검색 결과가 없습니다.
                    </div>

                )}

                {/* Bottom */}
                <div className="addr-bottom-section">

                    <div className="addr-bottom-box">

                        <div className="addr-preview-row">

                            <label>지번주소</label>

							<input
							    type="text"
								className="addr-short-input"
							    value={selectedAddress?.POST_NO || ''}
							    readOnly
							/>

							<input
							    type="text"
							    value={selectedAddress?.JIBUN_AD || ''}
							    readOnly
							/>

                        </div>

						<div className="addr-preview-row">

						    <label>도로명주소</label>

							<input
							    type="text"
								className="addr-short-input"
							    value={selectedAddress?.ROAD_CD || ''}
							    readOnly
							/>

							<input
							    type="text"
							    value={selectedAddress?.ROAD_AD || ''}
							    readOnly
							/>
							
						</div>
						
                        <div className="addr-preview-row">

                            <label>상세 주소</label>

							<input
								id="ADDR_DT"
								value={addrDt}
								onChange={(e) => setAddrDt(e.target.value)}
							    placeholder="상세주소 입력"
							/>

                        </div>

                    </div>

                    <div className="addr-footer-btns">

                        <button
                            type="button"
                            className="btn-close"
                            onClick={onClose}
                        >
                            닫기
                        </button>

                        <button
                            type="button"
                            className="btn-apply"
                            onClick={handleApply}
                        >
                            적용
                        </button>

                    </div>

                </div>

            </div>

        </div>
    );
};

export default AddressSearchModal;