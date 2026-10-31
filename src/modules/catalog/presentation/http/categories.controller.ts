import {
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateCategoryUseCase } from
  '../../application/use-cases/create-category.use-case.js';
import { GetCategoryByIdUseCase } from
  '../../application/use-cases/get-category-by-id.use-case.js';
import { ListCategoriesUseCase } from
  '../../application/use-cases/list-categories.use-case.js';
import { ListCategoryTreeUseCase } from
  '../../application/use-cases/list-category-tree.use-case.js';
import { RenameCategoryUseCase } from
  '../../application/use-cases/rename-category.use-case.js';

import { CreateCategoryDto } from './dto/create-category.dto.js';
import { RenameCategoryDto } from './dto/rename-category.dto.js';
import {
  CategoryResponseDto,
  CategoryTreeNodeResponseDto,
} from './swagger/category-response.dto.js';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(
    @Inject(CreateCategoryUseCase)
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    @Inject(ListCategoriesUseCase)
    private readonly listCategoriesUseCase: ListCategoriesUseCase,
    @Inject(ListCategoryTreeUseCase)
    private readonly listCategoryTreeUseCase: ListCategoryTreeUseCase,
    @Inject(GetCategoryByIdUseCase)
    private readonly getCategoryByIdUseCase: GetCategoryByIdUseCase,
    @Inject(RenameCategoryUseCase)
    private readonly renameCategoryUseCase: RenameCategoryUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Создать категорию' })
  @ApiResponse({
    status: 201,
    type: CategoryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректное тело',
  })
  @ApiResponse({
    status: 404,
    description: 'Родитель не найден',
  })
  @ApiResponse({
    status: 409,
    description: 'Slug занят или превышена глубина дерева',
  })
  async create(@Body() dto: CreateCategoryDto) {
    const result = await this.createCategoryUseCase.execute({
      name: dto.name,
      slug: dto.slug,
      parentId: dto.parentId,
    });

    switch (result.status) {
      case 'created':
        return result.category;

      case 'slug-taken':
        throw new ConflictException('Slug уже занят');

      case 'parent-not-found':
        throw new NotFoundException('Родительская категория не найдена');

      case 'depth-exceeded':
        throw new ConflictException(
          'Превышена максимальная глубина дерева категорий',
        );
    }
  }

  @Get()
  @ApiOperation({ summary: 'Плоский список категорий' })
  @ApiResponse({
    status: 200,
    type: [CategoryResponseDto],
  })
  list() {
    return this.listCategoriesUseCase.execute();
  }

  @Get('tree')
  @ApiOperation({ summary: 'Дерево категорий' })
  @ApiResponse({
    status: 200,
    type: [CategoryTreeNodeResponseDto],
  })
  tree() {
    return this.listCategoryTreeUseCase.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Категория по ID' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    type: CategoryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Категория не найдена',
  })
  async findById(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    const category = await this.getCategoryByIdUseCase.execute({ id });

    if (category === null) {
      throw new NotFoundException('Категория не найдена');
    }

    return category;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Переименовать категорию',
    description:
      'Только name. Пустое тело или то же имя после trim — 200 no-op без записи.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    type: CategoryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректное тело (в т.ч. name: null / пустое)',
  })
  @ApiResponse({
    status: 404,
    description: 'Категория не найдена',
  })
  async rename(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: RenameCategoryDto,
  ) {
    const result = await this.renameCategoryUseCase.execute({
      id,
      name: dto.name,
    });

    if (result.status === 'not-found') {
      throw new NotFoundException('Категория не найдена');
    }

    return result.category;
  }
}
