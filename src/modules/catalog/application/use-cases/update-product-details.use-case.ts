import type { ProductRepository } from '../ports/product.repository.js';

import {
  toProductOutput,
  type ProductOutput,
} from '../outputs/product.output.js';

export interface UpdateProductDetailsInput {
  id: string;
  description?: string | null;
  slug?: string;
}

export type UpdateProductDetailsResult =
  | {
      status: 'updated';
      product: ProductOutput;
    }
  | {
      status: 'not-found';
    }
  | {
      status: 'slug-taken';
    };

export class UpdateProductDetailsUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(
    input: UpdateProductDetailsInput,
  ): Promise<UpdateProductDetailsResult> {
    const product = await this.productRepository.findById(input.id);

    if (product === null) {
      return { status: 'not-found' };
    }

    const hasDescription = input.description !== undefined;
    const hasSlug = input.slug !== undefined;

    if (!hasDescription && !hasSlug) {
      return {
        status: 'updated',
        product: toProductOutput(product),
      };
    }

    if (hasDescription) {
      product.changeDescription(input.description ?? null);
    }

    if (hasSlug && input.slug !== undefined) {
      product.changeSlug(input.slug);
    }

    const result = await this.productRepository.update(product);

    if (result === 'not-found') {
      return { status: 'not-found' };
    }

    if (result === 'slug-taken') {
      return { status: 'slug-taken' };
    }

    return {
      status: 'updated',
      product: toProductOutput(product),
    };
  }
}
