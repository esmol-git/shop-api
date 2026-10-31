import { Prisma } from
  '../../../../generated/prisma/client.js';

const SLUG_UNIQUE_CONSTRAINT = 'categories_slug_key';

function readMetaString(
  meta: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = meta?.[key];

  return typeof value === 'string' ? value : null;
}

function readConstraintName(
  meta: Record<string, unknown> | undefined,
): string | null {
  const direct =
    readMetaString(meta, 'constraint')
    ?? readMetaString(meta, 'constraint_name');

  if (direct !== null) {
    return direct;
  }

  const constraint = meta?.constraint;

  if (
    constraint !== null
    && typeof constraint === 'object'
    && 'index' in constraint
    && typeof (constraint as { index: unknown }).index === 'string'
  ) {
    return (constraint as { index: string }).index;
  }

  const driverAdapterError = meta?.driverAdapterError;

  if (
    driverAdapterError !== null
    && typeof driverAdapterError === 'object'
    && 'cause' in driverAdapterError
  ) {
    const cause = (driverAdapterError as { cause?: unknown }).cause;

    if (
      cause !== null
      && typeof cause === 'object'
      && 'constraint' in cause
    ) {
      const nested = (cause as { constraint?: unknown }).constraint;

      if (typeof nested === 'string') {
        return nested;
      }

      if (
        nested !== null
        && typeof nested === 'object'
        && 'index' in nested
        && typeof (nested as { index: unknown }).index === 'string'
      ) {
        return (nested as { index: string }).index;
      }
    }
  }

  return null;
}

function isCategoryModelContext(
  meta: Record<string, unknown> | undefined,
): boolean {
  const modelName =
    readMetaString(meta, 'modelName')
    ?? readMetaString(meta, 'model');

  // Нет modelName — допустимо только если вызов из create Category
  // (единственное место использования этой функции).
  if (modelName === null) {
    return true;
  }

  return modelName === 'Category' || modelName === 'categories';
}

function isSlugOnlyTarget(target: unknown): boolean {
  if (target === 'slug') {
    return true;
  }

  return Array.isArray(target)
    && target.length === 1
    && target[0] === 'slug';
}

/**
 * P2002 → slug-taken только при подтверждённом конфликте categories.slug.
 *
 * Контракт вызова: только из `PrismaCategoryRepository.add`.
 * Нераспознанная / противоречивая meta → false (ошибка уходит наверх).
 */
export function isCategorySlugUniqueViolation(
  error: unknown,
): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== 'P2002') {
    return false;
  }

  const meta = error.meta as Record<string, unknown> | undefined;
  const constraint = readConstraintName(meta);

  if (constraint !== null) {
    return constraint === SLUG_UNIQUE_CONSTRAINT;
  }

  if (!isCategoryModelContext(meta)) {
    return false;
  }

  if (isSlugOnlyTarget(meta?.target)) {
    return true;
  }

  return false;
}
