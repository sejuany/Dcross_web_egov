import React from 'react';

const WaRadioGroup = ({
    name,
    value,
    dataType,
    options,
    handleChange,
    disabled = false
}) => (
    <div className="wa-radio-group">
        {options.map(option => (
            <button
                key={option.value}
                type="button"
                disabled={disabled}
                className={`wa-radio-btn ${value === option.value ? 'active' : ''}`}
                onClick={() =>
                    handleChange({
                        target: {
                            name,
                            value: option.value,
                            dataset: { type: dataType }
                        }
                    })
                }
            >
                {option.label}
            </button>
        ))}
    </div>
);

export default WaRadioGroup;