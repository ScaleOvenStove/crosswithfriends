/**
 * Guards a silent failure mode in the OpenAPI annotations.
 *
 * swagger-jsdoc parses each `@openapi` JSDoc block as YAML. A malformed block —
 * most easily a duplicate key, since the schema properties are a flat map that
 * grows over time — does not throw. It logs and drops the entire path from the
 * spec, so a route just quietly disappears from /api/docs with nothing failing.
 *
 * Checking for logged errors rather than pinning a list of paths keeps this
 * general: new route files are covered the moment they are added.
 */
describe('OpenAPI spec', () => {
  function buildSpec(): {spec: {paths?: Record<string, unknown>}; errors: string[]} {
    const errors: string[] = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });
    try {
      jest.resetModules();
      return {spec: require('../swagger').swaggerSpec, errors};
    } finally {
      spy.mockRestore();
    }
  }

  it('parses every @openapi block without errors', () => {
    const {errors} = buildSpec();

    expect(errors).toEqual([]);
  });

  it('exposes the documented routes', () => {
    const {spec} = buildSpec();
    const paths = Object.keys(spec.paths ?? {});

    expect(paths.length).toBeGreaterThan(0);
    // The specific path lost to a duplicate `inProgress` key; kept as a named
    // case because it is the one this test was written for.
    expect(paths).toContain('/user-stats/{userId}');
  });
});
