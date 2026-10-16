import axios from 'axios';

jest.mock('axios', () => ({
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  }
}));

let requestHandler;
let responseHandler;
let fetchMock;

beforeAll(() => {
  window.Request = class Request {};
  fetchMock = jest.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ token: 'test-csrf-token' })
  });
  window.fetch = fetchMock;
  require('./csrfProtection');
  requestHandler = axios.interceptors.request.use.mock.calls[0][0];
  responseHandler = axios.interceptors.response.use.mock.calls[0][0];
});

beforeEach(() => {
  responseHandler({ config: { url: '/api/logout' } });
  fetchMock.mockClear();
  fetchMock.mockResolvedValue({
    ok: true, status: 200, json: async () => ({ token: 'test-csrf-token' })
  });
});

test('login and customer upload do not fetch a session CSRF token', async () => {
  for (const url of ['/api/numplateapp/login', '/api/numplateapp/passkeys/login/options',
    '/api/numplateapp/passkeys/login/verify', '/api/numplateapp/id-card']) {
    await requestHandler({ url, method: 'post' });
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

test('each login method clears cached token and protected app writes still require one', async () => {
  const config = { url: '/api/numplateapp/offline/list', method: 'post' };
  expect((await requestHandler(config)).headers['X-CSRF-TOKEN']).toBe('test-csrf-token');
  await requestHandler(config);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  for (const url of ['/api/numplateapp/login', '/api/numplateapp/passkeys/login/verify']) {
    responseHandler({ config: { url } });
    await requestHandler(config);
  }
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
