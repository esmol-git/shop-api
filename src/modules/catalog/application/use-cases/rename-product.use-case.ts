import type { ProductRepository } from '../ports/product.repository.js';

import {
  toProductOutput,
  type ProductOutput,
} from '../outputs/product.output.js';

export interface RenameProductInput {
  id: string;
  name: string;
}

export class RenameProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(
    input: RenameProductInput,
  ): Promise<ProductOutput | null> {
    const product = await this.productRepository.findById(input.id);

    if (product === null) {
      return null;
    }

    product.rename(input.name);

    const updated = await this.productRepository.update(product);

    if (updated !== 'updated') {
      return null;
    }

    return toProductOutput(product);
  }
}