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
    width, // select 너비
    options,
    ...rest
}) => {

    const optionList = options || codes?.[groupId] || [];

    return (
        <select
            className={className}
            name={name}
            value={value ?? ''}
            onChange={onChange}
            style={width ? { width } : undefined}
            {...rest}
        >
            <option value="">선택</option>

            {optionList.map(item => (
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