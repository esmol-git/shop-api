import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

function parseIntegerQuery(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (!/^\d+$/.test(value)) {
    return Number.NaN;
  }

  return Number(value);
}

export class ListProductsQueryDto {
  @ApiPropertyOptional({
    description: 'Размер страницы',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @Transform(({ value }) => parseIntegerQuery(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Смещение от начала списка',
    default: 0,
    minimum: 0,
    example: 0,
  })
  @Transform(({ value }) => parseIntegerQuery(value))
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  offset: number = 0;
}
