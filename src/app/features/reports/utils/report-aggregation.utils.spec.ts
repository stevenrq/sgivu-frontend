import { ContractStatus } from '../../purchase-sales/models/contract-status.enum';
import { ContractType } from '../../purchase-sales/models/contract-type.enum';
import { PaymentMethod } from '../../purchase-sales/models/payment-method.enum';
import { PurchaseSale } from '../../purchase-sales/models/purchase-sale.model';
import {
  aggregateRevenueVsExpenses,
  computeInventoryTurnover,
} from './report-aggregation.utils';

function buildContract(overrides: Partial<PurchaseSale>): PurchaseSale {
  return {
    id: 1,
    clientId: 1,
    userId: 1,
    vehicleId: 1,
    purchasePrice: 0,
    salePrice: 0,
    contractType: ContractType.PURCHASE,
    contractStatus: ContractStatus.ACTIVE,
    paymentLimitations: 'Sin restricciones',
    paymentTerms: 'Pago único',
    paymentMethod: PaymentMethod.CASH,
    ...overrides,
  };
}

describe('report-aggregation.utils', () => {
  describe('aggregateRevenueVsExpenses()', () => {
    it('Debe anclar la ventana mensual al mes más reciente con datos', () => {
      const contracts: PurchaseSale[] = [
        buildContract({
          id: 10,
          contractType: ContractType.PURCHASE,
          purchasePrice: 100_000,
          createdAt: '2025-03-10T00:00:00',
        }),
        buildContract({
          id: 11,
          contractType: ContractType.SALE,
          salePrice: 150_000,
          createdAt: '2025-04-15T00:00:00',
        }),
      ];

      const result = aggregateRevenueVsExpenses(contracts, 2);

      expect(result.labels.length).toBe(2);
      expect(result.expenses).toEqual([100_000, 0]);
      expect(result.revenue).toEqual([0, 150_000]);
    });
  });

  describe('computeInventoryTurnover()', () => {
    it('Debe calcular rotación cuando los contratos son históricos', () => {
      const contracts: PurchaseSale[] = [
        buildContract({
          id: 20,
          vehicleId: 1,
          contractType: ContractType.PURCHASE,
          purchasePrice: 80_000,
          createdAt: '2025-03-05T00:00:00',
        }),
        buildContract({
          id: 21,
          vehicleId: 1,
          contractType: ContractType.SALE,
          salePrice: 120_000,
          contractStatus: ContractStatus.COMPLETED,
          createdAt: '2025-04-07T00:00:00',
        }),
      ];

      const result = computeInventoryTurnover(contracts, 2);

      expect(result.trend.length).toBe(2);
      expect(result.trend[0].rate).toBe(0);
      expect(result.trend[1].rate).toBe(1);
      expect(result.rate).toBe(1);
    });
  });
});
