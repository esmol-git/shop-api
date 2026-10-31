import { Category } from '../../domain/category.js';
import { CATEGORY_MAX_DEPTH } from '../../domain/category-max-depth.js';
import type { CategoryRepository } from '../ports/category.repository.js';

import {
  toCategoryOutput,
  type CategoryOutput,
} from '../outputs/category.output.js';

export interface CreateCategoryInput {
  name: string;
  slug: string;
  parentId?: string | null;
}

export type CreateCategoryResult =
  | {
      status: 'created';
      category: CategoryOutput;
    }
  | {
      status: 'slug-taken';
    }
  | {
      status: 'parent-not-found';
    }
  | {
      status: 'depth-exceeded';
    };

export class CreateCategoryUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(
    input: CreateCategoryInput,
  ): Promise<CreateCategoryResult> {
    const parentId = input.parentId ?? null;

    if (parentId !== null) {
      const parentDepth = await this.categoryRepository.findDepth(parentId);

      if (parentDepth === null) {
        return { status: 'parent-not-found' };
      }

      if (parentDepth + 1 > CATEGORY_MAX_DEPTH) {
        return { status: 'depth-exceeded' };
      }
    }

    const category = Category.create(input.name, input.slug, parentId);
    const result = await this.categoryRepository.add(category);

    if (result === 'slug-taken') {
      return { status: 'slug-taken' };
    }

    if (result === 'parent-not-found') {
      return { status: 'parent-not-found' };
    }

    return {
      status: 'created',
      category: toCategoryOutput(category),
    };
  }
}
