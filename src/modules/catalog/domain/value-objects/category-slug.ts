const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CATEGORY_SLUG_MAX_LENGTH = 100;

export class CategorySlug {
  private constructor(
    private readonly text: string,
  ) {}

  static create(value: string): CategorySlug {
    const normalized = value.trim().toLowerCase();

    if (normalized.length === 0) {
      throw new Error('Slug категории не может быть пустым');
    }

    if (normalized.length > CATEGORY_SLUG_MAX_LENGTH) {
      throw new Error(
        `Slug категории не может быть длиннее ${CATEGORY_SLUG_MAX_LENGTH} символов`,
      );
    }

    if (!SLUG_PATTERN.test(normalized)) {
      throw new Error(
        'Slug категории может содержать только латиницу в нижнем регистре, цифры и дефисы',
      );
    }

    return new CategorySlug(normalized);
  }

  get value(): string {
    return this.text;
  }
}
