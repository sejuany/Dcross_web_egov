package com.dacos.common;

import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;

import org.springframework.stereotype.Service;

import com.dacos.auth.dto.UserDto;
import com.dacos.mortgage.mapper.MortgageMapper;

import lombok.RequiredArgsConstructor;

/**
 * SERVICE_ID 기반 업무 데이터 접근 권한을 한 곳에서 검증한다.
 * 클라이언트가 전달한 회사/지점 값은 신뢰하지 않고 TR_SERVICE와 로그인 세션을 비교한다.
 */
@Service
@RequiredArgsConstructor
public class ServiceAccessGuard {

    public enum ServiceAction {
        READ_DETAIL,
        READ_ATTACHMENT,
        WRITE_ATTACHMENT,
        UPDATE_SERVICE,
        CHANGE_STATUS,
        REASSIGN,
        CANCEL
    }

    private enum ServiceScope {
        GLOBAL,
        GOVERNMENT,
        COMPANY,
        BRANCH,
        TEAM,
        OWNER,
        RELATED_COMPANY
    }

    private record AccessPolicy(ServiceScope scope, Set<ServiceAction> actions) {
        private boolean allows(ServiceAction action) {
            return actions.contains(action);
        }
    }

    /** 목록 SQL에 전달할 서버 생성 권한 범위. */
    public record ListAccessScope(
            String scope,
            String companyId,
            String branchId,
            String sangsaId,
            String memberId,
            String govtId,
            List<String> companyIds) {
    }

    private static final Set<ServiceAction> ADMIN_ACTIONS =
            Set.copyOf(EnumSet.allOf(ServiceAction.class));
    private static final Set<ServiceAction> USER_ACTIONS = Set.copyOf(EnumSet.of(
            ServiceAction.READ_DETAIL,
            ServiceAction.READ_ATTACHMENT,
            ServiceAction.WRITE_ATTACHMENT,
            ServiceAction.UPDATE_SERVICE,
            ServiceAction.CHANGE_STATUS,
            ServiceAction.CANCEL));
    private static final Map<String, AccessPolicy> POLICIES = Map.ofEntries(
            Map.entry("UA", policy(ServiceScope.GLOBAL, ADMIN_ACTIONS)),
            Map.entry("UC", policy(ServiceScope.GLOBAL, ADMIN_ACTIONS)),
            Map.entry("UU", policy(ServiceScope.GLOBAL, USER_ACTIONS)),
            Map.entry("GU", policy(ServiceScope.GOVERNMENT, USER_ACTIONS)),

            Map.entry("CA", policy(ServiceScope.COMPANY, ADMIN_ACTIONS)),
            Map.entry("CU", policy(ServiceScope.BRANCH, USER_ACTIONS)),
            Map.entry("MA", policy(ServiceScope.COMPANY, ADMIN_ACTIONS)),
            Map.entry("MU", policy(ServiceScope.BRANCH, USER_ACTIONS)),
            Map.entry("WA", policy(ServiceScope.COMPANY, ADMIN_ACTIONS)),
            Map.entry("WU", policy(ServiceScope.BRANCH, USER_ACTIONS)),

            Map.entry("BA", policy(ServiceScope.BRANCH, ADMIN_ACTIONS)),
            Map.entry("BU", policy(ServiceScope.BRANCH, USER_ACTIONS)),
            Map.entry("SA", policy(ServiceScope.TEAM, ADMIN_ACTIONS)),
            Map.entry("SU", policy(ServiceScope.OWNER, USER_ACTIONS)),

            Map.entry("RA", policy(ServiceScope.RELATED_COMPANY, ADMIN_ACTIONS)),
            Map.entry("RU", policy(ServiceScope.RELATED_COMPANY, USER_ACTIONS)),
            Map.entry("NA", policy(ServiceScope.GLOBAL, ADMIN_ACTIONS)),
            Map.entry("NU", policy(ServiceScope.GLOBAL, USER_ACTIONS)),

            Map.entry("DA", policy(ServiceScope.COMPANY, ADMIN_ACTIONS)),
            Map.entry("DU", policy(ServiceScope.BRANCH, USER_ACTIONS)));

    /** 레거시 관계사 중 회사코드가 다른 신청건을 직접 처리하는 확정 매핑. */
    private static final Map<String, Set<String>> RELATED_COMPANIES = Map.of(
            "RC001", Set.of("CB007"));

    private final MortgageMapper mortgageMapper;

    public Map<String, Object> requireAccess(
            UserDto user,
            String serviceId,
            ServiceAction action) {

        if (user == null) {
            throw new BusinessException("로그인 정보가 없습니다.", 401);
        }

        String cleanServiceId = text(serviceId);
        if (cleanServiceId.isEmpty()) {
            throw new BusinessException("접수번호가 없습니다.", 400);
        }

        AccessPolicy policy = POLICIES.get(upper(user.getMEMBER_GB()));
        if (policy == null || !policy.allows(action)) {
            throw new BusinessException("처리 권한이 없습니다.", 403);
        }

        Map<String, Object> service = mortgageMapper.getTrService(cleanServiceId);
        if (service == null || service.isEmpty() || !matchesScope(policy.scope(), user, service)) {
            // 접수번호 존재 여부를 권한 없는 사용자에게 노출하지 않는다.
            throw new BusinessException("접수 정보를 찾을 수 없습니다.", 404);
        }

        return service;
    }

    /**
     * 로그인 세션만으로 목록 조회 범위를 만든다.
     * 클라이언트가 보낸 회사/지점/담당자 값은 이 범위 생성에 사용하지 않는다.
     */
    public ListAccessScope resolveListAccessScope(UserDto user) {
        return listAccessScopeFor(user);
    }

    /** MyBatis 공통 조회 권한 검사에서도 같은 역할 정책을 사용한다. */
    public static ListAccessScope listAccessScopeFor(UserDto user) {
        if (user == null) {
            throw new BusinessException("로그인 정보가 없습니다.", 401);
        }

        AccessPolicy policy = POLICIES.get(upper(user.getMEMBER_GB()));
        if (policy == null || !policy.allows(ServiceAction.READ_DETAIL)) {
            throw new BusinessException("조회 권한이 없습니다.", 403);
        }

        String companyId = upper(user.getCOMPANY_ID());
        String branchId = upper(user.getBRANCH_ID());
        String sangsaId = upper(user.getSANGSA_ID());
        // 로그인 ID는 DB에 소문자로 저장된 계정이 있으므로 SQL 비교용 원문을 보존한다.
        String memberId = text(user.getLOGIN_ID());

        return switch (policy.scope()) {
            case GLOBAL -> listScope(ServiceScope.GLOBAL, "", "", "", "", "", List.of());
            case GOVERNMENT -> listScope(
                    ServiceScope.GOVERNMENT, "", "", "", "",
                    requireScopeValue(companyId), List.of());
            case COMPANY -> listScope(
                    ServiceScope.COMPANY, requireScopeValue(companyId), "", "", "", "", List.of());
            case BRANCH -> listScope(
                    ServiceScope.BRANCH,
                    requireScopeValue(companyId),
                    requireScopeValue(branchId),
                    "", "", "", List.of());
            case TEAM -> listScope(
                    ServiceScope.TEAM,
                    requireScopeValue(companyId),
                    requireScopeValue(branchId),
                    requireScopeValue(sangsaId),
                    "", "", List.of());
            case OWNER -> listScope(
                    ServiceScope.OWNER,
                    requireScopeValue(companyId),
                    requireScopeValue(branchId),
                    "",
                    requireScopeValue(memberId),
                    "", List.of());
            case RELATED_COMPANY -> {
                String requiredCompanyId = requireScopeValue(companyId);
                Set<String> allowedCompanies = new TreeSet<>();
                allowedCompanies.add(requiredCompanyId);
                allowedCompanies.addAll(RELATED_COMPANIES.getOrDefault(requiredCompanyId, Set.of()));
                yield listScope(
                        ServiceScope.RELATED_COMPANY,
                        "", "", "", "", "",
                        List.copyOf(allowedCompanies));
            }
        };
    }

    /** 이미 조회된 TR_SERVICE 권한 컬럼을 현재 사용자가 읽을 수 있는지 검사한다. */
    public static boolean canReadService(UserDto user, Map<String, Object> service) {
        if (user == null || service == null || service.isEmpty()) {
            return false;
        }
        AccessPolicy policy = POLICIES.get(upper(user.getMEMBER_GB()));
        return policy != null
                && policy.allows(ServiceAction.READ_DETAIL)
                && matchesScope(policy.scope(), user, service);
    }

    private static boolean matchesScope(
            ServiceScope scope,
            UserDto user,
            Map<String, Object> service) {

        String loginId = upper(user.getLOGIN_ID());
        String companyId = upper(user.getCOMPANY_ID());
        String branchId = upper(user.getBRANCH_ID());
        String sangsaId = upper(user.getSANGSA_ID());

        String serviceCompanyId = upper(service.get("COMPANY_ID"));
        String serviceBranchId = upper(service.get("BRANCH_ID"));
        String serviceSangsaId = upper(service.get("SANGSA_ID"));
        String serviceMemberId = upper(service.get("MEMBER_ID"));
        String serviceGovtId = upper(service.get("GOVT_ID"));

        return switch (scope) {
            case GLOBAL -> true;
            case GOVERNMENT -> !companyId.isEmpty() && companyId.equals(serviceGovtId);
            case COMPANY -> sameCompany(companyId, serviceCompanyId);
            case BRANCH -> sameCompany(companyId, serviceCompanyId)
                    && !branchId.isEmpty()
                    && branchId.equals(serviceBranchId);
            case TEAM -> sameCompany(companyId, serviceCompanyId)
                    && !branchId.isEmpty()
                    && branchId.equals(serviceBranchId)
                    && !sangsaId.isEmpty()
                    && sangsaId.equals(serviceSangsaId);
            case OWNER -> sameCompany(companyId, serviceCompanyId)
                    && !branchId.isEmpty()
                    && branchId.equals(serviceBranchId)
                    && !loginId.isEmpty()
                    && loginId.equals(serviceMemberId);
            case RELATED_COMPANY -> isRelatedCompany(companyId, serviceCompanyId);
        };
    }

    private static boolean isRelatedCompany(String companyId, String serviceCompanyId) {
        if (sameCompany(companyId, serviceCompanyId)) {
            return true;
        }
        return RELATED_COMPANIES.getOrDefault(companyId, Set.of()).contains(serviceCompanyId);
    }

    private static boolean sameCompany(String companyId, String serviceCompanyId) {
        return !companyId.isEmpty() && companyId.equals(serviceCompanyId);
    }

    private static AccessPolicy policy(ServiceScope scope, Set<ServiceAction> actions) {
        return new AccessPolicy(scope, actions);
    }

    private static ListAccessScope listScope(
            ServiceScope scope,
            String companyId,
            String branchId,
            String sangsaId,
            String memberId,
            String govtId,
            List<String> companyIds) {
        return new ListAccessScope(
                scope.name(), companyId, branchId, sangsaId, memberId, govtId, companyIds);
    }

    private static String requireScopeValue(String value) {
        if (value == null || value.isEmpty()) {
            throw new BusinessException("로그인 권한 범위 정보가 없습니다.", 403);
        }
        return value;
    }

    private static String upper(Object value) {
        return text(value).toUpperCase(Locale.ROOT);
    }

    private static String text(Object value) {
        return Objects.toString(value, "").trim();
    }
}
