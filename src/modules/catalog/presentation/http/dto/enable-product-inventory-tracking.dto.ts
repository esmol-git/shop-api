import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsInt, Max, Min } from 'class-validator';

import { StockQuantity } from
  '../../../domain/value-objects/stock-quantity.js';

export class EnableProductInventoryTrackingDto {
  @ApiProperty({
    description: 'Начальный остаток при включении учёта; 0 допустим',
    example: 10,
    minimum: 0,
    maximum: StockQuantity.MAX_VALUE,
  })
  @IsDefined({
    message: 'Количество обязательно',
  })
  @IsInt({
    message: 'Остаток должен быть целым числом',
  })
  @Min(0, {
    message: 'Остаток не может быть отрицательным',
  })
  @Max(StockQuantity.MAX_VALUE, {
    message: 'Остаток превышает допустимый максимум',
  })
  quantity!: number;
}
