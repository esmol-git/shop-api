import type { Product } from '../../domain/product.js';

export type ProductInventoryOutput =
  | {
      tracked: false;
      quantity: null;
    }
  | {
      tracked: true;
      quantity: number;
    };

export interface ProductOutput {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  price: {
    amount: number;
    currency: 'RUB';
  } | null;
  inventory: ProductInventoryOutput;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toProductOutput(product: Product): ProductOutput {
  const price = product.price;
  const stockQuantity = product.stockQuantity;

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    slug: product.slug,
    price: price === null
      ? null
      : {
          amount: price.amount,
          currency: price.currency,
        },
    inventory: stockQuantity === null
      ? {
          tracked: false,
          quantity: null,
        }
      : {
          tracked: true,
          quantity: stockQuantity.value,
        },
    archivedAt: product.archivedAt === null
      ? null
      : product.archivedAt.toISOString(),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
