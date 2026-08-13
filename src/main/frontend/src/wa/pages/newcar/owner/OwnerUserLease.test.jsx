import { render, screen } from '@testing-library/react';

import OwnerUserLease from './OwnerUserLease';

jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../../../utils/utils', () => ({
    gf: { confirm: jest.fn() },
    log: jest.fn()
}));

test('이용자명의리스 직접입력은 기존 리스사 정보만 표시하고 리스사 사용본거지는 추가하지 않는다', () => {
    render(
        <OwnerUserLease
            dsService={{}}
            dsNewCar={{ BASE_BRANCH_ID: 'DIRECT', REG_GB: '' }}
            dsOwnerInfo={{}}
            setDsNewCar={jest.fn()}
            dsCarNoDetach={{}}
            dsBaseList={[{ BASE_ID: 'DIRECT', BASE_NM: '직접입력' }]}
            setDsOwnerInfo={jest.fn()}
            handleChange={jest.fn()}
            onSave={jest.fn()}
            address={{
                handleLeaseCompany: jest.fn(),
                handleAddressSelect: jest.fn(),
                handleClearAddress: jest.fn()
            }}
        />
    );

    expect(screen.getByText('리스사 법인등록번호')).toBeInTheDocument();
    expect(screen.getByText('리스사 사업자등록번호')).toBeInTheDocument();
    expect(screen.getByText('리스사 본점 주소')).toBeInTheDocument();
    expect(screen.queryByText('리스사 사용본거지')).not.toBeInTheDocument();
});
