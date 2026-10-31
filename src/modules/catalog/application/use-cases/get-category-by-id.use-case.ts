import type { CategoryRepository } from '../ports/category.repository.js';

import {
  toCategoryOutput,
  type CategoryOutput,
} from '../outputs/category.output.js';

export class GetCategoryByIdUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(input: { id: string }): Promise<CategoryOutput | null> {
    const category = await this.categoryRepository.findById(input.id);

    if (category === null) {
      return null;
    }

    return toCategoryOutput(category);
  }
}
