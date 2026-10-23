import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import { AppError } from '../errors.js';
import { authenticate } from '../middleware.js';

const EMAIL = '^[^@\\s]+@[^@\\s]+\\.[a-zA-Z]{2,}$';
const BCRYPT_ROUNDS = 12;
// Jämförs mot när e-posten inte finns, så svarstiden inte avslöjar vilka konton som finns
const DUMMY_HASH = bcrypt.hashSync('dummy-password', BCRYPT_ROUNDS);
// Hårdare gräns på inloggning och registrering än den globala
const authRateLimit = { rateLimit: { max: 5, timeWindow: '1 minute' } };

// Refresh token sparas hashad i databasen, så en databasläcka inte ger giltiga tokens
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function createTokens(user) {
  const payload = { id: user._id.toString() };

  return {
    // Kort livslängd — skickas med i varje request och är därför mest utsatt
    accessToken: jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES || '15m',
    }),
    // Lång livslängd — skickas bara hit, och sparas hashad i databasen så den går att återkalla
    // jwtid gör varje refresh token unik, även om två skapas samma sekund
    refreshToken: jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      algorithm: 'HS256',
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES || '7d',
      jwtid: crypto.randomUUID(),
    }),
  };
}

export default async function authRoutes(fastify) {
  fastify.post(
    '/register',
    {
      config: authRateLimit,
      schema: {
        body: {
          type: 'object',
          required: ['username', 'email', 'password'],
          additionalProperties: false,
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 30, pattern: '^[a-zA-Z0-9_]+$' },
            email: { type: 'string', maxLength: 254, pattern: EMAIL },
            // bcrypt använder bara de första 72 byten
            password: { type: 'string', minLength: 8, maxLength: 72 },
          },
        },
      },
    },
    async (request, reply) => {
      const { username, email, password } = request.body;

      const exists = await User.findOne({ $or: [{ email }, { username }] });
      if (exists) throw new AppError(409, 'USER_EXISTS', 'E-post eller användarnamn används redan');

      const user = await User.create({
        username,
        email,
        password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      });

      return reply.code(201).send({ data: user });
    }
  );

  fastify.post(
    '/login',
    {
      config: authRateLimit,
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          additionalProperties: false,
          properties: {
            email: { type: 'string', maxLength: 254, pattern: EMAIL },
            password: { type: 'string', minLength: 1, maxLength: 72 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await User.findOne({ email });
      // Samma felmeddelande oavsett vad som var fel, så ingen kan kartlägga vilka konton som finns
      const valid = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
      if (!user || !valid) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Fel e-post eller lösenord');
      }

      const tokens = createTokens(user);
      user.refreshToken = hashToken(tokens.refreshToken);
      await user.save();

      return reply.code(200).send({ data: { user, ...tokens } });
    }
  );

  fastify.post(
    '/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          additionalProperties: false,
          properties: { refreshToken: { type: 'string', minLength: 10, maxLength: 1000 } },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body;

      let payload;
      try {
        payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
      } catch {
        throw new AppError(401, 'INVALID_TOKEN', 'Ogiltig eller utgången refresh token');
      }

      const user = await User.findById(payload.id);
      if (!user) throw new AppError(401, 'INVALID_TOKEN', 'Refresh token är inte längre giltig');

      // Måste vara den token vi delade ut senast. En äldre, redan använd token tyder på
      // att den stulits, så då loggas användaren ut överallt (reuse detection).
      if (user.refreshToken !== hashToken(refreshToken)) {
        user.refreshToken = null;
        await user.save();
        throw new AppError(401, 'INVALID_TOKEN', 'Refresh token är inte längre giltig');
      }

      // Rotation: varje refresh token kan bara användas en gång
      const tokens = createTokens(user);
      user.refreshToken = hashToken(tokens.refreshToken);
      await user.save();

      return reply.code(200).send({ data: tokens });
    }
  );

  fastify.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    await User.findByIdAndUpdate(request.user.id, { refreshToken: null });
    return reply.code(204).send();
  });

  fastify.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const user = await User.findById(request.user.id);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Användaren hittades inte');
    return reply.code(200).send({ data: user });
  });
}
