/**
 * Centralized error parsing, extraction, and normalization utilities.
 * Handles Supabase PostgrestError, AuthApiError, FunctionsError,
 * standard Error instances, and arbitrary runtime error objects.
 *
 * Pure TypeScript, zero external runtime dependencies.
 */

export interface NormalizedError {
  /** User-safe or descriptive error message */
  message: string;
  /** Error code (PostgreSQL SQLSTATE, PostgREST PGRSTxxx, or application error code) */
  code?: string;
  /** Detailed technical error context when provided by the backend */
  details?: string;
  /** Actionable guidance or hint provided by Postgres/PostgREST */
  hint?: string;
}

/**
 * Standard PostgreSQL SQLSTATE error codes commonly encountered.
 */
export const POSTGRES_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  NOT_NULL_VIOLATION: '23502',
  INSUFFICIENT_PRIVILEGE: '42501',
} as const;

/**
 * Standard PostgREST error codes commonly encountered.
 */
export const POSTGREST_ERROR_CODES = {
  NO_ROWS_RETURNED: 'PGRST116',
} as const;

/**
 * Safely extracts an error code from an unknown error object.
 * Returns null if no valid code is present.
 */
export function getErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const raw = (error as { code: unknown }).code;
    if (raw != null && raw !== '') {
      return String(raw);
    }
  }
  return null;
}

/**
 * Safely extracts error details from an unknown error object.
 * Returns null if no valid details string is present.
 */
export function getErrorDetails(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'details' in error) {
    const raw = (error as { details: unknown }).details;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return null;
}

/**
 * Safely extracts an error hint from an unknown error object.
 * Returns null if no valid hint string is present.
 */
export function getErrorHint(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'hint' in error) {
    const raw = (error as { hint: unknown }).hint;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return null;
}


/**
 * Safely extracts an error message from an unknown error object, falling back
 * to a provided default string.
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'An unexpected error occurred.'
): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;

    if (typeof obj.message === 'string' && obj.message.trim().length > 0) {
      return obj.message.trim();
    }
    if (typeof obj.error_description === 'string' && obj.error_description.trim().length > 0) {
      return obj.error_description.trim();
    }
    if (typeof obj.error === 'string' && obj.error.trim().length > 0) {
      return obj.error.trim();
    }
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }

  return fallback;
}

/**
 * Normalizes any error object (PostgrestError, AuthError, Error, or arbitrary object)
 * into a structured NormalizedError shape.
 */
export function normalizePostgrestError(
  error: unknown,
  fallbackMessage = 'An unexpected error occurred.'
): NormalizedError {
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;

    const code = getErrorCode(error) ?? undefined;
    const details = typeof obj.details === 'string' && obj.details.trim().length > 0
      ? obj.details.trim()
      : undefined;
    const hint = typeof obj.hint === 'string' && obj.hint.trim().length > 0
      ? obj.hint.trim()
      : undefined;

    const message = getErrorMessage(error, fallbackMessage);

    return {
      message,
      code,
      details,
      hint,
    };
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return {
      message: error.trim(),
    };
  }

  return {
    message: fallbackMessage,
  };
}

/**
 * Type predicate to check if an unknown error matches PostgREST error structure.
 */
export function isPostgrestError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const obj = error as Record<string, unknown>;
  return (
    ('name' in obj && obj.name === 'PostgrestError') ||
    ('code' in obj && 'details' in obj && 'hint' in obj && 'message' in obj)
  );
}

/**
 * Predicate checking whether the error is a PostgreSQL unique constraint violation (23505).
 */
export function isUniqueViolation(error: unknown): boolean {
  return getErrorCode(error) === POSTGRES_ERROR_CODES.UNIQUE_VIOLATION;
}

/**
 * Predicate checking whether the error is a PostgreSQL check constraint violation (23514).
 */
export function isCheckViolation(error: unknown): boolean {
  return getErrorCode(error) === POSTGRES_ERROR_CODES.CHECK_VIOLATION;
}

/**
 * Predicate checking whether the error is a PostgreSQL foreign key violation (23503).
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return getErrorCode(error) === POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION;
}

/**
 * Predicate checking whether the error is a PostgreSQL RLS or insufficient privilege error (42501).
 */
export function isRlsOrPrivilegeViolation(error: unknown): boolean {
  return getErrorCode(error) === POSTGRES_ERROR_CODES.INSUFFICIENT_PRIVILEGE;
}

/**
 * Predicate checking whether the error represents a PostgREST PGRST116 (0 rows returned) error.
 */
export function isNoRowsError(error: unknown): boolean {
  return getErrorCode(error) === POSTGREST_ERROR_CODES.NO_ROWS_RETURNED;
}

/**
 * Application error class with optional code, details, and hint.
 */
export class AppError extends Error {
  readonly code?: string;
  readonly details?: string;
  readonly hint?: string;

  constructor(
    message: string,
    options?: {
      code?: string;
      details?: string;
      hint?: string;
      cause?: unknown;
    }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = options?.code;
    this.details = options?.details;
    this.hint = options?.hint;
  }
}
