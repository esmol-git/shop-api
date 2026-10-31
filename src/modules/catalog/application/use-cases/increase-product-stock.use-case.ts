import { Inject, Injectable } from '@nestjs/common';

import {
  STOCK_MOVEMENT_REPOSITORY,
  type IncreaseStockOnceInput,
  type StockMovementRepository,
} from '../ports/stock-movement.repository.js';

import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../ports/product.repository.js';

export type IncreaseProductStockResult =
  | 'applied'
  | 'replayed'
  | 'key-conflict'
  | 'not-found'
  | 'inventory-disabled'
  | 'limit-exceeded';

@Injectable()
export class IncreaseProductStockUseCase {
  constructor(
    @Inject(STOCK_MOVEMENT_REPOSITORY)
    private readonly stockMovementRepository:
      StockMovementRepository,

    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository:
      Pick<ProductRepository, 'findById'>,
  ) {}

  async execute(
    input: IncreaseStockOnceInput,
  ): Promise<IncreaseProductStockResult> {
    const result =
      await this.stockMovementRepository.increaseStockOnce(
        input,
      );

    if (result !== 'rejected') {
      return result;
    }

    const product = await this.productRepository.findById(
      input.productId,
    );

    if (product === null) {
      return 'not-found';
    }

    if (!product.inventoryTracked) {
      return 'inventory-disabled';
    }

    return 'limit-exceeded';
  }
}
