// utils/formUtil.js

export const splitValue = (value, lengths) => {
    let pos = 0;

    return lengths.map(len => {
        const v = value.substring(pos, pos + len);
        pos += len;
        return v;
    });
};

export const mergeValue = (...values) => {
    return values.join('');
};