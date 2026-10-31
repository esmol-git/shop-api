import type { Category } from '../../domain/category.js';

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

export type AddCategoryResult =
  | 'created'
  | 'slug-taken'
  | 'parent-not-found';

export type UpdateCategoryResult =
  | 'updated'
  | 'not-found';

export interface CategoryRepository {
  add(category: Category): Promise<AddCategoryResult>;
  findById(id: string): Promise<Category | null>;
  findAll(): Promise<Category[]>;
  /**
   * Глубина категории: корень = 1. null — категория не найдена.
   */
  findDepth(id: string): Promise<number | null>;
  update(category: Category): Promise<UpdateCategoryResult>;
}
