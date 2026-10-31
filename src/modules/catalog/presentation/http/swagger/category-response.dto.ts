import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
  })
  parentId!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
  })
  updatedAt!: string;
}

export class CategoryTreeNodeResponseDto extends CategoryResponseDto {
  @ApiProperty({
    type: () => [CategoryTreeNodeResponseDto],
  })
  children!: CategoryTreeNodeResponseDto[];
}
