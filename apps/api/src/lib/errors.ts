export class ApiFailure extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly retryable = false) {
    super(message);
  }
}

export function errorResponse(error: unknown): Response {
  const failure = error instanceof ApiFailure ? error : new ApiFailure(500, "INTERNAL_ERROR", "Wandr could not complete this request.");
  return Response.json({ error: { code: failure.code, message: failure.message, retryable: failure.retryable } }, { status: failure.status });
}
