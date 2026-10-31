import type { ProductRepository } from '../ports/product.repository.js';

import {
  toProductOutput,
  type ProductOutput,
} from '../outputs/product.output.js';

export interface ChangeProductPriceInput {
  id: string;
  amount: number;
}

export class ChangeProductPriceUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(
    input: ChangeProductPriceInput,
  ): Promise<ProductOutput | null> {
    const product = await this.productRepository.findById(input.id);

    if (product === null) {
      return null;
    }

    product.changePrice(input.amount);

    const updated = await this.productRepository.update(product);

    if (updated !== 'updated') {
      return null;
    }

    return toProductOutput(product);
  }
}