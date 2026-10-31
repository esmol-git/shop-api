import type {
  ArchiveProductResult,
  ProductRepository,
} from '../ports/product.repository.js';

export interface ArchiveProductInput {
  id: string;
}

export class ArchiveProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(
    input: ArchiveProductInput,
  ): Promise<ArchiveProductResult> {
    return this.productRepository.archiveById(input.id);
  }
}
