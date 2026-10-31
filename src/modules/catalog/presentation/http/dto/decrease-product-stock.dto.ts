import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsInt, Max, Min } from 'class-validator';

import { StockMovementQuantity } from
  '../../../domain/value-objects/stock-movement-quantity.js';

export class DecreaseProductStockDto {
  @ApiProperty({
    description: 'Количество списания; должно быть больше нуля',
    example: 3,
    minimum: 1,
    maximum: StockMovementQuantity.MAX_VALUE,
  })
  @IsDefined({
    message: 'Количество обязательно',
  })
  @IsInt({
    message: 'Количество операции должно быть целым числом',
  })
  @Min(1, {
    message: 'Количество операции должно быть больше нуля',
  })
  @Max(StockMovementQuantity.MAX_VALUE, {
    message: 'Количество операции превышает допустимый максимум',
  })
  quantity!: number;
}
