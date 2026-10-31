import { Injectable } from '@nestjs/common';

import { StockQuantity } from
  '../../domain/value-objects/stock-quantity.js';

import { PrismaService } from
  '../../../../infrastructure/database/prisma/prisma.service.js';

import { Prisma } from
  '../../../../generated/prisma/client.js';

import type {
  DecreaseStockOnceInput,
  DecreaseStockOnceResult,
  IncreaseStockOnceInput,
  IncreaseStockOnceResult,
  StockMovementRepository,
} from '../../application/ports/stock-movement.repository.js';

import { isStockMovementProductForeignKeyError } from
  './prisma-foreign-key.js';

class StockIncreaseRejectedError extends Error {}
class StockDecreaseRejectedError extends Error {}

@Injectable()
export class PrismaStockMovementRepository
  implements StockMovementRepository
{
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async decreaseStockOnce(
    input: DecreaseStockOnceInput,
  ): Promise<DecreaseStockOnceResult> {
    const {
      idempotencyKey,
      productId,
      quantity,
    } = input;

    try {
      return await this.prisma.$transaction(
        async (tx): Promise<DecreaseStockOnceResult> => {
          await tx.stockMovement.create({
            data: {
              idempotencyKey,
              productId,
              direction: 'DECREASE',
              quantity: quantity.value,
            },
          });

          const result = await tx.product.updateMany({
            where: {
              id: productId,
              stockQuantity: {
                not: null,
                gte: quantity.value,
              },
            },
            data: {
              stockQuantity: {
                decrement: quantity.value,
              },
              updatedAt: new Date(),
            },
          });

          if (result.count !== 1) {
            throw new StockDecreaseRejectedError();
          }

          return 'applied';
        },
      );
    } catch (error) {
      if (error instanceof StockDecreaseRejectedError) {
        return 'rejected';
      }

      if (isStockMovementProductForeignKeyError(error)) {
        return 'rejected';
      }

      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }

      const existing = await this.prisma.stockMovement.findUnique({
        where: {
          idempotencyKey,
        },
      });

      if (existing === null) {
        throw error;
      }

      const sameOperation =
        existing.productId === productId &&
        existing.direction === 'DECREASE' &&
        existing.quantity === quantity.value;

      return sameOperation
        ? 'replayed'
        : 'key-conflict';
    }
  }

  async increaseStockOnce(
    input: IncreaseStockOnceInput,
  ): Promise<IncreaseStockOnceResult> {
    const {
      idempotencyKey,
      productId,
      quantity,
    } = input;

    try {
      return await this.prisma.$transaction(
        async (tx): Promise<IncreaseStockOnceResult> => {
          await tx.stockMovement.create({
            data: {
              idempotencyKey,
              productId,
              direction: 'INCREASE',
              quantity: quantity.value,
            },
          });

          const result = await tx.product.updateMany({
            where: {
              id: productId,
              stockQuantity: {
                not: null,
                lte: StockQuantity.MAX_VALUE - quantity.value,
              },
            },
            data: {
              stockQuantity: {
                increment: quantity.value,
              },
              updatedAt: new Date(),
            },
          });

          if (result.count !== 1) {
            throw new StockIncreaseRejectedError();
          }

          return 'applied';
        },
      );
    } catch (error) {
      if (error instanceof StockIncreaseRejectedError) {
        return 'rejected';
      }

      if (isStockMovementProductForeignKeyError(error)) {
        return 'rejected';
      }

      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }

      const existing = await this.prisma.stockMovement.findUnique({
        where: {
          idempotencyKey,
        },
      });

      if (existing === null) {
        throw error;
      }

      const sameOperation =
        existing.productId === productId &&
        existing.direction === 'INCREASE' &&
        existing.quantity === quantity.value;

      return sameOperation
        ? 'replayed'
        : 'key-conflict';
    }
  }
}
