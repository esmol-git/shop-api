export class StockQuantity {
  static readonly MAX_VALUE = 2_147_483_647;

  private constructor(
    private readonly quantity: number,
  ) {}

  static create(value: number): StockQuantity {
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        'Остаток должен быть целым безопасным числом',
      );
    }

    if (value < 0) {
      throw new Error('Остаток не может быть отрицательным');
    }

    if (value > StockQuantity.MAX_VALUE) {
      throw new Error('Остаток превышает допустимый максимум');
    }

    return new StockQuantity(value);
  }

  get value(): number {
    return this.quantity;
  }
}