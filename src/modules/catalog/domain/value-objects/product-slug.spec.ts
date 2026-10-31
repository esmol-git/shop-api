import { describe, expect, it } from 'vitest';

import { ProductSlug } from './product-slug.js';

describe('ProductSlug', () => {
  it('принимает корректный slug', () => {
    expect(ProductSlug.create('proektor-epson').value).toBe(
      'proektor-epson',
    );
  });

  it('нормализует регистр и пробелы', () => {
    expect(ProductSlug.create('  Epson-Home  ').value).toBe(
      'epson-home',
    );
  });

  it('отклоняет пустой slug', () => {
    expect(() => ProductSlug.create('   ')).toThrow(
      'Slug не может быть пустым',
    );
  });

  it('отклоняет недопустимые символы', () => {
    expect(() => ProductSlug.create('epson_home')).toThrow(
      'Slug может содержать только латиницу в нижнем регистре, цифры и дефисы',
    );
  });
});
