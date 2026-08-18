/** Backend error envelope: {code, message, details, request_id} (services/shared/errors.py). */
export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string;
}

/**
 * Extracts a human-readable message from a failed HttpClient call. Reads the
 * standard envelope's `message` first, falls back to the legacy FastAPI
 * `detail` shape (for any surface not yet on the shared envelope), then the
 * HttpErrorResponse's own message, then the caller-supplied fallback.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  return apiErrorDetail(err) || (err as { message?: string } | null)?.message || fallback;
}

/** Same envelope/legacy-shape lookup as {@link apiErrorMessage}, without a fallback. */
export function apiErrorDetail(err: unknown): string | undefined {
  const body = (err as { error?: Partial<ApiErrorEnvelope> & { detail?: string } } | null)?.error;
  const value = body?.message || body?.detail;
  return typeof value === 'string' && value.trim() ? value : undefined;
}
