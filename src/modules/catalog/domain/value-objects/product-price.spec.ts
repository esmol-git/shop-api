import { describe, expect, it } from 'vitest';

import { ProductPrice } from './product-price.js';

describe('ProductPrice', () => {
  it('создаёт цену в копейках с валютой RUB', () => {
    const price = ProductPrice.create(199_900);

    expect(price.amount).toBe(199_900);
    expect(price.currency).toBe('RUB');
  });

  it('допускает нулевую цену', () => {
    const price = ProductPrice.create(0);

    expect(price.amount).toBe(0);
  });

  it('допускает максимальную цену', () => {
    const price = ProductPrice.create(2_147_483_647);

    expect(price.amount).toBe(2_147_483_647);
  });

  it('отклоняет отрицательную цену', () => {
    expect(() => ProductPrice.create(-1)).toThrow(
      'Цена не может быть отрицательной',
    );
  });

  it('отклоняет цену выше максимума', () => {
    expect(() => ProductPrice.create(2_147_483_648)).toThrow(
      'Цена превышает допустимый максимум',
    );
  });

  it.each([
    { title: 'дробное число', amount: 10.5 },
    { title: 'NaN', amount: Number.NaN },
    { title: 'Infinity', amount: Number.POSITIVE_INFINITY },
    { title: '-Infinity', amount: Number.NEGATIVE_INFINITY },
    {
      title: 'небезопасное целое',
      amount: Number.MAX_SAFE_INTEGER + 1,
    },
  ])('отклоняет $title', ({ amount }) => {
    expect(() => ProductPrice.create(amount)).toThrow(
      'Цена должна быть целым безопасным числом копеек',
    );
  });
});