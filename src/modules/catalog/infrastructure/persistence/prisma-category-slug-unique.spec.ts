import { describe, expect, it } from 'vitest';

import { Prisma } from
  '../../../../generated/prisma/client.js';

import { isCategorySlugUniqueViolation } from
  './prisma-category-slug-unique.js';

function p2002(meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('x', {
    code: 'P2002',
    clientVersion: 'test',
    meta,
  });
}

describe('isCategorySlugUniqueViolation', () => {
  it('точное совпадение categories_slug_key → true', () => {
    expect(
      isCategorySlugUniqueViolation(
        p2002({ constraint: 'categories_slug_key' }),
      ),
    ).toBe(true);
  });

  it('P2002 + другое constraint + target ["slug"] → false', () => {
    expect(
      isCategorySlugUniqueViolation(
        p2002({
          constraint: 'other_constraint',
          target: ['slug'],
        }),
      ),
    ).toBe(false);
  });

  it('P2002 + похожее имя constraint → false', () => {
    expect(
      isCategorySlugUniqueViolation(
        p2002({ constraint: 'categories_slug_other_key' }),
      ),
    ).toBe(false);
    expect(
      isCategorySlugUniqueViolation(
        p2002({ constraint: 'archived_categories_slug_key' }),
      ),
    ).toBe(false);
    expect(
      isCategorySlugUniqueViolation(
        p2002({ constraint: 'products_slug_key' }),
      ),
    ).toBe(false);
  });

  it('P2002 + другой modelName + target ["slug"] → false', () => {
    expect(
      isCategorySlugUniqueViolation(
        p2002({
          modelName: 'Product',
          target: ['slug'],
        }),
      ),
    ).toBe(false);
  });

  it('P2002 + неизвестная meta → false', () => {
    expect(isCategorySlugUniqueViolation(p2002({}))).toBe(false);
    expect(
      isCategorySlugUniqueViolation(
        p2002({ target: ['name'] }),
      ),
    ).toBe(false);
  });

  it('не P2002 → false', () => {
    const error = new Prisma.PrismaClientKnownRequestError('x', {
      code: 'P2003',
      clientVersion: 'test',
      meta: { constraint: 'categories_parentId_fkey' },
    });

    expect(isCategorySlugUniqueViolation(error)).toBe(false);
  });

  it('без constraint, Category + target slug → true (fallback вызова add)', () => {
    expect(
      isCategorySlugUniqueViolation(
        p2002({
          modelName: 'Category',
          target: ['slug'],
        }),
      ),
    ).toBe(true);
  });

  it('без constraint и modelName + target slug → true (только путь Category.add)', () => {
    expect(
      isCategorySlugUniqueViolation(
        p2002({ target: ['slug'] }),
      ),
    ).toBe(true);
  });

  it('message с categories_slug_key при другом constraint не спасает', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on categories_slug_key',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: {
          constraint: 'other_constraint',
          target: ['slug'],
        },
      },
    );

    expect(isCategorySlugUniqueViolation(error)).toBe(false);
  });
});
