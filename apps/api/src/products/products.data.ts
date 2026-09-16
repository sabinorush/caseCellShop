import type { Product } from './product.types.js';

/**
 * Catálogo inicial (em memória). Cada chamada devolve uma cópia nova,
 * para que testes e o serviço singleton nunca compartilhem a mesma
 * referência de array/objetos entre si.
 */
export function createInitialProducts(): Product[] {
  return [
    {
      id: 'case-iphone-15-silicone',
      name: 'Capa de Silicone',
      model: 'iPhone 15',
      priceCents: 4990,
      stock: 12,
    },
    {
      id: 'case-iphone-15-transparente',
      name: 'Capa Transparente Anti-Impacto',
      model: 'iPhone 15',
      priceCents: 3990,
      stock: 8,
    },
    {
      id: 'case-galaxy-s24-couro',
      name: 'Capa de Couro Sintético',
      model: 'Galaxy S24',
      priceCents: 6990,
      stock: 5,
    },
    {
      id: 'case-galaxy-s24-carteira',
      name: 'Capa Carteira com Fecho',
      model: 'Galaxy S24',
      priceCents: 7990,
      stock: 3,
    },
    {
      id: 'case-moto-g84-silicone',
      name: 'Capa de Silicone',
      model: 'Moto G84',
      priceCents: 2990,
      stock: 20,
    },
    {
      id: 'case-xiaomi-13-esgotada',
      name: 'Capa Fosca Premium',
      model: 'Xiaomi 13',
      priceCents: 5490,
      stock: 0,
    },
  ];
}
