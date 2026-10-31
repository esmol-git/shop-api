import { describe, expect, it } from 'vitest';

import { StockQuantity } from './stock-quantity.js';

describe('StockQuantity', () => {
  it.each([
    { title: 'нулевой остаток', value: 0 },
    { title: 'положительный остаток', value: 10 },
    { title: 'максимальный остаток', value: 2_147_483_647 },
  ])('допускает $title', ({ value }) => {
    const quantity = StockQuantity.create(value);

    expect(quantity.value).toBe(value);
  });

  it('отклоняет отрицательный остаток', () => {
    expect(() => StockQuantity.create(-1)).toThrow(
      'Остаток не может быть отрицательным',
    );
  });

  it('отклоняет остаток выше максимума', () => {
    expect(() => StockQuantity.create(2_147_483_648)).toThrow(
      'Остаток превышает допустимый максимум',
    );
  });

  it.each([
    { title: 'дробное число', value: 1.5 },
    { title: 'NaN', value: Number.NaN },
    { title: 'Infinity', value: Number.POSITIVE_INFINITY },
    { title: '-Infinity', value: Number.NEGATIVE_INFINITY },
    {
      title: 'небезопасное целое',
      value: Number.MAX_SAFE_INTEGER + 1,
    },
  ])('отклоняет $title', ({ value }) => {
    expect(() => StockQuantity.create(value)).toThrow(
      'Остаток должен быть целым безопасным числом',
    );
  });
});