import { randomUUID } from 'node:crypto';

import { CategoryName } from './value-objects/category-name.js';
import { CategorySlug } from './value-objects/category-slug.js';

export class Category {
  private constructor(
    private readonly categoryId: string,
    private categoryName: CategoryName,
    private readonly categorySlug: CategorySlug,
    private readonly categoryParentId: string | null,
    private readonly categoryCreatedAt: Date,
    private categoryUpdatedAt: Date,
  ) {}

  static create(
    name: string,
    slug: string,
    parentId: string | null = null,
    at: Date = new Date(),
  ): Category {
    return new Category(
      randomUUID(),
      CategoryName.create(name),
      CategorySlug.create(slug),
      parentId,
      at,
      at,
    );
  }

  static restore(
    id: string,
    name: string,
    slug: string,
    parentId: string | null,
    createdAt: Date,
    updatedAt: Date,
  ): Category {
    return new Category(
      id,
      CategoryName.create(name),
      CategorySlug.create(slug),
      parentId,
      createdAt,
      updatedAt,
    );
  }

  get id(): string {
    return this.categoryId;
  }

  get name(): string {
    return this.categoryName.value;
  }

  get slug(): string {
    return this.categorySlug.value;
  }

  get parentId(): string | null {
    return this.categoryParentId;
  }

  get createdAt(): Date {
    return this.categoryCreatedAt;
  }

  get updatedAt(): Date {
    return this.categoryUpdatedAt;
  }

  rename(name: string, at: Date = new Date()): void {
    this.categoryName = CategoryName.create(name);
    this.categoryUpdatedAt = at;
  }
}
