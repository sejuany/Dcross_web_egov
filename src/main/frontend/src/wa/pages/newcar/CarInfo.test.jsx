import { render, screen } from '@testing-library/react';

import CarInfo from './CarInfo';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../common/WaNumPlateSelectModal', () => () => null);

test.each([
    ['NORML', 'I', 'B', 'R', 80000000, true],
    ['NORML', 'I', 'R', 'B', 80000000, false],
    ['LEASE', 'I', 'R', 'B', 80000000, true],
    ['LEASE', 'I', 'B', 'R', 80000000, false],
    ['LEASE', 'I', 'B', undefined, 80000000, false],
    ['LEASE', 'C', 'R', 'B', 80000000, true],
    ['LEASE', 'C', 'B', 'R', 80000000, false],
    ['LEASE', 'C', 'B', undefined, 80000000, false],
    ['NORML', 'I', 'B', 'B', 79999999, false],
    ['LEASE', 'I', 'B', 'B', 79999999, false],
    ['LEASE', 'C', 'B', 'B', 79999999, false],
    ['LEASE', 'C', 'R', 'B', 80000001, true],
    ['NORML', 'I', 'B', 'R', '80000000', true]
])('%s/%s 등록구분 %s, 소유자구분 %s, 금액 %s의 법인번호판 표시=%s',
    (taskCd, procCd, regGb, debtorGb, buyAmt, expected) => {
        const dsNewCar = {
            TASK_CD: taskCd, PROC_CD: procCd, REG_GB: regGb,
            BUY_AMT: buyAmt, NUMPLATE_GB: 'FG'
        };
        const setDsNewCar = jest.fn();
        render(
            <CarInfo
                dsService={{}}
                dsNewCar={dsNewCar}
                dsOwnerInfo={{ DEBTOR_GB: debtorGb }}
                setDsNewCar={setDsNewCar}
                dsCarNoDetach={{}}
                setDsCarNoDetach={jest.fn()}
                codes={[]}
                dsUserInfo={{ MEMBER_GB: 'CA' }}
                dsBranchList={[]}
                handleChange={jest.fn()}
                saveProcess={jest.fn()}
                address={{}}
                isPostNumplate={false}
            />
        );

        expect(Boolean(screen.queryByRole('button', { name: '법인 필름' }))).toBe(expected);
        expect(Boolean(screen.queryByRole('button', { name: '법인 페인트' }))).toBe(expected);
        expect(setDsNewCar).not.toHaveBeenCalled();
        expect(dsNewCar.NUMPLATE_GB).toBe('FG');
    });
