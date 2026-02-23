export type HttpStatus = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 500 | 503;

const HTTP_STATUS_SET = new Set<HttpStatus>([
  200, 201, 400, 401, 403, 404, 409, 413, 415, 429, 500, 503,
]);

export const toHttpStatus = (status: number, fallback: HttpStatus = 500): HttpStatus => {
  return HTTP_STATUS_SET.has(status as HttpStatus) ? (status as HttpStatus) : fallback;
};
