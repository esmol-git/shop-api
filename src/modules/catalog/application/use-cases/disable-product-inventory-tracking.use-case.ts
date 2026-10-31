import { Inject, Injectable } from '@nestjs/common';

import type { ProductRepository } from
  '../ports/product.repository.js';
import { PRODUCT_REPOSITORY } from
  '../ports/product.repository.js';

@Injectable()
export class DisableProductInventoryTrackingUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(input: {
    id: string;
  }): Promise<boolean> {
    return this.productRepository.disableInventoryTracking(
      input.id,
    );
  }
}