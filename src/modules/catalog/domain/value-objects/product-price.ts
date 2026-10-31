export class ProductPrice {
  static readonly MAX_AMOUNT = 2_147_483_647;

  private constructor(
    private readonly amountInKopecks: number,
  ) {}

  static create(amountInKopecks: number): ProductPrice {
    if (!Number.isSafeInteger(amountInKopecks)) {
      throw new Error(
        'Цена должна быть целым безопасным числом копеек',
      );
    }

    if (amountInKopecks < 0) {
      throw new Error('Цена не может быть отрицательной');
    }

    if (amountInKopecks > ProductPrice.MAX_AMOUNT) {
      throw new Error('Цена превышает допустимый максимум');
    }

    return new ProductPrice(amountInKopecks);
  }

  get amount(): number {
    return this.amountInKopecks;
  }

  get currency(): 'RUB' {
    return 'RUB';
  }
}