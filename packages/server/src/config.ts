export const JWT_ISSUER = 'swell-engine';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface BetaToken {
  sub: string;
  role: string;
  token: string;
  expiresAt?: string;
}

function parseBetaTokens(raw: string | undefined): BetaToken[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('BETA_TOKENS must be valid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('BETA_TOKENS must be a JSON array');
  }

  return parsed.map((entry, i) => {
    const { sub, role, token, expiresAt } = (entry ?? {}) as Partial<BetaToken>;
    if (!sub || !role || !token) {
      throw new Error(`BETA_TOKENS[${i}] requires sub, role, and token`);
    }
    if (expiresAt !== undefined && Number.isNaN(Date.parse(expiresAt))) {
      throw new Error(`BETA_TOKENS[${i}] has an unparseable expiresAt: ${expiresAt}`);
    }
    return { sub, role, token, expiresAt };
  });
}

const ndbcDataTtlHours = parseInt(process.env.NDBC_DATA_TTL_HOURS ?? '6', 10);
const authEnabled = process.env.AUTH_ENABLED === 'true';

if (authEnabled && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required when AUTH_ENABLED=true');
}

export const config = {
  host: process.env.SERVER_HOST ?? '127.0.0.1',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://swell:swell@localhost:5432/swell_engine',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  ndbcDataTtlHours,
  ndbcPollIntervalMs: ndbcDataTtlHours * 60 * 60 * 1000,
  authEnabled,
  jwtSecret: process.env.JWT_SECRET || 'local-dev-jwt-placeholder',
  betaTokens: parseBetaTokens(process.env.BETA_TOKENS),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  // Unset means "work it out": the uv virtualenv locally, python3 in the image.
  pythonBin: process.env.PYTHON_BIN || undefined,
  // Set in the container, where swellkit sits beside dist rather than in the
  // monorepo layout the client resolves by default.
  swellkitSrc: process.env.SWELLKIT_SRC || undefined,
};
