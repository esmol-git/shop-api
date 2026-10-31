import { describe, expect, it } from 'vitest';

import { Product } from '../../domain/product.js';
import { toProductOutput } from './product.output.js';

const createdAt = new Date('2026-01-01T10:00:00.000Z');
const updatedAt = new Date('2026-01-02T11:00:00.000Z');

describe('toProductOutput', () => {
  it('возвращает отключённый учёт', () => {
    const product = Product.restore(
      'product-1',
      'Проектор Epson',
      199_900,
      null,
      null,
      createdAt,
      updatedAt,
    );

    expect(toProductOutput(product)).toEqual({
      id: 'product-1',
      name: 'Проектор Epson',
      description: null,
      slug: 'product-product1',
      price: {
        amount: 199_900,
        currency: 'RUB',
      },
      inventory: {
        tracked: false,
        quantity: null,
      },
      archivedAt: null,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-02T11:00:00.000Z',
    });
  });

  it('возвращает включённый учёт с нулевым остатком', () => {
    const product = Product.restore(
      'product-1',
      'Проектор Epson',
      null,
      0,
      null,
      createdAt,
      updatedAt,
    );

    expect(toProductOutput(product)).toEqual({
      id: 'product-1',
      name: 'Проектор Epson',
      description: null,
      slug: 'product-product1',
      price: null,
      inventory: {
        tracked: true,
        quantity: 0,
      },
      archivedAt: null,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-02T11:00:00.000Z',
    });
  });

  it('возвращает включённый учёт с положительным остатком', () => {
    const product = Product.restore(
      'product-1',
      'Проектор Epson',
      199_900,
      10,
      null,
      createdAt,
      updatedAt,
    );

    expect(toProductOutput(product)).toEqual({
      id: 'product-1',
      name: 'Проектор Epson',
      description: null,
      slug: 'product-product1',
      price: {
        amount: 199_900,
        currency: 'RUB',
      },
      inventory: {
        tracked: true,
        quantity: 10,
      },
      archivedAt: null,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-02T11:00:00.000Z',
    });
  });

  it('возвращает момент архивации', () => {
    const archivedAt = new Date('2026-10-30T12:00:00.000Z');

    const product = Product.restore(
      'product-1',
      'Проектор Epson',
      199_900,
      10,
      archivedAt,
      createdAt,
      archivedAt,
    );

    expect(toProductOutput(product)).toEqual({
      id: 'product-1',
      name: 'Проектор Epson',
      description: null,
      slug: 'product-product1',
      price: {
        amount: 199_900,
        currency: 'RUB',
      },
      inventory: {
        tracked: true,
        quantity: 10,
      },
      archivedAt: '2026-10-30T12:00:00.000Z',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-10-30T12:00:00.000Z',
    });
  });
});
