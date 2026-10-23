import jwt from 'jsonwebtoken';
import { AppError } from './errors.js';

// Kollar att en giltig access token skickats med i Authorization-headern
export async function authenticate(request) {
  const header = request.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Access token saknas');
  }

  try {
    request.user = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    });
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Ogiltig eller utgången access token');
  }
}

// Bara den som skapat resursen får ändra eller ta bort den
export function checkOwner(resource, request, message) {
  // author är null om användaren inte längre finns, då nekas alla
  if (resource.author?._id.toString() !== request.user.id) {
    throw new AppError(403, 'FORBIDDEN', message);
  }
}

// Tar bort MongoDB-operatorer ($gt, $ne) och HTML-taggar ur inkommande data
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);

  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) delete value[key];
      else value[key] = clean(value[key]);
    }
    return value;
  }

  if (typeof value === 'string') return value.replace(/<[^>]*>/g, '').trim();

  return value;
}

export async function sanitize(request) {
  if (request.body && typeof request.body === 'object') {
    request.body = clean(request.body);
  }
}
