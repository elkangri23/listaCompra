/**
 * Tests unitarios para UpdateCategory (CU-13) y DeleteList (CU-06)
 */

import { UpdateCategory } from '../../../../src/application/use-cases/categories/UpdateCategory';
import { DeleteList } from '../../../../src/application/use-cases/lists/DeleteList';
import { Categoria } from '../../../../src/domain/entities/Categoria';
import { Lista } from '../../../../src/domain/entities/Lista';
import type { Result } from '../../../../src/shared/result';

const unwrap = <T>(r: Result<T, Error>): T | undefined => (r.isSuccess ? (r as { value: T }).value : undefined);
const unwrapFail = <T>(r: Result<T, Error>): Error => (r as { error: Error }).error;

const makeCategoria = (): Categoria =>
  (Categoria.create({ id: 'c1', nombre: 'Lácteos' }) as { value?: Categoria }).value!;

const makeLista = (): Lista =>
  (Lista.create({ id: 'l1', nombre: 'Compras', propietarioId: 'user-1' }) as { value?: Lista }).value!;

describe('UpdateCategory (CU-13)', () => {
  let categoriaRepository: any;
  let tiendaRepository: any;
  let useCase: UpdateCategory;
  let categoria: Categoria;

  beforeEach(() => {
    categoria = makeCategoria();
    categoriaRepository = {
      findById: jest.fn().mockResolvedValue({ isSuccess: true, value: categoria }),
      existsByNombreAndTienda: jest.fn().mockResolvedValue({ isSuccess: true, value: false }),
      update: jest.fn().mockImplementation(async (c: Categoria) => ({ isSuccess: true, value: c }))
    };
    tiendaRepository = {
      findById: jest.fn().mockResolvedValue({ isSuccess: true, value: { id: 't1', nombre: 'Mercadona', isActive: () => true } })
    };
    useCase = new UpdateCategory(categoriaRepository, tiendaRepository);
  });

  it('actualiza nombre y descripción', async () => {
    const result = await useCase.execute({ id: 'c1', nombre: 'Carnicería', descripcion: 'Todo carnes' });

    expect(result.isSuccess).toBe(true);
    const dto = unwrap(result)!;
    expect(dto.nombre).toBe('Carnicería');
    expect(categoriaRepository.update).toHaveBeenCalled();
  });

  it('falla si la categoría no existe', async () => {
    categoriaRepository.findById.mockResolvedValue({ isSuccess: true, value: null });

    const result = await useCase.execute({ id: 'c1', nombre: 'X' });

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('no existe');
  });

  it('falla si tienda asignada no existe', async () => {
    tiendaRepository.findById.mockResolvedValue({ isSuccess: true, value: null });

    const result = await useCase.execute({ id: 'c1', tiendaId: 't-none' });

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('tienda');
  });

  it('falla con regla de negocio si la tienda está inactiva', async () => {
    tiendaRepository.findById.mockResolvedValue({ isSuccess: true, value: { id: 't1', nombre: 'X', isActive: () => false } });

    const result = await useCase.execute({ id: 'c1', tiendaId: 't1' });

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('inactiva');
  });

  it('falla si el nombre ya existe en la tienda', async () => {
    categoriaRepository.existsByNombreAndTienda.mockResolvedValue({ isSuccess: true, value: true });

    const result = await useCase.execute({ id: 'c1', nombre: 'Otro' });

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('Ya existe');
  });

  it('remover tienda con tiendaId vacío es válido', async () => {
    const result = await useCase.execute({ id: 'c1', tiendaId: '' });

    expect(result.isSuccess).toBe(true);
  });

  it('actualiza estado activo (desactivar)', async () => {
    const result = await useCase.execute({ id: 'c1', activa: false });

    expect(result.isSuccess).toBe(true);
    expect(unwrap(result)!.activa).toBe(false);
  });

  it('propaga error de repositorio al actualizar', async () => {
    categoriaRepository.update.mockResolvedValue({ isSuccess: false, isFailure: true, error: new Error('DB down'), value: categoria });

    const result = await useCase.execute({ id: 'c1', nombre: 'Nuevo' });

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('DB down');
  });
});

describe('DeleteList (CU-06)', () => {
  let listaRepository: any;
  let outboxService: any;
  let useCase: DeleteList;
  let lista: Lista;

  beforeEach(() => {
    lista = makeLista();
    listaRepository = {
      findByIdAndOwner: jest.fn().mockResolvedValue({ isSuccess: true, value: lista }),
      save: jest.fn().mockResolvedValue({ isSuccess: true, value: lista }),
      hardDelete: jest.fn().mockResolvedValue({ isSuccess: true, value: true })
    };
    outboxService = { saveEvent: jest.fn().mockResolvedValue({ isSuccess: true, value: {} }) };
    useCase = new DeleteList(listaRepository, outboxService);
  });

  it('soft delete por defecto: desactiva, guarda y publica evento', async () => {
    const result = await useCase.execute('l1', { permanente: false }, 'user-1');

    expect(result.isSuccess).toBe(true);
    const dto = unwrap(result)!;
    expect(dto.eliminada).toBe(true);
    expect(dto.permanente).toBe(false);
    expect(lista.activa).toBe(false);
    expect(listaRepository.save).toHaveBeenCalled();
    expect(outboxService.saveEvent).toHaveBeenCalledTimes(1);
  });

  it('hard delete con permanente=true', async () => {
    const result = await useCase.execute('l1', { permanente: true }, 'user-1');

    expect(result.isSuccess).toBe(true);
    expect(unwrap(result)!.permanente).toBe(true);
    expect(listaRepository.hardDelete).toHaveBeenCalledWith('l1');
    expect(listaRepository.save).not.toHaveBeenCalled();
  });

  it('falla con listaId vacío', async () => {
    const result = await useCase.execute('  ', {}, 'user-1');

    expect(result.isFailure).toBe(true);
  });

  it('falla con propietarioId vacío', async () => {
    const result = await useCase.execute('l1', {}, '');

    expect(result.isFailure).toBe(true);
  });

  it('falla si la lista no existe para ese propietario', async () => {
    listaRepository.findByIdAndOwner.mockResolvedValue({ isSuccess: true, value: null });

    const result = await useCase.execute('l1', {}, 'user-1');

    expect(result.isFailure).toBe(true);
  });

  it('falla si ya está eliminada (inactiva)', async () => {
    lista.desactivar();

    const result = await useCase.execute('l1', {}, 'user-1');

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('ya ha sido eliminada');
  });

  it('propaga error al guardar', async () => {
    listaRepository.save.mockResolvedValue({ isSuccess: false, isFailure: true, error: new Error('save failed') });

    const result = await useCase.execute('l1', {}, 'user-1');

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toBe('save failed');
  });
});
