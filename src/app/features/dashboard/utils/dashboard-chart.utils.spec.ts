import { ContractStatus } from '../../purchase-sales/models/contract-status.enum';
import { ContractType } from '../../purchase-sales/models/contract-type.enum';
import { PaymentMethod } from '../../purchase-sales/models/payment-method.enum';
import { PurchaseSale } from '../../purchase-sales/models/purchase-sale.model';
import { buildMonthlySalesTrendData } from './dashboard-chart.utils';

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
    paymentTerms: 'Pago unico',
    paymentMethod: PaymentMethod.CASH,
    ...overrides,
  };
}

describe('dashboard-chart.utils', () => {
  describe('buildMonthlySalesTrendData()', () => {
    it('Debe anclar la ventana mensual al ultimo mes con datos historicos', () => {
      const contracts: PurchaseSale[] = [
        buildContract({
          id: 10,
          contractType: ContractType.SALE,
          contractStatus: ContractStatus.COMPLETED,
          salePrice: 80_000,
          createdAt: '2025-03-10T00:00:00',
        }),
        buildContract({
          id: 11,
          contractType: ContractType.SALE,
          contractStatus: ContractStatus.COMPLETED,
          salePrice: 120_000,
          createdAt: '2025-04-15T00:00:00',
        }),
      ];

      const result = buildMonthlySalesTrendData(contracts, 2);

      expect(result.labels).toEqual(['Mar 2025', 'Abr 2025']);
      expect(result.datasets[0].data).toEqual([1, 1]);
    });

    it('Debe usar updatedAt cuando createdAt no este disponible', () => {
      const contracts: PurchaseSale[] = [
        buildContract({
          id: 20,
          contractType: ContractType.SALE,
          contractStatus: ContractStatus.COMPLETED,
          salePrice: 95_000,
          createdAt: undefined,
          updatedAt: '2025-03-05T00:00:00',
        }),
        buildContract({
          id: 21,
          contractType: ContractType.SALE,
          contractStatus: ContractStatus.COMPLETED,
          salePrice: 110_000,
          createdAt: '2025-04-02T00:00:00',
        }),
      ];

      const result = buildMonthlySalesTrendData(contracts, 2);

      expect(result.datasets[0].data).toEqual([1, 1]);
    });

    it('Debe ignorar fechas invalidas sin romper el conteo', () => {
      const contracts: PurchaseSale[] = [
        buildContract({
          id: 30,
          contractType: ContractType.SALE,
          contractStatus: ContractStatus.COMPLETED,
          createdAt: 'fecha-invalida',
        }),
        buildContract({
          id: 31,
          contractType: ContractType.SALE,
          contractStatus: ContractStatus.COMPLETED,
          createdAt: '2025-04-10T00:00:00',
        }),
      ];

      const result = buildMonthlySalesTrendData(contracts, 1);

      expect(result.labels).toEqual(['Abr 2025']);
      expect(result.datasets[0].data).toEqual([1]);
    });

    it('Debe permitir contar ventas no completadas cuando el modo es "all"', () => {
      const contracts: PurchaseSale[] = [
        buildContract({
          id: 40,
          contractType: ContractType.SALE,
          contractStatus: ContractStatus.COMPLETED,
          createdAt: '2025-03-10T00:00:00',
        }),
        buildContract({
          id: 41,
          contractType: ContractType.SALE,
          contractStatus: ContractStatus.ACTIVE,
          createdAt: '2025-03-12T00:00:00',
        }),
      ];

      const completedResult = buildMonthlySalesTrendData(contracts, 1);
      const allResult = buildMonthlySalesTrendData(contracts, 1, 'all');

      expect(completedResult.datasets[0].data).toEqual([1]);
      expect(allResult.datasets[0].data).toEqual([2]);
    });
  });
});
