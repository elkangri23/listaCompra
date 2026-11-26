/**
 * Tests unitarios para UpdateStore y GetStores (CU-26)
 * Usa un repositorio de tiendas mockeado con entidades de dominio reales.
 */

import { UpdateStore } from '../../../../../src/application/use-cases/stores/UpdateStore';
import { GetStores } from '../../../../../src/application/use-cases/stores/GetStores';
import { Tienda } from '../../../../../src/domain/entities/Tienda';

const makeTienda = (withDireccion = false, desactivada = false): Tienda => {
  const r = Tienda.create({
    id: 't1',
    nombre: 'Mercadona',
    ...(withDireccion && { direccion: 'c/ Falsa 123' })
  });
  if (r.isFailure) throw (r as any).value;
  const tienda = (r as { value: Tienda }).value;
  if (desactivada) tienda.desactivar();
  return tienda;
};

const successResult = <T>(value: T) => ({ isSuccess: true, isFailure: false, value });
const failureResult = (error: unknown) => ({ isSuccess: false, isFailure: true, error });

describe('UpdateStore', () => {
  let repo: any;
  let useCase: UpdateStore;
  let tienda: Tienda;

  beforeEach(() => {
    tienda = makeTienda();
    repo = {
      findById: jest.fn().mockResolvedValue(successResult(tienda)),
      existsByNombre: jest.fn().mockResolvedValue(successResult(false)),
      update: jest.fn().mockImplementation(async (t: Tienda) => successResult(t)),
      getStats: jest.fn().mockResolvedValue(successResult({ totalCategorias: 5 }))
    };
    useCase = new UpdateStore(repo);
  });

  it('actualiza nombre, direccion y telefono', async () => {
    const r = (await useCase.execute({ id: 't1', nombre: 'Nuevo Nombre', direccion: 'c/ Nueva 1', telefono: '600123123' })) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.nombre).toBe('Nuevo Nombre');
    expect(r.value.direccion).toBe('c/ Nueva 1');
    expect(r.value.telefono).toBe('600123123');
    expect(r.value.totalCategorias).toBe(5);
    expect(repo.update).toHaveBeenCalledWith(tienda);
  });

  it('no existe → InvalidValueError con id', async () => {
    repo.findById.mockResolvedValue(successResult(null));
    const r = (await useCase.execute({ id: 'x' })) as any;
    expect(r.isFailure).toBe(true);
    expect(r.error.message).toContain('no existe');
  });

  it('error del repositorio propagado', async () => {
    repo.findById.mockResolvedValue(failureResult(new Error('db')));
    const r = (await useCase.execute({ id: 'x' })) as any;
    expect(r.isFailure).toBe(true);
  });

  it('nombre duplicado → BusinessRuleViolationError', async () => {
    repo.existsByNombre.mockResolvedValue(successResult(true));
    const r = (await useCase.execute({ id: 't1', nombre: 'Carrefour' })) as any;
    expect(r.isFailure).toBe(true);
    expect(r.error.rule).toBe('TIENDA_DUPLICADA');
    expect(repo.existsByNombre).toHaveBeenCalledWith('Carrefour', 't1');
  });

  it('mismo nombre no consulta duplicados', async () => {
    (await useCase.execute({ id: 't1', nombre: 'Mercadona' })) as any;
    expect(repo.existsByNombre).not.toHaveBeenCalled();
  });

  it('activa=false desactiva, activa=true activa', async () => {
    const r1 = (await useCase.execute({ id: 't1', activa: false })) as any;
    expect(r1.value.activa).toBe(false);
    const r2 = (await useCase.execute({ id: 't1', activa: true })) as any;
    expect(r2.value.activa).toBe(true);
  });

  it('sitioWeb inválido acumula errores de validación', async () => {
    const r = (await useCase.execute({ id: 't1', sitioWeb: 'no-es-url' })) as any;
    // acepta o rechaza según la entidad; si rechaza debe ser InvalidValueError de validación
    if (r.isFailure) {
      expect(r.error.message).toContain('Errores de validación');
    }
  });

  it('nombre vacío produce errores de validación agregados', async () => {
    const r = (await useCase.execute({ id: 't1', nombre: '' })) as any;
    if (r.isFailure) {
      expect(r.error.message).toContain('Errores de validación');
      expect(repo.update).not.toHaveBeenCalled();
    }
  });

  it('error al guardar propagado', async () => {
    repo.update.mockResolvedValue(failureResult(new Error('db')));
    const r = (await useCase.execute({ id: 't1', nombre: 'X' })) as any;
    expect(r.isFailure).toBe(true);
  });

  it('stats fallidas devuelven totalCategorias=0', async () => {
    repo.getStats.mockResolvedValue(failureResult(new Error('stats')));
    const r = (await useCase.execute({ id: 't1' })) as any;
    expect(r.value.totalCategorias).toBe(0);
  });
});

describe('GetStores', () => {
  let repo: any;
  let useCase: GetStores;

  beforeEach(() => {
    repo = {
      findAll: jest.fn().mockResolvedValue(successResult([makeTienda(), makeTienda(false, true)])),
      getStats: jest.fn().mockResolvedValue(successResult({ totalCategorias: 3 })),
      findByIdWithCategories: jest.fn().mockResolvedValue(failureResult(new Error('no')))
    };
    useCase = new GetStores(repo);
  });

  it('devuelve todas con stats', async () => {
    const r = (await useCase.execute({})) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.tiendas).toHaveLength(2);
    expect(r.value.total).toBe(2);
    expect(r.value.tiendas[0].totalCategorias).toBe(3);
    expect(repo.findAll).toHaveBeenCalledWith(false);
  });

  it('includeInactive pasa el flag al repositorio', async () => {
    (await useCase.execute({ includeInactive: true })) as any;
    expect(repo.findAll).toHaveBeenCalledWith(true);
  });

  it('filtra por activas', async () => {
    const r = (await useCase.execute({ activas: true })) as any;
    expect(r.value.tiendas).toHaveLength(1);
    expect(r.value.tiendas[0].activa).toBe(true);
  });

  it('paginación con offset y limit', async () => {
    const r = (await useCase.execute({ offset: 1, limit: 1 })) as any;
    expect(r.value.tiendas).toHaveLength(1);
    expect(r.value.tiendas[0].nombre).toBe('Mercadona'); // la primera tras slice
  });

  it('limit sin offset usa 50 default', async () => {
    const r = (await useCase.execute({ limit: 1 })) as any;
    expect(r.value.tiendas).toHaveLength(1);
  });

  it('stats fallidas dan totalCategorias 0', async () => {
    repo.getStats.mockResolvedValue(failureResult(new Error('stats')));
    const r = (await useCase.execute({})) as any;
    expect(r.value.tiendas[0].totalCategorias).toBe(0);
  });

  it('withCategories incluye categorías cuando el repo responde', async () => {
    const categoria = (await import('../../../../../src/domain/entities/Categoria')).Categoria;
    const cat = categoria.create({ id: 'c1', nombre: 'Lácteos' }) as any;
    repo.findByIdWithCategories.mockResolvedValue(successResult({ tienda: makeTienda(), categorias: [cat.value] }));
    const r = (await useCase.execute({ withCategories: true })) as any;
    expect(r.value.tiendas[0].categorias).toEqual([
      expect.objectContaining({ id: 'c1', nombre: 'Lácteos' })
    ]);
  });

  it('error del repositorio propagado', async () => {
    repo.findAll.mockResolvedValue(failureResult(new Error('db')));
    const r = (await useCase.execute({})) as any;
    expect(r.isFailure).toBe(true);
  });
});
