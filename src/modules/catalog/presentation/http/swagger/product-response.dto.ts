import { ApiProperty } from '@nestjs/swagger';

export class ProductPriceResponseDto {
  @ApiProperty({
    description: 'Цена в копейках',
    example: 199_900,
    minimum: 0,
    maximum: 2_147_483_647,
  })
  amount!: number;

  @ApiProperty({
    description: 'Валюта цены',
    enum: ['RUB'],
    example: 'RUB',
  })
  currency!: 'RUB';
}

export class ProductInventoryResponseDto {
  @ApiProperty({
    description:
      'true — учёт остатков включён; false — учёт отключён',
    example: true,
  })
  tracked!: boolean;

  @ApiProperty({
    description:
      'Остаток при включённом учёте; null, если учёт отключён',
    example: 10,
    nullable: true,
    type: Number,
    minimum: 0,
    maximum: 2_147_483_647,
  })
  quantity!: number | null;
}

export class ProductResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '8acdf042-48bf-4aa5-bfb1-e457ad9dce09',
  })
  id!: string;

  @ApiProperty({
    example: 'Проектор Epson',
  })
  name!: string;

  @ApiProperty({
    description: 'Описание карточки; null — не задано',
    example: 'Компактный проектор для домашних кинотеатров',
    nullable: true,
    type: String,
  })
  description!: string | null;

  @ApiProperty({
    description: 'Уникальный URL-идентификатор',
    example: 'proektor-epson',
  })
  slug!: string;

  @ApiProperty({
    description: 'null — цена не назначена; 0 — нулевая цена допустима',
    type: ProductPriceResponseDto,
    nullable: true,
  })
  price!: ProductPriceResponseDto | null;

  @ApiProperty({
    type: ProductInventoryResponseDto,
  })
  inventory!: ProductInventoryResponseDto;

  @ApiProperty({
    description:
      'null — товар в активном каталоге; ISO-время — момент архивации',
    example: null,
    nullable: true,
    type: String,
    format: 'date-time',
  })
  archivedAt!: string | null;

  @ApiProperty({
    description: 'Момент создания товара',
    example: '2026-10-30T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({
    description:
      'Момент последнего изменения строки товара '
      + '(карточка, остаток, учёт или архивация)',
    example: '2026-10-30T12:05:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt!: string;
}

export class ProductPageResponseDto {
  @ApiProperty({
    type: [ProductResponseDto],
  })
  items!: ProductResponseDto[];

  @ApiProperty({
    description: 'Общее количество товаров',
    example: 41,
    minimum: 0,
  })
  total!: number;

  @ApiProperty({
    description: 'Размер страницы',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  limit!: number;

  @ApiProperty({
    description: 'Смещение от начала списка',
    example: 0,
    minimum: 0,
  })
  offset!: number;
}
