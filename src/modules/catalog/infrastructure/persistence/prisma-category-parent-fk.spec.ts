import { describe, expect, it } from 'vitest';

import { Prisma } from
  '../../../../generated/prisma/client.js';

import { isCategoryParentForeignKeyError } from
  './prisma-category-parent-fk.js';

function p2003(meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('x', {
    code: 'P2003',
    clientVersion: 'test',
    meta,
  });
}

describe('isCategoryParentForeignKeyError', () => {
  it('точное categories_parentId_fkey → true', () => {
    expect(
      isCategoryParentForeignKeyError(
        p2003({ constraint: 'categories_parentId_fkey' }),
      ),
    ).toBe(true);
  });

  it('другое constraint + field parentId → false', () => {
    expect(
      isCategoryParentForeignKeyError(
        p2003({
          constraint: 'other_parent_fkey',
          field_name: 'parentId',
        }),
      ),
    ).toBe(false);
  });

  it('похожее имя constraint → false', () => {
    expect(
      isCategoryParentForeignKeyError(
        p2003({ constraint: 'categories_parentId_other' }),
      ),
    ).toBe(false);
  });

  it('чужой FK → false', () => {
    expect(
      isCategoryParentForeignKeyError(
        p2003({ constraint: 'stock_movements_productId_fkey' }),
      ),
    ).toBe(false);
  });

  it('без constraint, field parentId → true (fallback Category.add)', () => {
    expect(
      isCategoryParentForeignKeyError(
        p2003({ field_name: 'parentId' }),
      ),
    ).toBe(true);
  });

  it('не P2003 → false', () => {
    const error = new Prisma.PrismaClientKnownRequestError('x', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { constraint: 'categories_slug_key' },
    });

    expect(isCategoryParentForeignKeyError(error)).toBe(false);
  });
});
