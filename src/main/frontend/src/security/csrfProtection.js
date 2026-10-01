import axios from 'axios';

const CSRF_HEADER = 'X-CSRF-TOKEN';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);
const PRE_AUTH_PATHS = new Set([
  '/api/login',
  '/api/auth/withauth/token',
  '/api/auth/withauth/verify',
  '/api/auth/mobile/request',
  '/api/auth/mobile/verify',
  '/api/company/search',
  '/api/company/association-list',
  '/api/company/branch-list',
  '/api/member/check-id',
  '/api/member/signup',
  '/api/log/login-enter',
]);
const AUTH_LIFECYCLE_PATHS = new Set([
  '/api/login',
  '/api/logout',
  '/api/auth/withauth/verify',
  '/api/auth/mobile/verify',
]);

const originalFetch = window.fetch.bind(window);
let csrfToken = null;
let csrfTokenPromise = null;

const requestInfo = (value) => {
  try {
    const raw = value instanceof Request ? value.url : String(value || '');
    const url = new URL(raw, window.location.href);
    return {
      path: url.pathname,
      sameOrigin: url.origin === window.location.origin,
    };
  } catch {
    return { path: '', sameOrigin: false };
  }
};

const isProtectedApiRequest = (urlValue, methodValue) => {
  const method = String(methodValue || 'GET').toUpperCase();
  const info = requestInfo(urlValue);
  return info.sameOrigin
    && info.path.startsWith('/api/')
    && !SAFE_METHODS.has(method)
    && !PRE_AUTH_PATHS.has(info.path)
    && !info.path.startsWith('/api/customer/')
    && !info.path.startsWith('/api/internal/');
};

const resetCsrfToken = () => {
  csrfToken = null;
  csrfTokenPromise = null;
};

const loadCsrfToken = async () => {
  if (csrfToken) {
    return csrfToken;
  }
  if (!csrfTokenPromise) {
    csrfTokenPromise = originalFetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (response.status === 401) {
          return null;
        }
        if (!response.ok) {
          throw new Error('CSRF 토큰을 발급받지 못했습니다.');
        }
        const body = await response.json();
        if (!body?.token) {
          throw new Error('CSRF 토큰 응답이 올바르지 않습니다.');
        }
        csrfToken = body.token;
        return csrfToken;
      })
      .finally(() => {
        csrfTokenPromise = null;
      });
  }
  return csrfTokenPromise;
};

axios.interceptors.request.use(async (config) => {
  if (!isProtectedApiRequest(config.url, config.method)) {
    return config;
  }

  const token = await loadCsrfToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers[CSRF_HEADER] = token;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => {
    const path = requestInfo(response.config?.url).path;
    if (AUTH_LIFECYCLE_PATHS.has(path)) {
      resetCsrfToken();
    }
    return response;
  },
  (error) => {
    if (error?.response?.status === 401) {
      resetCsrfToken();
    }
    return Promise.reject(error);
  }
);

window.fetch = async (input, init = {}) => {
  const method = init.method || (input instanceof Request ? input.method : 'GET');
  let options = init;

  if (isProtectedApiRequest(input, method)) {
    const token = await loadCsrfToken();
    if (token) {
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
      headers.set(CSRF_HEADER, token);
      options = { ...init, headers };
    }
  }

  const response = await originalFetch(input, options);
  const path = requestInfo(input).path;
  if (response.status === 401 || AUTH_LIFECYCLE_PATHS.has(path)) {
    resetCsrfToken();
  }
  return response;
};

