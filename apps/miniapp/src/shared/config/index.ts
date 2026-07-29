/** Public runtime configuration. The API origin is a build-time constant so no
 * environment-specific value is committed (see config/env.ts). */
export const config = Object.freeze({
  apiBaseUrl: OPENTRIP_API_BASE_URL,
});
