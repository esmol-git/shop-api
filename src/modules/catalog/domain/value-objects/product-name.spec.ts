import { describe, expect, it } from 'vitest';
import { ProductName } from './product-name.js';

describe('ProductName', () => {
  it('создаёт название товара', () => {
    const name = ProductName.create('Проектор Epson');

    expect(name.value).toBe('Проектор Epson');
  });

  it('убирает пробелы по краям', () => {
    const name = ProductName.create('  Проектор Epson  ');

    expect(name.value).toBe('Проектор Epson');
  });

  it('сохраняет пробелы внутри названия', () => {
    const name = ProductName.create('Проектор Epson EB');

    expect(name.value).toBe('Проектор Epson EB');
  });

  it('отклоняет пустую строку', () => {
    expect(() => ProductName.create('')).toThrow(
      'Название товара не может быть пустым',
    );
  });

  it('отклоняет название только из пробелов', () => {
    expect(() => ProductName.create('   ')).toThrow(
      'Название товара не может быть пустым',
    );
  });
});