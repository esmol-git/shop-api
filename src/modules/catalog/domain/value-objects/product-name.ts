export class ProductName {
  private constructor(
    private readonly text: string,
  ) {}

  static create(value: string): ProductName {
    const normalized = value.trim();

    if (normalized.length === 0) {
      throw new Error('Название товара не может быть пустым');
    }

    return new ProductName(normalized);
  }

  get value(): string {
    return this.text;
  }
}