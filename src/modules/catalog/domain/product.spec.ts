import { describe, expect, it } from 'vitest';
import { Product } from './product.js';

describe('Product', () => {
  it('создаёт товар с идентификатором, названием и метками времени', () => {
    const at = new Date('2026-10-30T12:00:00.000Z');
    const product = Product.create('Проектор Epson', at);

    expect(product.id).toEqual(expect.any(String));
    expect(product.id.length).toBeGreaterThan(0);
    expect(product.name).toBe('Проектор Epson');
    expect(product.createdAt).toEqual(at);
    expect(product.updatedAt).toEqual(at);
  });

  it('нормализует название при создании', () => {
    const product = Product.create('  Проектор Epson  ');

    expect(product.name).toBe('Проектор Epson');
  });

  it('создаёт разные идентификаторы для разных товаров', () => {
    const first = Product.create('Проектор Epson');
    const second = Product.create('Проектор Epson');

    expect(first.id).not.toBe(second.id);
  });

  it('не позволяет создать товар с пустым названием', () => {
    expect(() => Product.create('')).toThrow(
      'Название товара не может быть пустым',
    );
  });

  it('переименовывает товар и сохраняет идентификатор', () => {
    const createdAt = new Date('2026-10-30T12:00:00.000Z');
    const renamedAt = new Date('2026-10-30T13:00:00.000Z');
    const product = Product.create('Проектор Epson', createdAt);
    const originalId = product.id;

    product.rename('  Проектор Kubster  ', renamedAt);

    expect(product.name).toBe('Проектор Kubster');
    expect(product.id).toBe(originalId);
    expect(product.createdAt).toEqual(createdAt);
    expect(product.updatedAt).toEqual(renamedAt);
  });

  it('сохраняет прежнее название при неудачном переименовании', () => {
    const product = Product.create('Проектор Epson');

    expect(() => product.rename('   ')).toThrow(
      'Название товара не может быть пустым',
    );

    expect(product.name).toBe('Проектор Epson');
  });

  it('восстанавливает товар с существующими ID и названием', () => {
    const id = '6c3249f4-592e-48ea-aad4-fdf05a276b36';
  
    const product = Product.restore(id, 'Проектор Kubster');
  
    expect(product.id).toBe(id);
    expect(product.name).toBe('Проектор Kubster');
  });
  it('создаёт товар без назначенной цены', () => {
    const product = Product.create('Проектор Epson');
  
    expect(product.price).toBeNull();
  });
  
  it('назначает и изменяет цену, сохраняя ID и название', () => {
    const product = Product.create('Проектор Epson');
    const originalId = product.id;
  
    product.changePrice(199_900);
  
    expect(product.price?.amount).toBe(199_900);
    expect(product.price?.currency).toBe('RUB');
  
    product.changePrice(249_900);
  
    expect(product.price?.amount).toBe(249_900);
    expect(product.id).toBe(originalId);
    expect(product.name).toBe('Проектор Epson');
  });
  
  it('отличает нулевую цену от отсутствующей', () => {
    const product = Product.create('Проектор Epson');
  
    product.changePrice(0);
  
    expect(product.price).not.toBeNull();
    expect(product.price?.amount).toBe(0);
  });
  
  it('сохраняет прежнюю цену при недопустимом изменении', () => {
    const product = Product.create('Проектор Epson');
    product.changePrice(199_900);
  
    const originalPrice = product.price;
  
    expect(() => product.changePrice(-1)).toThrow(
      'Цена не может быть отрицательной',
    );
  
    expect(product.price).toBe(originalPrice);
    expect(product.price?.amount).toBe(199_900);
  });
  
  it('восстанавливает товар с существующей ценой', () => {
    const id = '6c3249f4-592e-48ea-aad4-fdf05a276b36';
  
    const product = Product.restore(
      id,
      'Проектор Epson',
      199_900,
    );
  
    expect(product.id).toBe(id);
    expect(product.name).toBe('Проектор Epson');
    expect(product.price?.amount).toBe(199_900);
    expect(product.price?.currency).toBe('RUB');
  });
  
  it('восстанавливает нулевую цену без подмены на null', () => {
    const id = '6c3249f4-592e-48ea-aad4-fdf05a276b36';
  
    const product = Product.restore(id, 'Проектор Epson', 0);
  
    expect(product.price).not.toBeNull();
    expect(product.price?.amount).toBe(0);
  });
  it('создаёт товар с отключённым учётом остатков', () => {
    const product = Product.create('Проектор Epson');
  
    expect(product.inventoryTracked).toBe(false);
    expect(product.stockQuantity).toBeNull();
  });
  
  it.each([0, 10])(
    'включает учёт остатков с количеством %i',
    (quantity) => {
      const product = Product.create('Проектор Epson');
      const originalId = product.id;
  
      product.enableInventoryTracking(quantity);
  
      expect(product.inventoryTracked).toBe(true);
      expect(product.stockQuantity?.value).toBe(quantity);
      expect(product.id).toBe(originalId);
      expect(product.name).toBe('Проектор Epson');
    },
  );
  
  it('не включает учёт с недопустимым количеством', () => {
    const product = Product.create('Проектор Epson');
  
    expect(() => product.enableInventoryTracking(-1)).toThrow(
      'Остаток не может быть отрицательным',
    );
  
    expect(product.inventoryTracked).toBe(false);
    expect(product.stockQuantity).toBeNull();
  });
  
  it('не позволяет повторным включением перезаписать остаток', () => {
    const product = Product.create('Проектор Epson');
    product.enableInventoryTracking(10);
  
    expect(() => product.enableInventoryTracking(20)).toThrow(
      'Учёт остатков уже включён',
    );
  
    expect(product.stockQuantity?.value).toBe(10);
  });
  
  it('отключает учёт и требует новое количество при включении', () => {
    const product = Product.create('Проектор Epson');
  
    product.enableInventoryTracking(10);
    product.disableInventoryTracking();
  
    expect(product.inventoryTracked).toBe(false);
    expect(product.stockQuantity).toBeNull();
  
    product.disableInventoryTracking();
  
    expect(product.inventoryTracked).toBe(false);
    expect(product.stockQuantity).toBeNull();
  
    product.enableInventoryTracking(3);
  
    expect(product.inventoryTracked).toBe(true);
    expect(product.stockQuantity?.value).toBe(3);
  });
  
  it.each([
    {
      title: 'отключённый учёт',
      quantity: null,
      tracked: false,
    },
    {
      title: 'включённый учёт с нулевым остатком',
      quantity: 0,
      tracked: true,
    },
    {
      title: 'включённый учёт с положительным остатком',
      quantity: 10,
      tracked: true,
    },
  ])('восстанавливает $title', ({ quantity, tracked }) => {
    const id = '6c3249f4-592e-48ea-aad4-fdf05a276b36';

    const product = Product.restore(
      id,
      'Проектор Epson',
      199_900,
      quantity,
    );

    expect(product.id).toBe(id);
    expect(product.price?.amount).toBe(199_900);
    expect(product.inventoryTracked).toBe(tracked);
    expect(product.isArchived).toBe(false);
    expect(product.archivedAt).toBeNull();

    if (quantity === null) {
      expect(product.stockQuantity).toBeNull();
    } else {
      expect(product.stockQuantity?.value).toBe(quantity);
    }
  });

  it('создаёт товар без архивации', () => {
    const product = Product.create('Проектор Epson');

    expect(product.isArchived).toBe(false);
    expect(product.archivedAt).toBeNull();
  });

  it('архивирует товар один раз и сохраняет момент', () => {
    const createdAt = new Date('2026-10-30T11:00:00.000Z');
    const product = Product.create('Проектор Epson', createdAt);
    const at = new Date('2026-10-30T12:00:00.000Z');

    product.archive(at);

    expect(product.isArchived).toBe(true);
    expect(product.archivedAt).toEqual(at);
    expect(product.updatedAt).toEqual(at);
    expect(product.createdAt).toEqual(createdAt);

    product.archive(new Date('2026-10-31T12:00:00.000Z'));

    expect(product.archivedAt).toEqual(at);
    expect(product.updatedAt).toEqual(at);
  });

  it('восстанавливает архивный товар с метками времени', () => {
    const id = '6c3249f4-592e-48ea-aad4-fdf05a276b36';
    const createdAt = new Date('2026-10-29T12:00:00.000Z');
    const archivedAt = new Date('2026-10-30T12:00:00.000Z');

    const product = Product.restore(
      id,
      'Проектор Epson',
      199_900,
      10,
      archivedAt,
      createdAt,
      archivedAt,
    );

    expect(product.isArchived).toBe(true);
    expect(product.archivedAt).toEqual(archivedAt);
    expect(product.createdAt).toEqual(createdAt);
    expect(product.updatedAt).toEqual(archivedAt);
    expect(product.stockQuantity?.value).toBe(10);
  });
});