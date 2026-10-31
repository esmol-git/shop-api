import { describe, expect, it } from 'vitest';

import { StockMovementQuantity } from
  './stock-movement-quantity.js';

describe('StockMovementQuantity', () => {
  it('создаёт количество в одну единицу', () => {
    const quantity = StockMovementQuantity.create(1);

    expect(quantity.value).toBe(1);
  });

  it('создаёт максимально допустимое количество', () => {
    const quantity = StockMovementQuantity.create(
      StockMovementQuantity.MAX_VALUE,
    );

    expect(quantity.value).toBe(2_147_483_647);
  });

  it.each([
    {
      title: 'ноль',
      value: 0,
      message: 'Количество операции должно быть больше нуля',
    },
    {
      title: 'отрицательное число',
      value: -1,
      message: 'Количество операции должно быть больше нуля',
    },
    {
      title: 'дробное число',
      value: 1.5,
      message:
        'Количество операции должно быть целым безопасным числом',
    },
    {
      title: 'NaN',
      value: Number.NaN,
      message:
        'Количество операции должно быть целым безопасным числом',
    },
    {
      title: 'бесконечность',
      value: Number.POSITIVE_INFINITY,
      message:
        'Количество операции должно быть целым безопасным числом',
    },
    {
      title: 'число выше максимума',
      value: StockMovementQuantity.MAX_VALUE + 1,
      message:
        'Количество операции превышает допустимый максимум',
    },
  ])('отклоняет $title', ({ value, message }) => {
    expect(() => {
      StockMovementQuantity.create(value);
    }).toThrow(message);
  });
});