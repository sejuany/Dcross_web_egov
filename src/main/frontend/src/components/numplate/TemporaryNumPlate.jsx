import React from 'react';
import NumPlateSimpleList from '../numplateapp/NumPlateSimpleList';

// 화면마다 달라지는 API와 열 정의만 두고 조회·회사 제한·그리드는 공통 목록이 처리한다.
const columns = [
  { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 70 },
  { headerName: '번호판 ID', field: 'NUM_ID', minWidth: 130 },
  { headerName: '차량번호', field: 'CAR_NO', minWidth: 130 },
  { headerName: '회사코드', field: 'COMPANY_ID', minWidth: 110 },
  { headerName: '회사명', field: 'COMPANY_NM', flex: 1, minWidth: 160 },
  { headerName: '발급일', field: 'ISSUE_DT', minWidth: 110 },
  { headerName: '회수일', field: 'RETURN_DT', minWidth: 110 },
];

export default function TemporaryNumPlate() {
  return <NumPlateSimpleList title="임시번호판 회수 관리" endpoint="/api/numplate/temporary/list" columns={columns} />;
}
