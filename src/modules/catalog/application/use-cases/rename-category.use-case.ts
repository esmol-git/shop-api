import { CategoryName } from '../../domain/value-objects/category-name.js';
import type { CategoryRepository } from '../ports/category.repository.js';

import {
  toCategoryOutput,
  type CategoryOutput,
} from '../outputs/category.output.js';

export interface RenameCategoryInput {
  id: string;
  name?: string;
}

export type RenameCategoryResult =
  | {
      status: 'renamed';
      category: CategoryOutput;
    }
  | {
      status: 'not-found';
    };

export class RenameCategoryUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(
    input: RenameCategoryInput,
  ): Promise<RenameCategoryResult> {
    const category = await this.categoryRepository.findById(input.id);

    if (category === null) {
      return { status: 'not-found' };
    }

    if (input.name === undefined) {
      return {
        status: 'renamed',
        category: toCategoryOutput(category),
      };
    }

    const nextName = CategoryName.create(input.name).value;

    if (nextName === category.name) {
      return {
        status: 'renamed',
        category: toCategoryOutput(category),
      };
    }

    category.rename(input.name);

    const result = await this.categoryRepository.update(category);

    if (result === 'not-found') {
      return { status: 'not-found' };
    }

    return {
      status: 'renamed',
      category: toCategoryOutput(category),
    };
  }
}
