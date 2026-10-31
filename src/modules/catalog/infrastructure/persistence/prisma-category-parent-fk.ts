import { Prisma } from
  '../../../../generated/prisma/client.js';

const CATEGORY_PARENT_FK_CONSTRAINT = 'categories_parentId_fkey';

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

/**
 * P2003 → parent-not-found только для FK categories.parentId.
 * Контракт вызова: только из `PrismaCategoryRepository.add`.
 */
export function isCategoryParentForeignKeyError(
  error: unknown,
): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== 'P2003') {
    return false;
  }

  const meta = error.meta as Record<string, unknown> | undefined;
  const constraint = readConstraintName(meta);

  if (constraint !== null) {
    return constraint === CATEGORY_PARENT_FK_CONSTRAINT;
  }

  const fieldName =
    readMetaString(meta, 'field_name')
    ?? readMetaString(meta, 'fieldName');

  return fieldName === 'parentId';
}
