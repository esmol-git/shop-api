import { describe, expect, it } from 'vitest';

import { CategoryName } from './category-name.js';

describe('CategoryName', () => {
  it('обрезает пробелы', () => {
    expect(CategoryName.create('  Кессоны  ').value).toBe('Кессоны');
  });

  it('отклоняет пустое название', () => {
    expect(() => CategoryName.create('   ')).toThrow(
      'Название категории не может быть пустым',
    );
  });

  it('отклоняет слишком длинное название', () => {
    expect(() => CategoryName.create('а'.repeat(201))).toThrow(
      /длиннее 200/,
    );
  });
});
