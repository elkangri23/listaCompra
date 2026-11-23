/**
 * CU-30: Análisis de Hábitos de Compra
 * Recopila el historial de compras del usuario (productos comprados en sus
 * listas) dentro de un rango temporal, lo agrega y lo envía al servicio de IA
 * para obtener insights de frecuencia, estacionalidad, preferencias y
 * optimización.
 */

import { Result, success, failure } from '../../../shared/result';
import {
  AnalyzePurchaseHabitsDto,
  PurchaseHabitsResponse,
  PRESET_DAYS,
  TimeRangePreset
} from '../../dto/ai/AnalyzePurchaseHabitsDto';
import { IUsuarioRepository } from '../../ports/repositories/IUsuarioRepository';
import { IListaRepository } from '../../ports/repositories/IListaRepository';
import { IProductoRepository } from '../../ports/repositories/IProductoRepository';
import { ICategoriaRepository } from '../../ports/repositories/ICategoriaRepository';
import { ITiendaRepository } from '../../ports/repositories/ITiendaRepository';
import { IAIService, PurchaseHistoryData, PurchaseInsight } from '../../ports/external/IAIService';
import { ValidationError } from '../../errors/ValidationError';
import { UnauthorizedError } from '../../errors/UnauthorizedError';
import { NotFoundError } from '../../errors/NotFoundError';
import { Logger } from '../../../infrastructure/observability/logger/Logger';
import { Producto } from '../../../domain/entities/Producto';
import { Lista } from '../../../domain/entities/Lista';

export class AnalyzePurchaseHabitsUseCase {
  private readonly logger = new Logger('AnalyzePurchaseHabits');

  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly listaRepository: IListaRepository,
    private readonly productoRepository: IProductoRepository,
    private readonly categoriaRepository: ICategoriaRepository,
    private readonly tiendaRepository: ITiendaRepository,
    private readonly aiService: IAIService
  ) {}

  async execute(
    dto: AnalyzePurchaseHabitsDto,
    requesterId: string,
    requesterRol?: string
  ): Promise<Result<PurchaseHabitsResponse, ValidationError | UnauthorizedError | NotFoundError | Error>> {
    try {
      // 1. Solo el propio usuario (o un admin) puede analizar sus hábitos
      if (dto.userId !== requesterId && requesterRol !== 'ADMIN') {
        return failure(new UnauthorizedError(
          'Solo puedes analizar tus propios hábitos de compra'
        ));
      }

      // 2. El usuario debe existir
      const usuarioResult = await this.usuarioRepository.findById(dto.userId);
      const usuario = usuarioResult.isSuccess ? usuarioResult.value : null;
      if (!usuario) {
        return failure(new NotFoundError('Usuario', dto.userId));
      }

      // 3. Calcular rango temporal
      const end = new Date();
      const days = PRESET_DAYS[dto.timeRange as TimeRangePreset];
      const start = days === null ? null : new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

      // 4. Listas del usuario (hasta 100 para no desbordar el análisis)
      const listasResult = await this.listaRepository.findByOwner(
        dto.userId,
        undefined,
        { page: 1, limit: 100 }
      );
      const listas: Lista[] = listasResult.isSuccess ? listasResult.value.items : [];

      if (listas.length === 0) {
        return success(this.buildResponse([], listas.length, 0, dto.timeRange, start, end));
      }

      // 5. Recopilar productos comprados de todas las listas
      const purchased: Producto[] = [];
      for (const lista of listas) {
        const productosResult = await this.productoRepository.findByList(
          lista.id,
          { comprado: true },
          { page: 1, limit: 500 }
        );
        if (productosResult.isSuccess) {
          purchased.push(...productosResult.value.items);
        }
      }

      // 6. Filtrar por rango temporal (requiere fecha de compra)
      const inRange = purchased.filter(p => {
        const fecha = p.fechaCompra;
        if (!fecha) return false;
        return (!start || fecha >= start) && fecha <= end;
      });

      if (inRange.length === 0) {
        return success(this.buildResponse([], listas.length, 0, dto.timeRange, start, end));
      }

      // 7. Enriquecer con nombres de categoría y tienda (en paralelo, con caché local)
      const categoriaNombres = new Map<string, string>();
      const tiendaNombres = new Map<string, string>();
      const listaTienda = new Map<string, string>(); // listaId -> nombre de tienda

      const categoriaIds = [...new Set(inRange.map(p => p.categoriaId).filter((id): id is string => !!id))];
      const tiendaIds = [...new Set(listas.map(l => l.tiendaId).filter((id): id is string => !!id))];

      for (const lista of listas) {
        if (lista.tiendaId) {
          listaTienda.set(lista.id, lista.tiendaId);
        }
      }

      await Promise.all([
        ...categoriaIds.map(async id => {
          const r = await this.categoriaRepository.findById(id);
          if (r.isSuccess && r.value) categoriaNombres.set(id, r.value.nombre);
        }),
        ...tiendaIds.map(async id => {
          const r = await this.tiendaRepository.findById(id);
          if (r.isSuccess && r.value) tiendaNombres.set(id, r.value.nombre);
        })
      ]);

      // 8. Agregar historial: frecuencia por nombre de producto (normalizado)
      const history = this.buildPurchaseHistory(inRange, categoriaNombres, tiendaNombres, listaTienda);

      // 9. Llamar a la IA
      const insights = await this.aiService.analyzePurchaseHabits(
        history,
        { start: start ?? new Date(0), end }
      );

      this.logger.ai('Análisis de hábitos completado', {
        userId: dto.userId,
        timeRange: dto.timeRange,
        historyEntries: history.length,
        insightsCount: insights.length
      });

      return success(this.buildResponse(insights, listas.length, history.length, dto.timeRange, start, end));

    } catch (error) {
      this.logger.error('Error inesperado en análisis de hábitos', error as Error, {
        userId: dto.userId
      });
      return failure(error instanceof Error ? error : new Error('Error interno del sistema'));
    }
  }

  /**
   * Convierte los productos comprados en datos de historial agregados por producto
   */
  private buildPurchaseHistory(
    productos: Producto[],
    categoriaNombres: Map<string, string>,
    tiendaNombres: Map<string, string>,
    listaTienda: Map<string, string>
  ): PurchaseHistoryData[] {
    const byName = new Map<string, {
      productName: string;
      category: string;
      storeName: string;
      lastPurchase: Date;
      quantity: number;
      totalPrice: number;
      pricedUnits: number;
      count: number;
    }>();

    for (const p of productos) {
      const key = p.nombre.trim().toLowerCase();
      const prev = byName.get(key);
      const tiendaId = listaTienda.get(p.listaId);
      const storeName = tiendaId ? (tiendaNombres.get(tiendaId) ?? '') : '';

      const entry = prev ?? {
        productName: p.nombre.trim(),
        category: p.categoriaId ? (categoriaNombres.get(p.categoriaId) ?? 'Sin categoría') : 'Sin categoría',
        storeName,
        lastPurchase: p.fechaCompra ?? new Date(0),
        quantity: 0,
        totalPrice: 0,
        pricedUnits: 0,
        count: 0
      };

      entry.count += 1;
      entry.quantity += p.cantidad ?? 1;
      if (p.fechaCompra && p.fechaCompra > entry.lastPurchase) {
        entry.lastPurchase = p.fechaCompra;
      }
      if (p.precio != null) {
        entry.totalPrice += p.precio * (p.cantidad ?? 1);
        entry.pricedUnits += (p.cantidad ?? 1);
      }

      byName.set(key, entry);
    }

    return [...byName.values()].map(e => {
      const data: PurchaseHistoryData = {
        productName: e.productName,
        category: e.category,
        storeName: e.storeName,
        purchaseDate: e.lastPurchase,
        quantity: e.quantity,
        frequency: e.count
      };
      if (e.pricedUnits > 0) {
        data.price = Math.round((e.totalPrice / e.pricedUnits) * 100) / 100;
      }
      return data;
    });
  }

  /**
   * Construye la respuesta con metadata
   */
  private buildResponse(
    insights: PurchaseInsight[],
    listsAnalyzed: number,
    historyEntries: number,
    preset: TimeRangePreset,
    start: Date | null,
    end: Date
  ): PurchaseHabitsResponse {
    return {
      insights,
      metadata: {
        period: {
          start: start ? start.toISOString() : null,
          end: end.toISOString(),
          preset
        },
        productsAnalyzed: historyEntries,
        listsAnalyzed,
        generatedAt: new Date().toISOString()
      }
    };
  }
}
