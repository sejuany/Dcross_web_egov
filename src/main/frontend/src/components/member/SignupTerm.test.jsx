import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SignupTerm from './SignupTerm';
import { gf } from '../../utils/utils';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('../../utils/utils', () => ({ gf: { alert: jest.fn() } }));

test('all five consents are required and both individual and all-consent selection allow navigation', () => {
    render(<SignupTerm />);
    const checkboxes = screen.getAllByRole('checkbox');
    const next = screen.getByRole('button', { name: '다음' });
    const all = checkboxes[5];

    fireEvent.click(all);
    for (const checkbox of checkboxes.slice(0, 5)) {
        fireEvent.click(checkbox);
        fireEvent.click(next);
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(all.checked).toBe(false);
        fireEvent.click(checkbox);
    }
    expect(gf.alert).toHaveBeenCalledTimes(5);
    expect(all.checked).toBe(true);
    fireEvent.click(next);
    expect(mockNavigate).toHaveBeenLastCalledWith('/signup-form', { state: { agreeValue: 'YY' } });

    fireEvent.click(all);
    expect(checkboxes.every(checkbox => !checkbox.checked)).toBe(true);
    fireEvent.click(all);
    expect(checkboxes.every(checkbox => checkbox.checked)).toBe(true);
    fireEvent.click(next);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
});
