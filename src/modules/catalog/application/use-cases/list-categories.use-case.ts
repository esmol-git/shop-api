import type { CategoryRepository } from '../ports/category.repository.js';

import {
  toCategoryOutput,
  type CategoryOutput,
} from '../outputs/category.output.js';

export class ListCategoriesUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(): Promise<CategoryOutput[]> {
    const categories = await this.categoryRepository.findAll();

    return categories.map(toCategoryOutput);
  }
}
