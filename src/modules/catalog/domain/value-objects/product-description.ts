export const PRODUCT_DESCRIPTION_MAX_LENGTH = 5000;

export class ProductDescription {
  private constructor(
    private readonly text: string | null,
  ) {}

  static create(value: string | null | undefined): ProductDescription {
    if (value === null || value === undefined) {
      return new ProductDescription(null);
    }

    const normalized = value.trim();

    if (normalized.length === 0) {
      return new ProductDescription(null);
    }

    if (normalized.length > PRODUCT_DESCRIPTION_MAX_LENGTH) {
      throw new Error(
        `Описание не может быть длиннее ${PRODUCT_DESCRIPTION_MAX_LENGTH} символов`,
      );
    }

    return new ProductDescription(normalized);
  }

  get value(): string | null {
    return this.text;
  }
}
