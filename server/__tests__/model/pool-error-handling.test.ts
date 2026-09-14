const mockLoggerWarn = jest.fn();
const mockCaptureException = jest.fn();
jest.mock('@sentry/node', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  logger: {warn: (...args: unknown[]) => mockLoggerWarn(...args)},
}));

// The real module, not the __mocks__ stand-in: the point is to verify the
// listeners this file registers on the actual pg.Pool instances. Constructing a
// Pool does not open a connection, so no database is needed here.
import {pool, readPool} from '../../model/pool';

describe('pool idle-client error handling', () => {
  beforeEach(() => jest.clearAllMocks());

  // pg.Pool extends EventEmitter, and Node throws on an 'error' event with no
  // listener. pg-pool emits one per pooled connection when Postgres drops an
  // idle client (restart, failover, network blip), so an unlistened pool takes
  // the whole server down during an event it could otherwise ride out.
  it.each([
    ['pool', () => pool],
    ['readPool', () => readPool],
  ])('%s has an error listener so a dropped idle connection cannot crash the process', (_name, getPool) => {
    const target = getPool();
    expect(target.listenerCount('error')).toBeGreaterThan(0);
    expect(() => target.emit('error', new Error('connection terminated unexpectedly'))).not.toThrow();
  });

  it('logs the drop rather than capturing it, so a failover is not an Issue storm', () => {
    pool.emit('error', new Error('connection terminated unexpectedly'));

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('idle DB connection dropped'),
      expect.objectContaining({pool: 'pool'})
    );
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
