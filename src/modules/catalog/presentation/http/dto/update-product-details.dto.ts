import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { PRODUCT_DESCRIPTION_MAX_LENGTH } from
  '../../../domain/value-objects/product-description.js';
import { PRODUCT_SLUG_MAX_LENGTH } from
  '../../../domain/value-objects/product-slug.js';

export class UpdateProductDetailsDto {
  @ApiPropertyOptional({
    description:
      'Описание карточки; null или пустая строка очищает описание',
    example: 'Обновлённое описание',
    nullable: true,
    maxLength: PRODUCT_DESCRIPTION_MAX_LENGTH,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(PRODUCT_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Новый URL-slug',
    example: 'proektor-kubster',
    maxLength: PRODUCT_SLUG_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRODUCT_SLUG_MAX_LENGTH)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug может содержать только латиницу в нижнем регистре, цифры и дефисы',
  })
  slug?: string;
}
