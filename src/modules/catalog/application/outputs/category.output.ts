import type { Category } from '../../domain/category.js';

export interface CategoryOutput {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTreeNodeOutput extends CategoryOutput {
  children: CategoryTreeNodeOutput[];
}

export function toCategoryOutput(category: Category): CategoryOutput {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function buildCategoryTree(
  categories: Category[],
): CategoryTreeNodeOutput[] {
  const byParent = new Map<string | null, Category[]>();

  for (const category of categories) {
    const key = category.parentId;
    const siblings = byParent.get(key) ?? [];
    siblings.push(category);
    byParent.set(key, siblings);
  }

  const build = (parentId: string | null): CategoryTreeNodeOutput[] => {
    // Порядок задаёт findAll (name ASC, id ASC); здесь не пересортировываем.
    const nodes = byParent.get(parentId) ?? [];

    return nodes.map((category) => ({
      ...toCategoryOutput(category),
      children: build(category.id),
    }));
  };

  return build(null);
}
