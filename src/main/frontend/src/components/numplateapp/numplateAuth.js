const loginType = (user) => user?.login_GB || user?.LOGIN_GB;

export const isImageManagementUser = (user) => loginType(user) === 'NUMPLATE_IMAGE_APP';

export const isNumPlateUser = (user) => loginType(user) === 'NUMPLATE_APP' || isImageManagementUser(user);

export const numPlateHome = (user) => isImageManagementUser(user) ? '/numplateapp/images' : '/numplateapp';
