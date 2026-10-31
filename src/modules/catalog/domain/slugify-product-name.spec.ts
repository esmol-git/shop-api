import { describe, expect, it } from 'vitest';

import {
  productSlugFallbackFromId,
  resolveProductSlug,
  slugifyProductName,
} from './slugify-product-name.js';

describe('slugifyProductName', () => {
  it('транслитерирует кириллицу и нормализует', () => {
    expect(slugifyProductName('Проектор Epson')).toBe(
      'proektor-epson',
    );
  });

  it('возвращает пустую строку для одних символов без латиницы/цифр', () => {
    expect(slugifyProductName('!!!')).toBe('');
  });
});

describe('resolveProductSlug', () => {
  const id = '6c3249f4-592e-48ea-aad4-fdf05a276b36';

  it('использует явный slug', () => {
    expect(resolveProductSlug(id, 'X', 'custom-slug').value).toBe(
      'custom-slug',
    );
  });

  it('генерирует из имени', () => {
    expect(resolveProductSlug(id, 'Проектор Epson').value).toBe(
      'proektor-epson',
    );
  });

  it('падает на product-{8 hex} если имя не даёт slug', () => {
    expect(resolveProductSlug(id, '!!!').value).toBe(
      'product-6c3249f4',
    );
  });
});

describe('productSlugFallbackFromId', () => {
  it('берёт 8 hex символов id без дефисов', () => {
    expect(
      productSlugFallbackFromId('6c3249f4-592e-48ea-aad4-fdf05a276b36'),
    ).toBe('product-6c3249f4');
  });
});
