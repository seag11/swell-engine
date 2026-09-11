import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!config.authEnabled) return;
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: 'Unauthenticated' });
  }
}
