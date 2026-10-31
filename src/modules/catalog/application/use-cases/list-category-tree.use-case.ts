import type { CategoryRepository } from '../ports/category.repository.js';

import {
  buildCategoryTree,
  type CategoryTreeNodeOutput,
} from '../outputs/category.output.js';

export class ListCategoryTreeUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(): Promise<CategoryTreeNodeOutput[]> {
    const categories = await this.categoryRepository.findAll();

    return buildCategoryTree(categories);
  }
}
