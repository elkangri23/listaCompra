import { GetUserLists } from '@application/use-cases/lists/GetUserLists';
import { InMemoryListaRepository } from '@infrastructure/persistence/in-memory/InMemoryListaRepository';
import { Lista } from '@domain/entities/Lista';
import { ValidationError } from '@application/errors/ValidationError';
import { isFailure } from '@shared/result';

const createLista = (props: Parameters<typeof Lista.create>[0]) => {
  const result = Lista.create(props);
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
};

describe('GetUserLists - advanced search capabilities', () => {
  const propietarioId = 'usuario-123';
  let repository: InMemoryListaRepository;
  let useCase: GetUserLists;

  const persistLista = async (lista: Lista) => {
    const saveResult = await repository.save(lista);
    if (saveResult.isFailure) {
      throw saveResult.error;
    }
  };

  beforeEach(() => {
    repository = new InMemoryListaRepository();
    useCase = new GetUserLists(repository);
  });

  it('filtra por texto, estado y rangos de fecha correctamente', async () => {
    const listaRelevante = createLista({
      id: 'lista-relevante',
      nombre: 'Compras semanales',
      descripcion: 'Planificación de compras del hogar',
      propietarioId,
      activa: true,
      fechaCreacion: new Date('2024-01-10T12:00:00.000Z'),
      fechaActualizacion: new Date('2024-01-15T09:30:00.000Z'),
    });

    const listaAntigua = createLista({
      id: 'lista-antigua',
      nombre: 'Regalos navideños',
      descripcion: 'Ideas de regalos',
      propietarioId,
      activa: true,
      fechaCreacion: new Date('2023-12-01T10:00:00.000Z'),
      fechaActualizacion: new Date('2023-12-05T10:00:00.000Z'),
    });

    const listaInactiva = createLista({
      id: 'lista-inactiva',
      nombre: 'Compras oficina',
      descripcion: 'Material de oficina y papelería',
      propietarioId,
      activa: false,
      fechaCreacion: new Date('2024-01-12T08:00:00.000Z'),
      fechaActualizacion: new Date('2024-01-13T08:00:00.000Z'),
    });

    await Promise.all([
      persistLista(listaRelevante),
      persistLista(listaAntigua),
      persistLista(listaInactiva),
    ]);

    const result = await useCase.execute({
      busqueda: 'compras',
      activa: true,
      fechaCreacionDesde: '2024-01-01T00:00:00.000Z',
      fechaCreacionHasta: '2024-01-31T23:59:59.999Z',
      fechaActualizacionDesde: '2024-01-10T00:00:00.000Z',
      fechaActualizacionHasta: '2024-01-20T23:59:59.999Z',
      page: 1,
      limit: 10,
      sort: [{ field: 'fechaActualizacion', direction: 'desc' }],
    }, propietarioId);

    if (isFailure(result)) {
      throw result.error;
    }

    const value = result.value;
    expect(value.items).toHaveLength(1);
    const [singleItem] = value.items;
    expect(singleItem).toBeDefined();
    expect(singleItem!.id).toBe('lista-relevante');
  });

  it('ordena utilizando múltiples criterios de forma estable', async () => {
    const listaAlphaAnterior = createLista({
      id: 'lista-alpha-anterior',
      nombre: 'Alpha',
      propietarioId,
      fechaCreacion: new Date('2024-02-01T10:00:00.000Z'),
      fechaActualizacion: new Date('2024-02-11T10:00:00.000Z'),
    });

    const listaAlphaReciente = createLista({
      id: 'lista-alpha-reciente',
      nombre: 'Alpha',
      propietarioId,
      fechaCreacion: new Date('2024-02-02T10:00:00.000Z'),
      fechaActualizacion: new Date('2024-02-13T10:00:00.000Z'),
    });

    const listaBeta = createLista({
      id: 'lista-beta',
      nombre: 'Beta',
      propietarioId,
      fechaCreacion: new Date('2024-02-03T10:00:00.000Z'),
      fechaActualizacion: new Date('2024-02-09T10:00:00.000Z'),
    });

    await Promise.all([
      persistLista(listaAlphaAnterior),
      persistLista(listaAlphaReciente),
      persistLista(listaBeta),
    ]);

    const result = await useCase.execute({
      page: 1,
      limit: 10,
      sort: [
        { field: 'nombre', direction: 'asc' },
        { field: 'fechaActualizacion', direction: 'desc' },
      ],
    }, propietarioId);

    if (isFailure(result)) {
      throw result.error;
    }

    const orderedIds = result.value.items.map(item => item.id);
    expect(orderedIds).toEqual([
      'lista-alpha-reciente',
      'lista-alpha-anterior',
      'lista-beta',
    ]);
  });

  it('retorna un error de validación cuando las fechas no son válidas', async () => {
    const result = await useCase.execute({
      fechaCreacionDesde: 'fecha-invalida',
      page: 1,
      limit: 10,
    }, propietarioId);

    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) {
      expect(result.error).toBeInstanceOf(ValidationError);
      if (result.error instanceof ValidationError) {
        expect(result.error.field).toBe('fechaCreacionDesde');
      }
    }
  });
});
