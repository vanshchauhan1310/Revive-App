export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message ?? code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code, message, details) => new HttpError(400, code, message, details);
export const notFound = (code = 'not_found', message = 'Not found') => new HttpError(404, code, message);
export const forbidden = (code = 'forbidden', message = 'Not allowed') => new HttpError(403, code, message);

// Stable error codes raised by the database RPCs (see supabase/migrations/*_functions.sql).
const DB_ERRORS = {
  not_authenticated: [401, 'Please sign in again.'],
  forbidden: [403, 'You are not allowed to do that.'],
  blocked: [403, 'You cannot interact with this user.'],
  order_not_found: [404, 'Exchange not found.'],
  chat_not_found: [404, 'Conversation not found.'],
  listing_unavailable: [409, 'This item is no longer available.'],
  already_requested: [409, 'You already have an open request for this item.'],
  already_completed: [409, 'This exchange is already completed.'],
  invalid_transition: [409, 'This exchange cannot do that right now.'],
  insufficient_credits: [409, 'Not enough available credits.'],
  cannot_request_own_listing: [400, 'You cannot request your own item.'],
  invalid_amount: [400, 'Enter a whole number of credits between 1 and 100000.'],
  invalid_recipient: [400, 'That recipient is not valid.'],
  invalid_reason: [400, 'Invalid reason.'],
  idempotency_key_required: [400, 'Missing idempotency key.'],
};

export function fromDbError(error) {
  const code = Object.keys(DB_ERRORS).find((k) => error?.message?.includes(k));
  if (code) {
    const [status, message] = DB_ERRORS[code];
    return new HttpError(status, code, message);
  }
  if (error?.code === '23505') return new HttpError(409, 'conflict', 'That already exists.');
  if (error?.code === '42501') return new HttpError(403, 'forbidden', 'You are not allowed to do that.');
  const err = new HttpError(500, 'database_error', 'Something went wrong. Please try again.');
  err.cause = error;
  return err;
}

// Unwraps a supabase-js { data, error } result.
export function unwrap({ data, error }) {
  if (error) throw fromDbError(error);
  return data;
}

export function errorHandler(logger) {
  return (err, req, res, _next) => {
    if (err?.type === 'entity.parse.failed') err = badRequest('invalid_json', 'Request body is not valid JSON.');
    if (err?.type === 'entity.too.large') err = new HttpError(413, 'payload_too_large', 'Request is too large.');
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) (req.log ?? logger).error({ err, cause: err.cause }, 'request failed');
    res.status(status).json({
      error: {
        code: err instanceof HttpError ? err.code : 'internal_error',
        message: status >= 500 && !(err instanceof HttpError) ? 'Something went wrong.' : err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  };
}
