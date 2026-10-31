import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { CATEGORY_NAME_MAX_LENGTH } from
  '../../../domain/value-objects/category-name.js';

export class RenameCategoryDto {
  @ApiPropertyOptional({
    description:
      'Новое название; отсутствие поля — no-op; null/пустая строка — 400',
    example: 'Очистные сооружения',
    maxLength: CATEGORY_NAME_MAX_LENGTH,
  })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(CATEGORY_NAME_MAX_LENGTH)
  name?: string;
}
