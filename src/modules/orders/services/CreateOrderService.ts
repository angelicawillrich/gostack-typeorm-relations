import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Product from '@modules/products/infra/typeorm/entities/Product';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('User does not exist.');
    }

    const foundProducts = await this.productsRepository.findAllById(products);

    if (foundProducts.length !== products.length) {
      throw new AppError('One or more products were not found.');
    }

    const productsWithUpdatedQuantity: Product[] = [];

    const validatedProducts = foundProducts.map(foundProduct => {
      const orderedProduct = products.find(
        product => product.id === foundProduct.id,
      );

      if (!orderedProduct) {
        throw new AppError(`Product ${foundProduct.name} was not found.`);
      }

      if (foundProduct.quantity < orderedProduct.quantity) {
        throw new AppError(
          `The product ${foundProduct.name} has not enough items.`,
        );
      }

      productsWithUpdatedQuantity.push({
        ...foundProduct,
        quantity: foundProduct.quantity - orderedProduct.quantity,
      });

      return {
        product_id: foundProduct.id,
        price: foundProduct.price,
        quantity: orderedProduct.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: validatedProducts,
    });

    await this.productsRepository.updateQuantity(productsWithUpdatedQuantity);

    return order;
  }
}

export default CreateProductService;
