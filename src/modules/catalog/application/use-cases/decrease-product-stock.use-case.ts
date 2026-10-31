import { Inject, Injectable } from '@nestjs/common';

import {
  STOCK_MOVEMENT_REPOSITORY,
  type DecreaseStockOnceInput,
  type StockMovementRepository,
} from '../ports/stock-movement.repository.js';

import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../ports/product.repository.js';

export type DecreaseProductStockResult =
  | 'applied'
  | 'replayed'
  | 'key-conflict'
  | 'not-found'
  | 'inventory-disabled'
  | 'insufficient-stock';

@Injectable()
export class DecreaseProductStockUseCase {
  constructor(
    @Inject(STOCK_MOVEMENT_REPOSITORY)
    private readonly stockMovementRepository:
      StockMovementRepository,

    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository:
      Pick<ProductRepository, 'findById'>,
  ) {}

  async execute(
    input: DecreaseStockOnceInput,
  ): Promise<DecreaseProductStockResult> {
    const result =
      await this.stockMovementRepository.decreaseStockOnce(
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

    return 'insufficient-stock';
  }
}
