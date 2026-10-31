import { Prisma } from
  '../../../../generated/prisma/client.js';

const PRODUCT_ID_FK_CONSTRAINT = 'stock_movements_productId_fkey';

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
 * FK violation for stock_movements.productId → products.id only.
 * Used when creating a movement for a missing product, or when deleting
 * a product that still has movements.
 */
export function isStockMovementProductForeignKeyError(
  error: unknown,
): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== 'P2003') {
    return false;
  }

  const meta = error.meta as Record<string, unknown> | undefined;

  const fieldName =
    readMetaString(meta, 'field_name')
    ?? readMetaString(meta, 'fieldName');

  if (fieldName === 'productId') {
    return true;
  }

  const constraint = readConstraintName(meta);

  if (constraint === PRODUCT_ID_FK_CONSTRAINT) {
    return true;
  }

  if (
    typeof constraint === 'string'
    && constraint.includes('productId')
  ) {
    return true;
  }

  if (
    typeof error.message === 'string'
    && error.message.includes(PRODUCT_ID_FK_CONSTRAINT)
  ) {
    return true;
  }

  return false;
}
