const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PRODUCT_SLUG_MAX_LENGTH = 100;

export class ProductSlug {
  private constructor(
    private readonly text: string,
  ) {}

  static create(value: string): ProductSlug {
    const normalized = value.trim().toLowerCase();

    if (normalized.length === 0) {
      throw new Error('Slug не может быть пустым');
    }

    if (normalized.length > PRODUCT_SLUG_MAX_LENGTH) {
      throw new Error(
        `Slug не может быть длиннее ${PRODUCT_SLUG_MAX_LENGTH} символов`,
      );
    }

    if (!SLUG_PATTERN.test(normalized)) {
      throw new Error(
        'Slug может содержать только латиницу в нижнем регистре, цифры и дефисы',
      );
    }

    return new ProductSlug(normalized);
  }

  get value(): string {
    return this.text;
  }
}
