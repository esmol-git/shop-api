import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class RenameProductDto {
  @ApiProperty({
    description: 'Новое название товара; пробелы по краям обрезаются',
    example: 'Проектор Kubster',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  name!: string;
}
