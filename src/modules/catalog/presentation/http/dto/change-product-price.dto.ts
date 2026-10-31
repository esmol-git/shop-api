import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

import { ProductPrice } from
  '../../../domain/value-objects/product-price.js';

export class ChangeProductPriceDto {
  @ApiProperty({
    description: 'Новая цена в копейках; 0 допустим',
    example: 199_900,
    minimum: 0,
    maximum: ProductPrice.MAX_AMOUNT,
  })
  @IsInt()
  @Min(0)
  @Max(ProductPrice.MAX_AMOUNT)
  amount!: number;
}
