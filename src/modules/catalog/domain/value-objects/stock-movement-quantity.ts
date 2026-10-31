import { StockQuantity } from './stock-quantity.js';

export class StockMovementQuantity {
  static readonly MAX_VALUE = StockQuantity.MAX_VALUE;

  private constructor(
    private readonly quantity: number,
  ) {}

  static create(value: number): StockMovementQuantity {
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        'Количество операции должно быть целым безопасным числом',
      );
    }

    if (value <= 0) {
      throw new Error(
        'Количество операции должно быть больше нуля',
      );
    }

    if (value > StockMovementQuantity.MAX_VALUE) {
      throw new Error(
        'Количество операции превышает допустимый максимум',
      );
    }

    return new StockMovementQuantity(value);
  }

  get value(): number {
    return this.quantity;
  }
}