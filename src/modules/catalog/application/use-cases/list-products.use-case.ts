import type { ProductRepository } from '../ports/product.repository.js';

import {
  toProductOutput,
  type ProductOutput,
} from '../outputs/product.output.js';

export interface ListProductsInput {
  limit: number;
  offset: number;
}

export interface ListProductsOutput {
  items: ProductOutput[];
  total: number;
  limit: number;
  offset: number;
}

export class ListProductsUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(
    input: ListProductsInput,
  ): Promise<ListProductsOutput> {
    const page = await this.productRepository.findPage({
      limit: input.limit,
      offset: input.offset,
    });

    return {
      items: page.items.map(toProductOutput),
      total: page.total,
      limit: input.limit,
      offset: input.offset,
    };
  }
}