import { badRequest } from '../errors.js';

// validate({ body, query, params }) with zod schemas; parsed values replace the originals
// (req.query is read-only in Express 5, so parsed query goes to req.valid.query).
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = {};
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
        return next(badRequest('validation_failed', details[0]?.message ?? 'Invalid request', details));
      }
      req.valid[part] = result.data;
    }
    next();
  };
}
