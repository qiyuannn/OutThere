import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePostgrestError,
  getErrorMessage,
  getErrorCode,
  getErrorDetails,
  getErrorHint,
  isPostgrestError,
  isUniqueViolation,
  isCheckViolation,
  isForeignKeyViolation,
  isRlsOrPrivilegeViolation,
  isNoRowsError,
  AppError,
  POSTGRES_ERROR_CODES,
  POSTGREST_ERROR_CODES,
} from '../src/lib/errors.ts';

test('normalizePostgrestError handles standard PostgREST error objects', () => {
  const postgrestErr = {
    message: 'duplicate key value violates unique constraint "users_username_key"',
    details: 'Key (username)=(testuser) already exists.',
    hint: 'Choose a different username.',
    code: '23505',
  };

  const normalized = normalizePostgrestError(postgrestErr);
  assert.equal(normalized.message, 'duplicate key value violates unique constraint "users_username_key"');
  assert.equal(normalized.code, '23505');
  assert.equal(normalized.details, 'Key (username)=(testuser) already exists.');
  assert.equal(normalized.hint, 'Choose a different username.');
});

test('normalizePostgrestError handles standard JS Error instances', () => {
  const err = new Error('Database connection failed');
  const normalized = normalizePostgrestError(err);
  assert.equal(normalized.message, 'Database connection failed');
  assert.equal(normalized.code, undefined);
  assert.equal(normalized.details, undefined);
  assert.equal(normalized.hint, undefined);
});

test('normalizePostgrestError handles custom AppError instances with metadata', () => {
  const err = new AppError('Permission denied', {
    code: '42501',
    details: 'RLS policy violated',
    hint: 'Check policy public.users',
  });
  const normalized = normalizePostgrestError(err);
  assert.equal(normalized.message, 'Permission denied');
  assert.equal(normalized.code, '42501');
  assert.equal(normalized.details, 'RLS policy violated');
  assert.equal(normalized.hint, 'Check policy public.users');
});

test('normalizePostgrestError handles raw string errors', () => {
  const normalized = normalizePostgrestError('Network timeout');
  assert.equal(normalized.message, 'Network timeout');
  assert.equal(normalized.code, undefined);
});

test('normalizePostgrestError handles null, undefined, and non-object errors with fallback', () => {
  assert.equal(normalizePostgrestError(null).message, 'An unexpected error occurred.');
  assert.equal(normalizePostgrestError(undefined).message, 'An unexpected error occurred.');
  assert.equal(normalizePostgrestError(123).message, 'An unexpected error occurred.');
  assert.equal(normalizePostgrestError(null, 'Custom fallback').message, 'Custom fallback');
});

test('normalizePostgrestError extracts error_description or error if message is absent', () => {
  assert.equal(
    normalizePostgrestError({ error_description: 'OAuth grant expired' }).message,
    'OAuth grant expired'
  );
  assert.equal(
    normalizePostgrestError({ error: 'invalid_client' }).message,
    'invalid_client'
  );
});

test('getErrorCode safely extracts error codes from various shapes', () => {
  assert.equal(getErrorCode({ code: '23505' }), '23505');
  assert.equal(getErrorCode({ code: 42501 }), '42501');
  assert.equal(getErrorCode(new Error('test')), null);
  assert.equal(getErrorCode(null), null);
  assert.equal(getErrorCode(undefined), null);
  assert.equal(getErrorCode('random string'), null);
  assert.equal(getErrorCode({ code: '' }), null);
});

test('getErrorMessage returns message or fallback safely', () => {
  assert.equal(getErrorMessage(new Error('Failed to save')), 'Failed to save');
  assert.equal(getErrorMessage({ message: 'Server error' }), 'Server error');
  assert.equal(getErrorMessage(null, 'Fallback msg'), 'Fallback msg');
  assert.equal(getErrorMessage('', 'Fallback msg'), 'Fallback msg');
  assert.equal(getErrorMessage('Explicit failure', 'Fallback'), 'Explicit failure');
});

test('predicates correctly identify Postgres & PostgREST error types', () => {
  assert.equal(isUniqueViolation({ code: '23505' }), true);
  assert.equal(isUniqueViolation({ code: '23514' }), false);

  assert.equal(isCheckViolation({ code: '23514' }), true);
  assert.equal(isCheckViolation({ code: '23505' }), false);

  assert.equal(isForeignKeyViolation({ code: '23503' }), true);
  assert.equal(isForeignKeyViolation({ code: '23505' }), false);

  assert.equal(isRlsOrPrivilegeViolation({ code: '42501' }), true);
  assert.equal(isRlsOrPrivilegeViolation(new Error('err')), false);

  assert.equal(isNoRowsError({ code: 'PGRST116' }), true);
  assert.equal(isNoRowsError({ code: '23505' }), false);

  assert.equal(isPostgrestError({ message: 'm', details: 'd', hint: 'h', code: 'c' }), true);
  assert.equal(isPostgrestError({ name: 'PostgrestError', message: 'm' }), true);
  assert.equal(isPostgrestError(new Error('plain')), false);
});
