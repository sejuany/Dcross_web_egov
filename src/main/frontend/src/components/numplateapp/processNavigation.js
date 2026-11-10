const requestStates = new Set([
  'N_REQ', 'N_INS', 'N_DLV',
  '번호판처리요청', '번호판발송요청', '번호판탈부착요청', '배송요청', '사무실배송요청', '지점배송요청',
]);

export function getProcessPath(item) {
  if (!item?.SERVICE_ID) return '/numplateapp';
  const serviceId = String(item.SERVICE_ID);
  const delivery = serviceId.startsWith('N');
  if (delivery && item.INSTALL_YN === 'Y') return '/numplateapp';
  const statusName = String(item.PROC_ST_NM || '').replace(/\((?:전시장|임시판|임시)\)$/, '');
  const screen = delivery || requestStates.has(item.PROC_ST) || requestStates.has(statusName) ? 'request' : 'status';
  return `/numplateapp/${screen}/${encodeURIComponent(serviceId)}`;
}
