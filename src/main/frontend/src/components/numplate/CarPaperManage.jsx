import React from 'react';
import NumPlateSimpleList from '../numplateapp/NumPlateSimpleList';

// 화면마다 달라지는 API와 열 정의만 두고 조회·회사 제한·그리드는 공통 목록이 처리한다.
const columns = [
  { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 70 },
  { headerName: '접수번호', field: 'SERVICE_ID', minWidth: 150 },
  { headerName: '차량번호', field: 'CAR_NO', minWidth: 120 },
  { headerName: '회사코드', field: 'COMPANY_ID', minWidth: 110 },
  { headerName: '회사명', field: 'COMPANY_NM', flex: 1, minWidth: 160 },
  { headerName: '출력일', field: 'PRINT_DT', minWidth: 110 },
];

export default function CarPaperManage() {
  return <NumPlateSimpleList title="자동차등록증 관리" endpoint="/api/numplate/car-paper/list" columns={columns} />;
}
