import {Request, Response} from 'express';
import {signAccessToken} from '../../auth/jwt';
import {optionalAuth, requireAuth} from '../../auth/middleware';

function mockReq(headers: Record<string, string> = {}): Request {
  return {headers, authUser: undefined} as any;
}

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('optionalAuth', () => {
  it('sets req.authUser when a valid Bearer token is provided', () => {
    const token = signAccessToken({userId: 'u1', email: 'a@b.com', displayName: 'Alice'});
    const req = mockReq({authorization: `Bearer ${token}`});
    const next = jest.fn();
    optionalAuth(req, mockRes(), next);
    expect(req.authUser).toBeDefined();
    expect(req.authUser!.userId).toBe('u1');
  });

  it('does not set req.authUser when no Authorization header is present', () => {
    const req = mockReq();
    const next = jest.fn();
    optionalAuth(req, mockRes(), next);
    expect(req.authUser).toBeUndefined();
  });

  it('does not set req.authUser when Authorization header is not Bearer format', () => {
    const req = mockReq({authorization: 'Basic abc123'});
    const next = jest.fn();
    optionalAuth(req, mockRes(), next);
    expect(req.authUser).toBeUndefined();
  });

  it('does not set req.authUser when token is invalid', () => {
    const req = mockReq({authorization: 'Bearer invalid-token'});
    const next = jest.fn();
    optionalAuth(req, mockRes(), next);
    expect(req.authUser).toBeUndefined();
  });

  it('always calls next() regardless of auth state', () => {
    const next1 = jest.fn();
    optionalAuth(mockReq(), mockRes(), next1);
    expect(next1).toHaveBeenCalledTimes(1);

    const token = signAccessToken({userId: 'u1', email: null, displayName: null});
    const next2 = jest.fn();
    optionalAuth(mockReq({authorization: `Bearer ${token}`}), mockRes(), next2);
    expect(next2).toHaveBeenCalledTimes(1);

    const next3 = jest.fn();
    optionalAuth(mockReq({authorization: 'Bearer bad'}), mockRes(), next3);
    expect(next3).toHaveBeenCalledTimes(1);
  });
});

describe('requireAuth', () => {
  it('calls next() when a valid Bearer token is provided', () => {
    const token = signAccessToken({userId: 'u1', email: 'a@b.com', displayName: 'Alice'});
    const req = mockReq({authorization: `Bearer ${token}`});
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when no Authorization header is present', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', () => {
    const req = mockReq({authorization: 'Bearer bad-token'});
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.authUser when token is valid', () => {
    const token = signAccessToken({userId: 'u42', email: 'x@y.com', displayName: 'Bob'});
    const req = mockReq({authorization: `Bearer ${token}`});
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(req.authUser).toBeDefined();
    expect(req.authUser!.userId).toBe('u42');
  });

  it('responds with {error: "Authentication required"} on 401', () => {
    const req = mockReq();
    const res = mockRes();
    requireAuth(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({error: 'Authentication required'});
  });
});
