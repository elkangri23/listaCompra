import { InMemoryListaRepository } from '@infrastructure/persistence/in-memory/InMemoryListaRepository';
import { Lista, type ListaProps } from '@domain/entities/Lista';

describe('InMemoryListaRepository', () => {
  const createLista = (overrides: Partial<ListaProps> = {}) => {
    const props: ListaProps = {
      nombre: overrides.nombre ?? 'Lista de prueba',
      propietarioId: overrides.propietarioId ?? 'owner-1',
    };

    if (overrides.descripcion !== undefined) {
      props.descripcion = overrides.descripcion;
    }

    if (overrides.tiendaId !== undefined) {
      props.tiendaId = overrides.tiendaId;
    }

    if (overrides.activa !== undefined) {
      props.activa = overrides.activa;
    }

    if (overrides.id !== undefined) {
      props.id = overrides.id;
    }

    if (overrides.fechaCreacion !== undefined) {
      props.fechaCreacion = overrides.fechaCreacion;
    }

    if (overrides.fechaActualizacion !== undefined) {
      props.fechaActualizacion = overrides.fechaActualizacion;
    }

    const result = Lista.create(props);

    if (result.isFailure) {
      throw result.error;
    }

    return result.value;
  };

  it('should persist and retrieve lists by id and owner', async () => {
    const repository = new InMemoryListaRepository();
    const lista = createLista({ id: 'lista-1', propietarioId: 'owner-42' });
    await repository.save(lista);

    const byId = await repository.findById(lista.id);
    expect(byId.isSuccess).toBe(true);
    if (byId.isSuccess) {
      expect(byId.value).toBe(lista);
    }

    const byOwner = await repository.findByIdAndOwner(lista.id, 'owner-42');
    expect(byOwner.isSuccess).toBe(true);
    if (byOwner.isSuccess) {
      expect(byOwner.value).toBe(lista);
    }

    const wrongOwner = await repository.findByIdAndOwner(lista.id, 'other-owner');
    expect(wrongOwner.isSuccess).toBe(true);
    if (wrongOwner.isSuccess) {
      expect(wrongOwner.value).toBeNull();
    }
  });

  it('should filter lists by owner, active flag and paginate results', async () => {
    const repository = new InMemoryListaRepository();
    const listas = [
      createLista({ id: 'lista-1', propietarioId: 'owner-1', activa: true }),
      createLista({ id: 'lista-2', propietarioId: 'owner-1', activa: false }),
      createLista({ id: 'lista-3', propietarioId: 'owner-1', activa: true }),
      createLista({ id: 'lista-4', propietarioId: 'owner-2', activa: true }),
    ];

    await Promise.all(listas.map(lista => repository.save(lista)));

    const allOwnerLists = await repository.findByOwner('owner-1');
    expect(allOwnerLists.isSuccess).toBe(true);
    if (allOwnerLists.isSuccess) {
      expect(allOwnerLists.value.total).toBe(3);
      expect(allOwnerLists.value.items).toHaveLength(3);
    }

    const onlyActive = await repository.findByOwner('owner-1', { activa: true });
    expect(onlyActive.isSuccess).toBe(true);
    if (onlyActive.isSuccess) {
      expect(onlyActive.value.total).toBe(2);
      expect(onlyActive.value.items.every(lista => lista.activa)).toBe(true);
    }

    const paginated = await repository.findByOwner('owner-1', undefined, { page: 2, limit: 1 });
    expect(paginated.isSuccess).toBe(true);
    if (paginated.isSuccess) {
      expect(paginated.value.page).toBe(2);
      expect(paginated.value.limit).toBe(1);
      expect(paginated.value.totalPages).toBe(3);
      expect(paginated.value.items).toHaveLength(1);
    }
  });

  it('should find lists by name ignoring case', async () => {
    const repository = new InMemoryListaRepository();
    const lista = createLista({ nombre: 'Lista Importante', propietarioId: 'owner-1' });
    await repository.save(lista);

    const found = await repository.findByNameAndOwner('lista importante', 'owner-1');
    expect(found.isSuccess).toBe(true);
    if (found.isSuccess) {
      expect(found.value).toBe(lista);
    }

    const missing = await repository.findByNameAndOwner('desconocida', 'owner-1');
    expect(missing.isSuccess).toBe(true);
    if (missing.isSuccess) {
      expect(missing.value).toBeNull();
    }
  });

  it('should report existence and counts correctly', async () => {
    const repository = new InMemoryListaRepository();
    const lista = createLista({ id: 'lista-1', nombre: 'Mi lista', propietarioId: 'owner-1' });
    await repository.save(lista);

    const existsById = await repository.existsById('lista-1');
    expect(existsById.isSuccess).toBe(true);
    if (existsById.isSuccess) {
      expect(existsById.value).toBe(true);
    }

    const existsByName = await repository.existsByNameAndOwner('MI LISTA', 'owner-1');
    expect(existsByName.isSuccess).toBe(true);
    if (existsByName.isSuccess) {
      expect(existsByName.value).toBe(true);
    }

    const count = await repository.countByOwner('owner-1');
    expect(count.isSuccess).toBe(true);
    if (count.isSuccess) {
      expect(count.value).toBe(1);
    }
  });

  it('should deactivate lists on soft delete and hard delete permanently', async () => {
    const repository = new InMemoryListaRepository();
    const lista = createLista({ id: 'lista-1', propietarioId: 'owner-1', activa: true });
    await repository.save(lista);

    const deleteResult = await repository.deleteById('lista-1');
    expect(deleteResult.isSuccess).toBe(true);

    const afterDelete = await repository.findById('lista-1');
    expect(afterDelete.isSuccess).toBe(true);
    if (afterDelete.isSuccess && afterDelete.value) {
      expect(afterDelete.value.activa).toBe(false);
    }

    const hardDelete = await repository.hardDelete('lista-1');
    expect(hardDelete.isSuccess).toBe(true);
    if (hardDelete.isSuccess) {
      expect(hardDelete.value).toBe(true);
    }

    const missing = await repository.findById('lista-1');
    expect(missing.isSuccess).toBe(true);
    if (missing.isSuccess) {
      expect(missing.value).toBeNull();
    }
  });

  it('should fail soft delete and active status updates when list does not exist', async () => {
    const repository = new InMemoryListaRepository();

    const deleteResult = await repository.deleteById('missing');
    expect(deleteResult.isFailure).toBe(true);
    if (deleteResult.isFailure) {
      expect(deleteResult.error).toBeInstanceOf(Error);
      expect(deleteResult.error.message).toBe('Lista no encontrada');
    }

    const updateResult = await repository.updateActiveStatus('missing', true);
    expect(updateResult.isFailure).toBe(true);
    if (updateResult.isFailure) {
      expect(updateResult.error).toBeInstanceOf(Error);
      expect(updateResult.error.message).toBe('Lista no encontrada');
    }
  });

  it('should toggle active status when list exists', async () => {
    const repository = new InMemoryListaRepository();
    const lista = createLista({ id: 'lista-1', propietarioId: 'owner-1', activa: false });
    await repository.save(lista);

    const activateResult = await repository.updateActiveStatus('lista-1', true);
    expect(activateResult.isSuccess).toBe(true);

    const afterActivate = await repository.findById('lista-1');
    expect(afterActivate.isSuccess).toBe(true);
    if (afterActivate.isSuccess && afterActivate.value) {
      expect(afterActivate.value.activa).toBe(true);
    }

    const deactivateResult = await repository.updateActiveStatus('lista-1', false);
    expect(deactivateResult.isSuccess).toBe(true);

    const afterDeactivate = await repository.findById('lista-1');
    expect(afterDeactivate.isSuccess).toBe(true);
    if (afterDeactivate.isSuccess && afterDeactivate.value) {
      expect(afterDeactivate.value.activa).toBe(false);
    }
  });
});
