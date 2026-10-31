export const CATEGORY_NAME_MAX_LENGTH = 200;

export class CategoryName {
  private constructor(
    private readonly text: string,
  ) {}

  static create(value: string): CategoryName {
    const normalized = value.trim();

    if (normalized.length === 0) {
      throw new Error('Название категории не может быть пустым');
    }

    if (normalized.length > CATEGORY_NAME_MAX_LENGTH) {
      throw new Error(
        `Название категории не может быть длиннее ${CATEGORY_NAME_MAX_LENGTH} символов`,
      );
    }

    return new CategoryName(normalized);
  }

  get value(): string {
    return this.text;
  }
}
