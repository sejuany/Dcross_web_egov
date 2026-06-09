import React, { useState, useRef, useEffect } from 'react';

const CommonMultiSelect = ({
  options = [],
  selectedValues = [],
  setSelectedValues,
  width = '120px',
}) => {

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const safeSelected = Array.isArray(selectedValues)
    ? selectedValues
    : [];

  useEffect(() => {

    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };

  }, []);

  const toggleOption = (val) => {

    setSelectedValues((prev) => {

      const current = Array.isArray(prev)
        ? prev
        : [];

      return current.includes(val)
        ? current.filter(item => item !== val)
        : [...current, val];

    });
  };

  const toggleAll = () => {

    if (safeSelected.length === options.length) {
      setSelectedValues([]);
    } else {
      setSelectedValues(
        options.map(opt => opt.value)
      );
    }
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        width,
		minWidth: 0,
      }}
    >

      {/* 선택 영역 */}
      <div
        className="erp-input"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >

        <span
          style={{
            fontSize: '11px',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
        >
          {safeSelected.length === 0
            ? ''
            : options
                .filter(opt =>
                  safeSelected.includes(opt.value)
                )
                .map(opt => opt.label)
                .join(', ')
          }
        </span>

      </div>

      {/* 드롭다운 */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width,
            border: '1px solid #999',
            backgroundColor: '#fff',
            zIndex: 1000,
            boxShadow:
              '2px 2px 5px rgba(0,0,0,0.2)',
            fontSize: '12px',
          }}
        >

          {/* 전체 */}
          <div
            style={{
              padding: '4px',
              backgroundColor: '#002060',
              color: 'white',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >

              <input
                type="checkbox"
                checked={
                  safeSelected.length ===
                    options.length &&
                  options.length > 0
                }
                onChange={toggleAll}
                style={{
                  marginRight: '6px',
                }}
              />

              전체

            </label>
          </div>

          {/* 옵션 */}
          <div
            style={{
              maxHeight: '180px',
              overflowY: 'auto',
            }}
          >

            {options.map((opt) => (

              <div
                key={opt.value}
                style={{
                  padding: '4px',
                  borderBottom:
                    '1px solid #eee',
                }}
              >

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >

                  <input
                    type="checkbox"
                    checked={safeSelected.includes(
                      opt.value
                    )}
                    onChange={() =>
                      toggleOption(opt.value)
                    }
                    style={{
                      marginRight: '6px',
                    }}
                  />

                  {opt.label}

                </label>

              </div>

            ))}

          </div>

          {/* 버튼 */}
          <div
            style={{
              display: 'flex',
              borderTop:
                '1px solid #ccc',
              backgroundColor: '#f4f4f4',
            }}
          >

            <button
              onClick={() => setIsOpen(false)}
              style={{
                flex: 1,
                padding: '4px',
                cursor: 'pointer',
              }}
            >
              선택
            </button>

            <button
              onClick={() =>
                setSelectedValues([])
              }
              style={{
                flex: 1,
                padding: '4px',
                cursor: 'pointer',
              }}
            >
              해제
            </button>

          </div>

        </div>
      )}

    </div>
  );
};

export default CommonMultiSelect;