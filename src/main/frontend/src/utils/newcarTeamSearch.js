// 여러 팀에 소속된 계정에는 위에서 처음 일치하는 조건을 적용한다.
const teamSearchRules = [
    {
        teamIds: ['SALES', 'NEWC', 'RENT', 'LEAS', 'DEVEL', 'SUPPT'],
        apply: (filters) => ({ ...filters, dateType: 'REGDT', startDate: filters.endDate })
    }
];

export const applyTeamSearchDefaults = (filters, teams, user) => {
    const loginId = String(user?.LOGIN_ID ?? user?.login_ID ?? user?.loginId ?? user?.login_id ?? '')
        .trim().toLowerCase();
    if (!loginId) return filters;

    const userTeamIds = new Set(teams
        .filter(({ CODE_NM }) => (CODE_NM ?? '').split(',')
            .some(member => member.trim().toLowerCase() === loginId))
        .map(({ CODE_ID }) => CODE_ID));
    const rule = teamSearchRules.find(({ teamIds }) => teamIds.some(teamId => userTeamIds.has(teamId)));
    return rule ? rule.apply(filters) : filters;
};
