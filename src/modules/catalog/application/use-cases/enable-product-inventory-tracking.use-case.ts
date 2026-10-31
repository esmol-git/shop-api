import { Inject, Injectable } from '@nestjs/common';

import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../ports/product.repository.js';

import type { StockQuantity } from
  '../../domain/value-objects/stock-quantity.js';

export type EnableProductInventoryTrackingResult =
  | 'enabled'
  | 'not-found'
  | 'already-tracked';

@Injectable()
export class EnableProductInventoryTrackingUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(input: {
    id: string;
    quantity: StockQuantity;
  }): Promise<EnableProductInventoryTrackingResult> {
    const enabled =
      await this.productRepository.enableInventoryTracking(
        input.id,
        input.quantity,
      );

    if (enabled) {
      return 'enabled';
    }

    const product = await this.productRepository.findById(
      input.id,
    );

    if (product === null) {
      return 'not-found';
    }

    return 'already-tracked';
  }
}