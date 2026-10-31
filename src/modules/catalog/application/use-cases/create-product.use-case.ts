import { Product } from '../../domain/product.js';
import { productSlugFallbackFromId } from
  '../../domain/slugify-product-name.js';
import type { ProductRepository } from '../ports/product.repository.js';

import {
  toProductOutput,
  type ProductOutput,
} from '../outputs/product.output.js';

export interface CreateProductInput {
  name: string;
  description?: string | null;
  slug?: string | null;
}

export type CreateProductResult =
  | {
      status: 'created';
      product: ProductOutput;
    }
  | {
      status: 'slug-taken';
    };

export class CreateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(
    input: CreateProductInput,
  ): Promise<CreateProductResult> {
    const explicitSlugProvided = typeof input.slug === 'string';

    const product = Product.create(input.name, {
      description: input.description,
      slug: input.slug,
    });

    const result = await this.productRepository.add(product);

    if (result === 'created') {
      return {
        status: 'created',
        product: toProductOutput(product),
      };
    }

    if (explicitSlugProvided) {
      return { status: 'slug-taken' };
    }

    const fallbackSlug = productSlugFallbackFromId(product.id);

    if (product.slug === fallbackSlug) {
      return { status: 'slug-taken' };
    }

    product.changeSlug(fallbackSlug);

    const retry = await this.productRepository.add(product);

    if (retry === 'slug-taken') {
      return { status: 'slug-taken' };
    }

    return {
      status: 'created',
      product: toProductOutput(product),
    };
  }
}
