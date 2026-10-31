import { describe, expect, it } from 'vitest';

import { CategorySlug } from './category-slug.js';

describe('CategorySlug', () => {
  it('нормализует регистр', () => {
    expect(CategorySlug.create('  Kessony  ').value).toBe('kessony');
  });

  it('отклоняет неверный формат', () => {
    expect(() => CategorySlug.create('Bad Slug')).toThrow(/латиницу/);
  });
});
