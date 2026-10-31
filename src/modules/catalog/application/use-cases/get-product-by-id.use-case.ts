import type { ProductRepository } from '../ports/product.repository.js';

import {
  toProductOutput,
  type ProductOutput,
} from '../outputs/product.output.js';

export interface GetProductByIdInput {
  id: string;
}

export class GetProductByIdUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(
    input: GetProductByIdInput,
  ): Promise<ProductOutput | null> {
    const product = await this.productRepository.findById(input.id);

    if (product === null) {
      return null;
    }

    return toProductOutput(product);
  }
}