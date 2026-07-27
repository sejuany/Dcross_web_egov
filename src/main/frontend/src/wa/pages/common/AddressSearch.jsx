import { useRef } from 'react';

import { Search } from 'lucide-react';

import useAddressSearch from '../../../hooks/useAddressSearch';

const AddressSearch = ({
	label,
	placeholder,
	type,
	dsNewCar,
	detailName,
	postName,
	handleChange,
	onSelect,
	onClear,
	showSameCheckbox = false,
	onSameChange,
	sameLabel,
	data,
	dataType = 'newcar'
}) => {
	
	const formData = data || dsNewCar;
	
	const address = useAddressSearch({
	    value: formData[type],
	    type,
	    onSelect
	});

	// 선택 버튼 클릭시 상세주소로 이동
	const detailRef = useRef(null); 
	
    return (
        <div className="wa-form-row"
			style={{ alignItems: 'flex-start' }}
		>

            <label className="wa-form-label"
				   style={{ marginTop: '10px' }}
			>
                {label}
				
				{showSameCheckbox && (
				    <label className="wa-form-sub-label">
				        {sameLabel}와 동일
				        <input
				            type="checkbox"
				            onChange={onSameChange}
				        />
				    </label>
				)}
            </label>
			

            <div className="wa-form-control">

                {/* 주소 입력 */}
				<div className="wa-address-wrap">

				    <input
						className="wa-input"
						name={type}
						data-type={dataType}
						value={formData[type] ?? ''}
						onChange={handleChange}
						onKeyDown={address.handleKeyDown}
						placeholder={placeholder}
				    />

					{!!formData[type] && (
				        <button
				            type="button"
				            className="wa-clear-btn"
							onClick={() => onClear?.(type)}
				        >
				            ×
				        </button>
				    )}

				    <button
				        type="button"
				        className="wa-search-btn"
						onClick={address.handleSearch}
				    >
				        <Search size={18} />
				    </button>

				</div>
				
                {/* 검색 결과 */}
				{address.searched && (

				    <div className="wa-address-result">
						{address.addressList.length === 0 ? (
	
						    <div className="wa-address-empty">
						        조회 결과가 없습니다.
						    </div>
	
						) : (
							<>
					        {address.currentList.map((item, idx) => (
	
					            <div
					                key={`${item.POST_NO}-${idx}`}
					                className="wa-address-item"
					            >
	
					                <div className="wa-address-info">
	
					                    <div className="wa-address-row">
					                        <span className="label">우편번호 </span>
					                        <span className="addr-span">{item.POST_NO}</span>
					                    </div>
	
					                    <div className="wa-address-row">
					                        <span className="label">도로명 </span>
					                        <span className="addr-span">{item.ROAD_AD}</span>
					                    </div>
	
					                    <div className="wa-address-row">
					                        <span className="label">구주소 </span>
					                        <span className="addr-span">{item.JIBUN_AD}</span>
					                    </div>
	
					                </div>
	
					                <button
					                    type="button"
					                    className="wa-address-select-btn"
	
										onClick={() => {
										    address.handleSelect(item);
	
										    setTimeout(() => {
										        detailRef.current?.focus();
										    }, 0);
										}}
					                >
					                    선택
					                </button>
	
					            </div>
	
					        ))}
							</>
						)}
						
						{/* 페이징처리 */}
						{address.totalPage > 1 && (() => {

						    const current = address.page;
						    const total = address.totalPage;

						    let start = Math.max(1, current - 2);
						    let end = Math.min(total, start + 4);

						    if (end - start < 4) {
						        start = Math.max(1, end - 4);
						    }

						    const pages = [];
						    for (let i = start; i <= end; i++) {
						        pages.push(i);
						    }

						    return (
						        <div className="wa-address-pagination">

						            <button
						                type="button"
						                disabled={current === 1}
						                onClick={() => address.setPage(current - 1)}
						            >
						                &lt;
						            </button>

						            {start > 1 && (
						                <>
						                    <button
						                        type="button"
						                        onClick={() => address.setPage(1)}
						                    >
						                        1
						                    </button>

						                    {start > 2 && <span>...</span>}
						                </>
						            )}

						            {pages.map(pageNo => (
						                <button
						                    key={pageNo}
						                    type="button"
						                    className={current === pageNo ? 'active' : ''}
						                    onClick={() => address.setPage(pageNo)}
						                >
						                    {pageNo}
						                </button>
						            ))}

						            {end < total && (
						                <>
						                    {end < total - 1 && <span>...</span>}

						                    <button
						                        type="button"
						                        onClick={() => address.setPage(total)}
						                    >
						                        {total}
						                    </button>
						                </>
						            )}

						            <button
						                type="button"
						                disabled={current === total}
						                onClick={() => address.setPage(current + 1)}
						            >
						                &gt;
						            </button>

						        </div>
						    );

						})()}

				    </div>

				)}

				<div className="wa-inline-group">

				    <input
				        ref={detailRef}
				        className="wa-input wa-flex"
						style={{ flex: 2 }}
				        name={detailName}
				        data-type={dataType}
				        value={formData[detailName] ?? ''}
				        onChange={handleChange}
				        placeholder="상세주소 입력"
				    />

				    {postName && (
				        <input
				            className="wa-input"
				            style={{ flex: 1 }}
				            name={postName}
				            data-type={dataType}
				            value={formData[postName] ?? ''}
							placeholder="우편번호"
				            readOnly
				        />
				    )}

				</div>
            </div>

        </div>
    );

};

export default AddressSearch;