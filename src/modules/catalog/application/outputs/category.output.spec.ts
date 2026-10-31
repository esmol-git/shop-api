import { describe, expect, it } from 'vitest';

import { Category } from '../../domain/category.js';
import { buildCategoryTree, toCategoryOutput } from './category.output.js';

describe('category.output', () => {
  it('пустое дерево — пустой массив', () => {
    expect(buildCategoryTree([])).toEqual([]);
  });

  it('сохраняет порядок входного массива при сборке дерева', () => {
    const rootA = Category.restore(
      '11111111-1111-4111-8111-111111111111',
      'Alpha',
      'alpha',
      null,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
    );
    const rootB = Category.restore(
      '22222222-2222-4222-8222-222222222222',
      'Beta',
      'beta',
      null,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
    );
    const child = Category.restore(
      '33333333-3333-4333-8333-333333333333',
      'Child',
      'child',
      rootA.id,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
    );

    // Как после findAll: name ASC, id ASC — корни, затем дети в общем списке.
    const tree = buildCategoryTree([rootA, rootB, child]);

    expect(tree.map((node) => node.slug)).toEqual(['alpha', 'beta']);
    expect(tree[0]?.children).toEqual([
      {
        ...toCategoryOutput(child),
        children: [],
      },
    ]);
    expect(tree[1]?.children).toEqual([]);
  });
});
