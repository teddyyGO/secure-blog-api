export class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function send(reply, status, code, message, details) {
  const body = { error: { code, message } };
  if (details) body.error.details = details;
  return reply.code(status).send(body);
}

// Alla fel i API:et går igenom den här och får samma format
export function errorHandler(err, request, reply) {
  if (err.validation) {
    const details = err.validation.map((v) => ({
      field: v.instancePath.replace('/', '') || v.params?.missingProperty || 'body',
      message: v.message,
    }));
    return send(reply, 400, 'VALIDATION_ERROR', 'Valideringsfel i förfrågan', details);
  }

  if (err instanceof AppError) return send(reply, err.statusCode, err.code, err.message);
  if (err.name === 'CastError') return send(reply, 400, 'INVALID_ID', 'Ogiltigt ID-format');
  if (err.code === 11000) return send(reply, 409, 'DUPLICATE_KEY', 'Värdet används redan');
  if (err.statusCode && err.statusCode < 500) {
    return send(reply, err.statusCode, err.code || 'BAD_REQUEST', err.message);
  }

  // Okänt fel: logga internt, visa inget för klienten
  request.log.error(err);
  return send(reply, 500, 'INTERNAL_ERROR', 'Något gick fel på servern');
}

export function notFoundHandler(request, reply) {
  return send(reply, 404, 'ROUTE_NOT_FOUND', `Route ${request.method} ${request.url} finns inte`);
}
