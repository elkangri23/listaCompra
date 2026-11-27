/**
 * Tests unitarios para ListaMapper y Password value object.
 */

import { ListaMapper } from '../../../../src/infrastructure/persistence/mappers/ListaMapper';
import { Lista } from '../../../../src/domain/entities/Lista';
import { Password } from '../../../../src/domain/value-objects/Password';

const makeLista = (): Lista => {
  const r = Lista.create({ id: 'l1', nombre: 'Semanal', propietarioId: 'u1', descripcion: 'desc' });
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Lista }).value;
};

describe('ListaMapper', () => {
  it('toPersistence extrae los campos primitivos', () => {
    const lista = makeLista();
    const data = ListaMapper.toPersistence(lista);
    expect(data).toEqual(expect.objectContaining({
      id: 'l1', nombre: 'Semanal', propietarioId: 'u1', activa: true, descripcion: 'desc'
    }));
  });

  it('toDomain reconstruye la entidad desde persistencia', () => {
    const data = {
      id: 'l2', nombre: 'Mensual', propietarioId: 'u2', descripcion: null,
      tiendaId: null, activa: true, fechaCreacion: new Date(), fechaActualizacion: new Date()
    };
    const r = ListaMapper.toDomain(data) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.id).toBe('l2');
    expect(r.value.nombre).toBe('Mensual');
  });

  it('toDomain con datos inválidos devuelve failure', () => {
    const r = ListaMapper.toDomain({ id: 'x', nombre: '', propietarioId: '' } as any);
    expect(r.isFailure).toBe(true);
  });

  it('toDomain con exception del constructor devuelve failure', () => {
    const spy = jest.spyOn(Lista, 'create').mockImplementation(() => { throw new Error('boom'); });
    const r = ListaMapper.toDomain({ id: 'x', nombre: 'n', propietarioId: 'p' } as any);
    expect(r.isFailure).toBe(true);
    spy.mockRestore();
  });

  it('arrays bidireccionales', () => {
    const lista = makeLista();
    const arr = ListaMapper.toPersistenceArray([lista, lista]);
    expect(arr).toHaveLength(2);

    const domain = ListaMapper.toDomainArray(arr as any) as any;
    expect(domain.isSuccess).toBe(true);
    expect(domain.value).toHaveLength(2);

    const bad = ListaMapper.toDomainArray([{ id: 'x', nombre: '', propietarioId: '' } as any]) as any;
    expect(bad.isFailure).toBe(true);
  });
});

describe('Password value object', () => {
  it('createUnsafe lanza con password inválida', () => {
    expect(() => Password.createUnsafe('corta')).toThrow();
  });

  it('valida longitud mínima (8) y máxima (128)', () => {
    expect(Password.create('Ab1!5678').isSuccess).toBe(true); // justo 8
    expect(Password.create('Ab1!567').isFailure).toBe(true); // 7
    expect(Password.create('A'.repeat(129) + 'a1!').isFailure).toBe(true);
  });

  it('rechaza vacío y no-string', () => {
    expect(Password.create('').isFailure).toBe(true);
    expect(Password.create(undefined as any).isFailure).toBe(true);
  });

  it('rechaza contraseñas sin complejidad', () => {
    expect(Password.create('abcdefghij').isFailure).toBe(true); // sin mayúscula ni número
    expect(Password.create('123456789').isFailure).toBe(true);
  });

  it('equals y enmascaramiento toString/toJSON', () => {
    const p1 = Password.createUnsafe('MiPass123!');
    const p2 = Password.createUnsafe('MiPass123!');
    const p3 = Password.createUnsafe('OtraPass1!');
    expect(p1.equals(p2)).toBe(true);
    expect(p1.equals(p3)).toBe(false);
    expect(p1.toString()).toBe('[PASSWORD]');
    expect(p1.toJSON()).toBe('[PASSWORD]');
    expect(p1.value).toBe('MiPass123!');
  });

  it('getStrength clasifica weak/medium/strong', () => {
    // toda contraseña válida tiene 8+ chars y minúscula+mayúscula+dígito → score >= 4
    expect(Password.createUnsafe('Ab1Xyz2w').getStrength()).toBe('medium');
    expect(Password.createUnsafe('Ab1!Xyz2$@').getStrength()).toBe('strong'); // score 6
    // 'weak' solo alcanzable con contraseñas que no pasan create (score < 4)
    const anyPassword = Password as any;
    expect(new anyPassword('abc1').getStrength()).toBe('weak');
  });

  it('hasMinimumRequirements exige minúscula, mayúscula y dígito', () => {
    expect(Password.createUnsafe('Ab1xYz2w').hasMinimumRequirements()).toBe(true);
    // una contraseña sin mayúscula nunca pasa create(): construirla por vía privada
    const anyPassword = Password as any;
    expect(new anyPassword('abx!yz2w!').hasMinimumRequirements()).toBe(false);
  });
});
