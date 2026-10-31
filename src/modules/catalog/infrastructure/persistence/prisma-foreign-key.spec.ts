import { describe, expect, it } from 'vitest';

import { Prisma } from
  '../../../../generated/prisma/client.js';

import { isStockMovementProductForeignKeyError } from
  './prisma-foreign-key.js';

describe('isStockMovementProductForeignKeyError', () => {
  it('распознаёт P2003 с constraint.index от driver adapter', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint violated on the constraint: `stock_movements_productId_fkey`',
      {
        code: 'P2003',
        clientVersion: '7.10.1',
        meta: {
          modelName: 'StockMovement',
          driverAdapterError: {
            cause: {
              originalCode: '23503',
              kind: 'ForeignKeyConstraintViolation',
              constraint: {
                index: 'stock_movements_productId_fkey',
              },
            },
          },
        },
      },
    );

    expect(isStockMovementProductForeignKeyError(error)).toBe(true);
  });

  it('не маскирует другой FK constraint', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint violated',
      {
        code: 'P2003',
        clientVersion: '7.10.1',
        meta: {
          modelName: 'Other',
          constraint: {
            index: 'orders_customerId_fkey',
          },
        },
      },
    );

    expect(isStockMovementProductForeignKeyError(error)).toBe(false);
  });

  it('не маскирует ошибки без P2003', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '7.10.1',
        meta: {
          constraint: 'stock_movements_productId_fkey',
        },
      },
    );

    expect(isStockMovementProductForeignKeyError(error)).toBe(false);
  });
});
