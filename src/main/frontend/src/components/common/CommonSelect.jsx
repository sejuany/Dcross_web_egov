import React from 'react';

const CommonSelect = ({
    codes = {},
    groupId,
    value,
    onChange,
    name,
    className = 'erp-input',
    valueField = 'CODE_ID',
    labelField = 'CODE_NM',
    ...rest
}) => {

    const options = codes?.[groupId] || [];

    return (
        <select
            className={className}
            name={name}
            value={value ?? ''}
            onChange={onChange}
            {...rest}
        >
            <option value="">선택</option>

            {options.map(item => (
                <option
                    key={item[valueField]}
                    value={item[valueField]}
                >
                    {item[labelField]}
                </option>
            ))}
        </select>
    );
};

export default CommonSelect; 