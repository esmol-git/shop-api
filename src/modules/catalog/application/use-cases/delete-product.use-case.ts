import type {
  DeleteProductResult,
  ProductRepository,
} from '../ports/product.repository.js';

export interface DeleteProductInput {
  id: string;
}

export class DeleteProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(
    input: DeleteProductInput,
  ): Promise<DeleteProductResult> {
    return this.productRepository.deleteById(input.id);
  }
}
