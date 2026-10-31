import { Module } from '@nestjs/common';

import { PrismaModule } from
  '../../infrastructure/database/prisma/prisma.module.js';

import { PRODUCT_REPOSITORY } from
  './application/ports/product.repository.js';

import type { ProductRepository } from
  './application/ports/product.repository.js';

import { CreateProductUseCase } from
  './application/use-cases/create-product.use-case.js';

import { GetProductByIdUseCase } from
  './application/use-cases/get-product-by-id.use-case.js';

import { PrismaProductRepository } from
  './infrastructure/persistence/prisma-product.repository.js';

import { PrismaStockMovementRepository } from
  './infrastructure/persistence/prisma-stock-movement.repository.js';

import { ProductsController } from
  './presentation/http/products.controller.js';

import { CategoriesController } from
  './presentation/http/categories.controller.js';

import { CATEGORY_REPOSITORY } from
  './application/ports/category.repository.js';

import type { CategoryRepository } from
  './application/ports/category.repository.js';

import { PrismaCategoryRepository } from
  './infrastructure/persistence/prisma-category.repository.js';

import { CreateCategoryUseCase } from
  './application/use-cases/create-category.use-case.js';

import { GetCategoryByIdUseCase } from
  './application/use-cases/get-category-by-id.use-case.js';

import { ListCategoriesUseCase } from
  './application/use-cases/list-categories.use-case.js';

import { ListCategoryTreeUseCase } from
  './application/use-cases/list-category-tree.use-case.js';

import { RenameCategoryUseCase } from
  './application/use-cases/rename-category.use-case.js';

import { ListProductsUseCase } from
  './application/use-cases/list-products.use-case.js';

import { RenameProductUseCase } from
  './application/use-cases/rename-product.use-case.js';

import { UpdateProductDetailsUseCase } from
  './application/use-cases/update-product-details.use-case.js';

import { DeleteProductUseCase } from
  './application/use-cases/delete-product.use-case.js';

import { ArchiveProductUseCase } from
  './application/use-cases/archive-product.use-case.js';

import { ChangeProductPriceUseCase } from
  './application/use-cases/change-product-price.use-case.js';

import { EnableProductInventoryTrackingUseCase } from
  './application/use-cases/enable-product-inventory-tracking.use-case.js';

import { DisableProductInventoryTrackingUseCase } from
  './application/use-cases/disable-product-inventory-tracking.use-case.js';

import { STOCK_MOVEMENT_REPOSITORY } from
  './application/ports/stock-movement.repository.js';

import { IncreaseProductStockUseCase } from
  './application/use-cases/increase-product-stock.use-case.js';

import { DecreaseProductStockUseCase } from
  './application/use-cases/decrease-product-stock.use-case.js';

@Module({
  imports: [PrismaModule],
  controllers: [ProductsController, CategoriesController],
  providers: [
    {
      provide: PRODUCT_REPOSITORY,
      useClass: PrismaProductRepository,
    },
    {
      provide: CATEGORY_REPOSITORY,
      useClass: PrismaCategoryRepository,
    },
    {
      provide: STOCK_MOVEMENT_REPOSITORY,
      useClass: PrismaStockMovementRepository,
    },
    {
      provide: CreateCategoryUseCase,
      useFactory: (repository: CategoryRepository) =>
        new CreateCategoryUseCase(repository),
      inject: [CATEGORY_REPOSITORY],
    },
    {
      provide: GetCategoryByIdUseCase,
      useFactory: (repository: CategoryRepository) =>
        new GetCategoryByIdUseCase(repository),
      inject: [CATEGORY_REPOSITORY],
    },
    {
      provide: ListCategoriesUseCase,
      useFactory: (repository: CategoryRepository) =>
        new ListCategoriesUseCase(repository),
      inject: [CATEGORY_REPOSITORY],
    },
    {
      provide: ListCategoryTreeUseCase,
      useFactory: (repository: CategoryRepository) =>
        new ListCategoryTreeUseCase(repository),
      inject: [CATEGORY_REPOSITORY],
    },
    {
      provide: RenameCategoryUseCase,
      useFactory: (repository: CategoryRepository) =>
        new RenameCategoryUseCase(repository),
      inject: [CATEGORY_REPOSITORY],
    },
    PrismaCategoryRepository,
    {
      provide: CreateProductUseCase,
      useFactory: (repository: ProductRepository) =>
        new CreateProductUseCase(repository),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: GetProductByIdUseCase,
      useFactory: (repository: ProductRepository) =>
        new GetProductByIdUseCase(repository),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: ListProductsUseCase,
      useFactory: (repository: ProductRepository) =>
        new ListProductsUseCase(repository),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: RenameProductUseCase,
      useFactory: (repository: ProductRepository) =>
        new RenameProductUseCase(repository),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: UpdateProductDetailsUseCase,
      useFactory: (repository: ProductRepository) =>
        new UpdateProductDetailsUseCase(repository),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: DeleteProductUseCase,
      useFactory: (repository: ProductRepository) =>
        new DeleteProductUseCase(repository),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: ArchiveProductUseCase,
      useFactory: (repository: ProductRepository) =>
        new ArchiveProductUseCase(repository),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: ChangeProductPriceUseCase,
      useFactory: (repository: ProductRepository) =>
        new ChangeProductPriceUseCase(repository),
      inject: [PRODUCT_REPOSITORY],
    },
    EnableProductInventoryTrackingUseCase,
    DisableProductInventoryTrackingUseCase,
    PrismaProductRepository,
    PrismaStockMovementRepository,
    IncreaseProductStockUseCase,
    DecreaseProductStockUseCase,
  ],
})
export class CatalogModule {}
