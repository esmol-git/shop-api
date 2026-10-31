import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { CATEGORY_NAME_MAX_LENGTH } from
  '../../../domain/value-objects/category-name.js';
import { CATEGORY_SLUG_MAX_LENGTH } from
  '../../../domain/value-objects/category-slug.js';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Название категории; пробелы по краям обрезаются',
    example: 'Кессоны',
    maxLength: CATEGORY_NAME_MAX_LENGTH,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(CATEGORY_NAME_MAX_LENGTH)
  name!: string;

  @ApiProperty({
    description:
      'URL-slug; trim + lowercase, затем проверка формата и уникальности',
    example: 'kessony',
    maxLength: CATEGORY_SLUG_MAX_LENGTH,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(CATEGORY_SLUG_MAX_LENGTH)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug может содержать только латиницу в нижнем регистре, цифры и дефисы',
  })
  slug!: string;

  @ApiPropertyOptional({
    description:
      'UUID v4 родителя. null или отсутствие поля — корневая категория',
    type: String,
    format: 'uuid',
    nullable: true,
    example: null,
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('4', {
    message: 'parentId должен быть UUID v4, null или отсутствовать',
  })
  parentId?: string | null;
}
