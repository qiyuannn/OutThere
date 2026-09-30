/**
 * Unwraps a PostgREST relationship that may be returned as a single entity,
 * an array of entities, null, or undefined.
 *
 * If given an array, returns the first element or null if empty.
 * If given an object, returns the object.
 * If given null or undefined, returns null.
 */
export function unwrapSingleRelation<T>(
  relation: T | T[] | readonly T[] | null | undefined
): T | null {
  if (Array.isArray(relation)) {
    return (relation[0] as T) ?? null;
  }
  return (relation as T | null) ?? null;
}
