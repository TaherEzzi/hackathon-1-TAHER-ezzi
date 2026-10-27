/** Typed HTTP failure for route handlers (status + machine code). */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function unauthorized(): never {
  throw new HttpError("unauthorized", 401, "unauthorized");
}

export function isUnauthorized(error: unknown): error is HttpError {
  return error instanceof HttpError && error.status === 401;
}
