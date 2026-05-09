import express from 'express';
import request from 'supertest';

describe('/api/health/email', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    jest.resetModules();
    process.env.RESEND_API_KEY = 're_test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.RESEND_API_KEY = originalApiKey;
  });

  function buildApp() {
    // Re-require the router so the in-memory cache resets between tests.
    const healthRouter = require('../../api/health').default;
    const app = express();
    app.use('/health', healthRouter);
    return app;
  }

  it('returns 200 when Resend returns success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ok: true}) as any;
    const app = buildApp();
    const res = await request(app).get('/health/email');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns 503 when Resend returns an error status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ok: false, status: 401}) as any;
    const app = buildApp();
    const res = await request(app).get('/health/email');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
  });

  it('returns 503 when Resend fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error')) as any;
    const app = buildApp();
    const res = await request(app).get('/health/email');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
  });

  it('returns 503 when RESEND_API_KEY is unset', async () => {
    delete process.env.RESEND_API_KEY;
    global.fetch = jest.fn();
    const app = buildApp();
    const res = await request(app).get('/health/email');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    // Should not have called Resend at all
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('caches the result: second request does not hit Resend', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ok: true});
    global.fetch = fetchMock as any;
    const app = buildApp();
    const res1 = await request(app).get('/health/email');
    const res2 = await request(app).get('/health/email');
    expect(res1.body.cached).toBe(false);
    expect(res2.body.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('response body contains no sensitive data', async () => {
    global.fetch = jest.fn().mockResolvedValue({ok: true}) as any;
    const app = buildApp();
    const res = await request(app).get('/health/email');
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('re_');
    expect(bodyStr).not.toContain('apiKey');
    expect(bodyStr).not.toContain('resend');
  });

  it('coalesces concurrent cache misses into a single Resend call', async () => {
    let resolveCheck: (value: {ok: boolean}) => void = () => {};
    const pending = new Promise<{ok: boolean}>((resolve) => {
      resolveCheck = resolve;
    });
    const fetchMock = jest.fn().mockReturnValue(pending);
    global.fetch = fetchMock as any;
    const app = buildApp();

    // Fire 5 concurrent requests while Resend call is pending
    const requests = Promise.all([
      request(app).get('/health/email'),
      request(app).get('/health/email'),
      request(app).get('/health/email'),
      request(app).get('/health/email'),
      request(app).get('/health/email'),
    ]);

    // Let the event loop run so all requests hit the handler
    await new Promise((r) => setImmediate(r));

    resolveCheck({ok: true});
    const responses = await requests;

    responses.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
    // Despite 5 concurrent requests, Resend was only called once
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('calls Resend /domains with Bearer auth', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ok: true});
    global.fetch = fetchMock as any;
    const app = buildApp();
    await request(app).get('/health/email');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/domains',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer /),
        }),
      })
    );
  });
});
