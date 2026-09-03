import React from 'react';
import NumPlateSimpleList from '../numplateapp/NumPlateSimpleList';

// 화면마다 달라지는 API와 열 정의만 두고 조회·회사 제한·그리드는 공통 목록이 처리한다.
const columns = [
  { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 70 },
  { headerName: '수불 ID', field: 'SUPPLY_ID', minWidth: 130 },
  { headerName: '회사코드', field: 'COMPANY_ID', minWidth: 110 },
  { headerName: '회사명', field: 'COMPANY_NM', flex: 1, minWidth: 180 },
  { headerName: '수량', field: 'SUPPLY_QTY', minWidth: 100, type: 'numericColumn' },
  { headerName: '수불일', field: 'SUPPLY_DT', minWidth: 110 },
];

export default function NumPlateSupplyManage() {
  return <NumPlateSimpleList title="번호판 수불 관리" endpoint="/api/numplate/supply/list" columns={columns} />;
}
