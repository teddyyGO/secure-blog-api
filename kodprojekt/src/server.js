import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { connectDB } from './db.js';
import { sanitize } from './middleware.js';
import { errorHandler, notFoundHandler } from './errors.js';
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import commentRoutes from './routes/comments.js';

// Stanna direkt om något känsligt saknas istället för att köra med osäkra defaults
for (const key of ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
  if (!process.env[key]) {
    console.error(`Saknar miljövariabeln ${key}. Kopiera .env.example till .env.`);
    process.exit(1);
  }
}

// Samma hemlighet för båda hade gjort att en refresh token godkänns som access token
if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
  console.error('JWT_ACCESS_SECRET och JWT_REFRESH_SECRET måste vara olika.');
  process.exit(1);
}
for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
  if (process.env[key].length < 32) {
    console.error(`${key} måste vara minst 32 tecken lång.`);
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production' && process.env[key].includes('byt-ut-mig')) {
    console.error(`${key} är fortfarande platshållaren från .env.example.`);
    process.exit(1);
  }
}

const app = Fastify({ logger: true });

// Säkerhet: security headers, tillåtna origins och tak för antal requests
await app.register(helmet);
await app.register(cors, {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false,
});
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

// Tillåter requests utan body, t.ex. POST /auth/logout
app.addContentTypeParser('*', (request, payload, done) => done(null, null));

app.addHook('preValidation', sanitize);
app.setErrorHandler(errorHandler);
app.setNotFoundHandler(notFoundHandler);

app.get('/', async (request, reply) => {
  return reply.code(200).send({ data: { message: 'Blog API', version: 'v1' } });
});

await app.register(authRoutes, { prefix: '/api/v1/auth' });
await app.register(postRoutes, { prefix: '/api/v1/posts' });
await app.register(commentRoutes, { prefix: '/api/v1/comments' });

try {
  await connectDB();
  await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
