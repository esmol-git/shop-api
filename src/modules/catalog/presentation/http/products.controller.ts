import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateProductUseCase } from
  '../../application/use-cases/create-product.use-case.js';

import { GetProductByIdUseCase } from
  '../../application/use-cases/get-product-by-id.use-case.js';

import { ListProductsUseCase } from
  '../../application/use-cases/list-products.use-case.js';

import { RenameProductUseCase } from
  '../../application/use-cases/rename-product.use-case.js';

import { UpdateProductDetailsUseCase } from
  '../../application/use-cases/update-product-details.use-case.js';

import { RenameProductDto } from './dto/rename-product.dto.js';
import { UpdateProductDetailsDto } from
  './dto/update-product-details.dto.js';

import { DeleteProductUseCase } from
  '../../application/use-cases/delete-product.use-case.js';

import { ArchiveProductUseCase } from
  '../../application/use-cases/archive-product.use-case.js';

import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';

import { ChangeProductPriceUseCase } from
  '../../application/use-cases/change-product-price.use-case.js';

import { ChangeProductPriceDto } from
  './dto/change-product-price.dto.js';

import { EnableProductInventoryTrackingUseCase } from
  '../../application/use-cases/enable-product-inventory-tracking.use-case.js';

import { DisableProductInventoryTrackingUseCase } from
  '../../application/use-cases/disable-product-inventory-tracking.use-case.js';

import { StockQuantity } from
  '../../domain/value-objects/stock-quantity.js';

import { EnableProductInventoryTrackingDto } from
  './dto/enable-product-inventory-tracking.dto.js';

import { StockMovementQuantity } from
  '../../domain/value-objects/stock-movement-quantity.js';

import { IncreaseProductStockDto } from
  './dto/increase-product-stock.dto.js';

import { DecreaseProductStockUseCase } from
  '../../application/use-cases/decrease-product-stock.use-case.js';

import { DecreaseProductStockDto } from
  './dto/decrease-product-stock.dto.js';

import { isUUID } from 'class-validator';

import { IncreaseProductStockUseCase } from
  '../../application/use-cases/increase-product-stock.use-case.js';

import {
  ProductPageResponseDto,
  ProductResponseDto,
} from './swagger/product-response.dto.js';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly renameProductUseCase: RenameProductUseCase,
    private readonly updateProductDetailsUseCase:
      UpdateProductDetailsUseCase,
    private readonly deleteProductUseCase: DeleteProductUseCase,
    private readonly archiveProductUseCase: ArchiveProductUseCase,
    private readonly changeProductPriceUseCase: ChangeProductPriceUseCase,
    private readonly enableProductInventoryTrackingUseCase:
      EnableProductInventoryTrackingUseCase,
    private readonly disableProductInventoryTrackingUseCase:
      DisableProductInventoryTrackingUseCase,
    private readonly increaseProductStockUseCase:
      IncreaseProductStockUseCase,
    private readonly decreaseProductStockUseCase:
      DecreaseProductStockUseCase,
  ) {}

  @Post(':id/inventory/decrease')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Списать остаток',
    description:
      'Уменьшает остаток на указанное количество. Требует Idempotency-Key.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 товара',
    format: 'uuid',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID v4 ключа идемпотентности',
    required: true,
    schema: {
      type: 'string',
      format: 'uuid',
      example: '8acdf042-48bf-4aa5-bfb1-e457ad9dce09',
    },
  })
  @ApiResponse({
    status: 204,
    description:
      'Списание выполнено или подтверждён точный повтор',
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректный UUID, ключ или количество',
  })
  @ApiResponse({
    status: 404,
    description: 'Товар не найден',
  })
  @ApiResponse({
    status: 409,
    description:
      'Конфликт ключа, учёт отключён или недостаточно остатка',
  })
  async decreaseStock(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Headers('idempotency-key')
    idempotencyKey: string | undefined,
    @Body() dto: DecreaseProductStockDto,
  ): Promise<void> {
    if (
      typeof idempotencyKey !== 'string' ||
      !isUUID(idempotencyKey, '4')
    ) {
      throw new BadRequestException(
        'Заголовок Idempotency-Key должен содержать UUID v4',
      );
    }

    const quantity = StockMovementQuantity.create(
      dto.quantity,
    );

    const result =
      await this.decreaseProductStockUseCase.execute({
        idempotencyKey: idempotencyKey.toLowerCase(),
        productId: id.toLowerCase(),
        quantity,
      });

    switch (result) {
      case 'applied':
      case 'replayed':
        return;

      case 'key-conflict':
        throw new ConflictException(
          'Idempotency-Key уже использован для другой операции',
        );

      case 'not-found':
        throw new NotFoundException('Товар не найден');

      case 'inventory-disabled':
        throw new ConflictException(
          'Учёт остатков для товара отключён',
        );

      case 'insufficient-stock':
        throw new ConflictException(
          'Недостаточно товара для списания',
        );
    }
  }

  @Post(':id/inventory/increase')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Оформить приход',
    description:
      'Увеличивает остаток на указанное количество. Требует Idempotency-Key.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 товара',
    format: 'uuid',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID v4 ключа идемпотентности',
    required: true,
    schema: {
      type: 'string',
      format: 'uuid',
      example: '8acdf042-48bf-4aa5-bfb1-e457ad9dce09',
    },
  })
  @ApiResponse({
    status: 204,
    description:
      'Приход выполнен или подтверждён точный повтор',
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректный UUID, ключ или количество',
  })
  @ApiResponse({
    status: 404,
    description: 'Товар не найден',
  })
  @ApiResponse({
    status: 409,
    description:
      'Конфликт ключа, учёт отключён или будет превышен максимум',
  })
  async increaseStock(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Headers('idempotency-key')
    idempotencyKey: string | undefined,
    @Body() dto: IncreaseProductStockDto,
  ): Promise<void> {
    if (
      typeof idempotencyKey !== 'string' ||
      !isUUID(idempotencyKey, '4')
    ) {
      throw new BadRequestException(
        'Заголовок Idempotency-Key должен содержать UUID v4',
      );
    }

    const quantity = StockMovementQuantity.create(
      dto.quantity,
    );

    const result =
      await this.increaseProductStockUseCase.execute({
        idempotencyKey: idempotencyKey.toLowerCase(),
        productId: id.toLowerCase(),
        quantity,
      });

    switch (result) {
      case 'applied':
      case 'replayed':
        return;

      case 'key-conflict':
        throw new ConflictException(
          'Idempotency-Key уже использован для другой операции',
        );

      case 'not-found':
        throw new NotFoundException('Товар не найден');

      case 'inventory-disabled':
        throw new ConflictException(
          'Учёт остатков для товара отключён',
        );

      case 'limit-exceeded':
        throw new ConflictException(
          'Приход превысит максимально допустимый остаток',
        );
    }
  }

  @Post(':id/inventory')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Включить учёт остатков',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 товара',
    format: 'uuid',
  })
  @ApiResponse({
    status: 204,
    description: 'Учёт включён',
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректный UUID или количество',
  })
  @ApiResponse({
    status: 404,
    description: 'Товар не найден',
  })
  @ApiResponse({
    status: 409,
    description: 'Учёт уже включён',
  })
  async enableInventoryTracking(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: EnableProductInventoryTrackingDto,
  ): Promise<void> {
    const quantity = StockQuantity.create(dto.quantity);

    const result =
      await this.enableProductInventoryTrackingUseCase.execute({
        id,
        quantity,
      });

    switch (result) {
      case 'enabled':
        return;

      case 'not-found':
        throw new NotFoundException('Товар не найден');

      case 'already-tracked':
        throw new ConflictException(
          'Учёт остатков для товара уже включён',
        );
    }
  }

  @Delete(':id/inventory')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Отключить учёт остатков',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 товара',
    format: 'uuid',
  })
  @ApiResponse({
    status: 204,
    description: 'Учёт отключён',
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректный UUID',
  })
  @ApiResponse({
    status: 404,
    description: 'Товар не найден',
  })
  async disableInventoryTracking(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ): Promise<void> {
    const disabled =
      await this.disableProductInventoryTrackingUseCase.execute({
        id,
      });

    if (!disabled) {
      throw new NotFoundException('Товар не найден');
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Создать товар',
  })
  @ApiResponse({
    status: 201,
    description: 'Товар создан',
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректное название, описание или slug',
  })
  @ApiResponse({
    status: 409,
    description: 'Slug уже занят',
  })
  async create(@Body() dto: CreateProductDto) {
    const result = await this.createProductUseCase.execute({
      name: dto.name,
      description: dto.description,
      slug: dto.slug,
    });

    if (result.status === 'slug-taken') {
      throw new ConflictException('Slug уже занят');
    }

    return result.product;
  }

  @Get()
  @ApiOperation({
    summary: 'Получить страницу товаров',
  })
  @ApiResponse({
    status: 200,
    description: 'Страница товаров',
    type: ProductPageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректные параметры пагинации',
  })
  findPage(@Query() query: ListProductsQueryDto) {
    return this.listProductsUseCase.execute({
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить товар по ID',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 товара',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Товар найден',
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректный UUID',
  })
  @ApiResponse({
    status: 404,
    description: 'Товар не найден',
  })
  async findById(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    const product = await this.getProductByIdUseCase.execute({
      id,
    });

    if (product === null) {
      throw new NotFoundException('Товар не найден');
    }

    return product;
  }

  @Patch(':id/details')
  @ApiOperation({
    summary: 'Обновить описание и/или slug товара',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 товара',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description:
      'Актуальное тело товара; пустое тело и совпадающий slug — успешный no-op',
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректные поля',
  })
  @ApiResponse({
    status: 404,
    description: 'Товар не найден',
  })
  @ApiResponse({
    status: 409,
    description: 'Slug уже занят',
  })
  async updateDetails(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: UpdateProductDetailsDto,
  ) {
    const result = await this.updateProductDetailsUseCase.execute({
      id,
      description: dto.description,
      slug: dto.slug,
    });

    switch (result.status) {
      case 'updated':
        return result.product;

      case 'not-found':
        throw new NotFoundException('Товар не найден');

      case 'slug-taken':
        throw new ConflictException('Slug уже занят');
    }
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Переименовать товар',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 товара',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Товар переименован',
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректный UUID или название',
  })
  @ApiResponse({
    status: 404,
    description: 'Товар не найден',
  })
  async rename(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: RenameProductDto,
  ) {
    const product = await this.renameProductUseCase.execute({
      id,
      name: dto.name,
    });

    if (product === null) {
      throw new NotFoundException('Товар не найден');
    }

    return product;
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Архивировать товар',
    description:
      'Убирает товар из активного каталога. Сохраняет запись, остаток, '
      + 'движения и ключи идемпотентности. Повтор для уже архивного — 204.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 товара',
    format: 'uuid',
  })
  @ApiResponse({
    status: 204,
    description: 'Товар архивирован или уже был в архиве',
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректный UUID',
  })
  @ApiResponse({
    status: 404,
    description: 'Товар не найден',
  })
  async archive(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ): Promise<void> {
    const result = await this.archiveProductUseCase.execute({
      id,
    });

    switch (result) {
      case 'archived':
      case 'replayed':
        return;

      case 'not-found':
        throw new NotFoundException('Товар не найден');
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Физически удалить товар',
    description:
      'Удаляет только товар без истории складских движений и без '
      + 'положительного остатка. Иначе используйте архивацию.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 товара',
    format: 'uuid',
  })
  @ApiResponse({
    status: 204,
    description: 'Товар удалён',
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректный UUID',
  })
  @ApiResponse({
    status: 404,
    description: 'Товар не найден',
  })
  @ApiResponse({
    status: 409,
    description:
      'Есть история движений или положительный остаток',
  })
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ): Promise<void> {
    const result = await this.deleteProductUseCase.execute({
      id,
    });

    switch (result) {
      case 'deleted':
        return;

      case 'not-found':
        throw new NotFoundException('Товар не найден');

      case 'positive-stock':
        throw new ConflictException(
          'Нельзя удалить товар с положительным остатком',
        );

      case 'has-history':
        throw new ConflictException(
          'Товар имеет историю складских операций; используйте архивацию',
        );
    }
  }

  @Patch(':id/price')
  @ApiOperation({
    summary: 'Изменить цену товара',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 товара',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Цена изменена',
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректный UUID или цена',
  })
  @ApiResponse({
    status: 404,
    description: 'Товар не найден',
  })
  async changePrice(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: ChangeProductPriceDto,
  ) {
    const product = await this.changeProductPriceUseCase.execute({
      id,
      amount: dto.amount,
    });

    if (product === null) {
      throw new NotFoundException('Товар не найден');
    }

    return product;
  }
}
