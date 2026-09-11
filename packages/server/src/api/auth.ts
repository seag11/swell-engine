import type { FastifyInstance } from 'fastify';
import { config, SESSION_TTL_SECONDS } from '../config.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: string };
    user: { sub: string; role: string; iss: string };
  }
}

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: config.cookieSecure,
  path: '/',
};

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { token: string } }>(
    '/api/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string' } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (!config.authEnabled) {
        return reply.status(404).send({ error: 'Not found' });
      }

      const { token } = request.body;
      const now = new Date();

      const match = config.betaTokens.find(
        (t) => t.token === token && (!t.expiresAt || new Date(t.expiresAt) > now),
      );

      if (!match) {
        return reply.status(401).send({ error: 'Invalid or expired token' });
      }

      const jwt = app.jwt.sign({ sub: match.sub, role: match.role });

      reply.setCookie('swell_session', jwt, {
        ...sessionCookieOptions,
        maxAge: SESSION_TTL_SECONDS,
      });

      return { ok: true, role: match.role };
    },
  );

  app.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie('swell_session', sessionCookieOptions);
    return { ok: true };
  });

  app.get('/api/auth/me', async (request, reply) => {
    if (!config.authEnabled) {
      return { sub: 'dev', role: 'owner' };
    }
    try {
      const payload = await request.jwtVerify<{ sub: string; role: string }>();
      return { sub: payload.sub, role: payload.role };
    } catch {
      return reply.status(401).send({ error: 'Unauthenticated' });
    }
  });
}
