import { PrismaClient, RolUsuario, TipoPermiso } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Iniciando seed de la base de datos...');

  // Limpiar datos existentes
  await prisma.outboxEvent.deleteMany();
  await prisma.permiso.deleteMany();
  await prisma.invitacion.deleteMany();
  await prisma.blueprint.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.tienda.deleteMany();
  await prisma.lista.deleteMany();
  await prisma.usuario.deleteMany();

  // Crear usuarios de ejemplo
  const hashedPassword = await bcrypt.hash('password123', 10);

  const adminUser = await prisma.usuario.create({
    data: {
      email: 'admin@listacompra.com',
      password: hashedPassword,
      nombre: 'Administrador',
      apellidos: 'Principal',
      rol: RolUsuario.ADMIN,
      emailVerificado: true,
    },
  });

  const usuario1 = await prisma.usuario.create({
    data: {
      email: 'juan@example.com',
      password: hashedPassword,
      nombre: 'Juan',
      apellidos: 'Pérez García',
      rol: RolUsuario.USUARIO,
      emailVerificado: true,
    },
  });

  const usuario2 = await prisma.usuario.create({
    data: {
      email: 'maria@example.com',
      password: hashedPassword,
      nombre: 'María',
      apellidos: 'López Rodríguez',
      rol: RolUsuario.USUARIO,
      emailVerificado: true,
    },
  });

  console.log('✅ Usuarios creados:', {
    admin: adminUser.email,
    usuario1: usuario1.email,
    usuario2: usuario2.email,
  });

  // Crear tiendas de ejemplo
  const mercadona = await prisma.tienda.create({
    data: {
      nombre: 'Mercadona',
      direccion: 'Calle Principal, 123',
      telefono: '900 123 456',
      sitioWeb: 'https://www.mercadona.es',
    },
  });

  const carrefour = await prisma.tienda.create({
    data: {
      nombre: 'Carrefour',
      direccion: 'Centro Comercial Plaza Norte',
      telefono: '900 789 012',
      sitioWeb: 'https://www.carrefour.es',
    },
  });

  console.log('✅ Tiendas creadas:', {
    mercadona: mercadona.nombre,
    carrefour: carrefour.nombre,
  });

  // Crear categorías para Mercadona
  const categoriasFrutas = await prisma.categoria.create({
    data: {
      nombre: 'Frutas y Verduras',
      descripcion: 'Productos frescos: frutas, verduras y hortalizas',
      color: '#4CAF50',
      icono: '🥕',
      tiendaId: mercadona.id,
    },
  });

  const categoriasLacteos = await prisma.categoria.create({
    data: {
      nombre: 'Lácteos',
      descripcion: 'Leche, quesos, yogures y derivados lácteos',
      color: '#2196F3',
      icono: '🥛',
      tiendaId: mercadona.id,
    },
  });

  const categoriasCarne = await prisma.categoria.create({
    data: {
      nombre: 'Carnes y Pescados',
      descripcion: 'Carnes frescas, embutidos y pescados',
      color: '#F44336',
      icono: '🥩',
      tiendaId: mercadona.id,
    },
  });

  const categoriasLimpieza = await prisma.categoria.create({
    data: {
      nombre: 'Limpieza',
      descripcion: 'Productos de limpieza e higiene del hogar',
      color: '#9C27B0',
      icono: '🧽',
      tiendaId: mercadona.id,
    },
  });

  console.log('✅ Categorías creadas para Mercadona');

  // Crear listas de ejemplo
  const listaFamiliar = await prisma.lista.create({
    data: {
      nombre: 'Lista Familiar Semanal',
      descripcion: 'Lista de compras para toda la familia',
      color: '#FF9800',
      icono: '🏠',
      propietarioId: usuario1.id,
    },
  });

  const listaCena = await prisma.lista.create({
    data: {
      nombre: 'Cena de Amigos',
      descripcion: 'Ingredientes para la cena del sábado',
      color: '#E91E63',
      icono: '🍽️',
      propietarioId: usuario2.id,
    },
  });

  console.log('✅ Listas creadas:', {
    familiar: listaFamiliar.nombre,
    cena: listaCena.nombre,
  });

  // Crear productos para la lista familiar
  await prisma.producto.createMany({
    data: [
      {
        nombre: 'Manzanas Golden',
        descripcion: 'Manzanas doradas para toda la familia',
        cantidad: 2,
        unidad: 'kg',
        precio: 2.50,
        listaId: listaFamiliar.id,
        categoriaId: categoriasFrutas.id,
        creadoPorId: usuario1.id,
      },
      {
        nombre: 'Leche Entera',
        descripcion: 'Brick de leche entera de 1L',
        cantidad: 3,
        unidad: 'litros',
        precio: 1.20,
        listaId: listaFamiliar.id,
        categoriaId: categoriasLacteos.id,
        creadoPorId: usuario1.id,
      },
      {
        nombre: 'Pechuga de Pollo',
        descripcion: 'Pechuga de pollo fresca sin piel',
        cantidad: 1,
        unidad: 'kg',
        precio: 6.50,
        urgente: true,
        listaId: listaFamiliar.id,
        categoriaId: categoriasCarne.id,
        creadoPorId: usuario1.id,
      },
      {
        nombre: 'Detergente Líquido',
        descripcion: 'Detergente para lavadora 40 lavados',
        cantidad: 1,
        unidad: 'botella',
        precio: 4.99,
        listaId: listaFamiliar.id,
        categoriaId: categoriasLimpieza.id,
        creadoPorId: usuario1.id,
      },
    ],
  });

  // Crear productos para la lista de cena
  await prisma.producto.createMany({
    data: [
      {
        nombre: 'Tomates Cherry',
        descripcion: 'Tomates cherry para ensalada',
        cantidad: 500,
        unidad: 'gramos',
        precio: 2.20,
        listaId: listaCena.id,
        categoriaId: categoriasFrutas.id,
        creadoPorId: usuario2.id,
      },
      {
        nombre: 'Queso Mozzarella',
        descripcion: 'Mozzarella fresca para pizza',
        cantidad: 250,
        unidad: 'gramos',
        precio: 3.50,
        comprado: true,
        fechaCompra: new Date(),
        listaId: listaCena.id,
        categoriaId: categoriasLacteos.id,
        creadoPorId: usuario2.id,
      },
    ],
  });

  console.log('✅ Productos creados para las listas');

  // Crear permisos para compartir la lista familiar
  await prisma.permiso.create({
    data: {
      tipo: TipoPermiso.ESCRITURA,
      usuarioId: usuario2.id,
      listaId: listaFamiliar.id,
    },
  });

  console.log('✅ Permisos creados');

  // Crear un blueprint de ejemplo
  await prisma.blueprint.create({
    data: {
      nombre: 'Lista Básica Semanal',
      descripcion: 'Plantilla con productos básicos para una semana',
      publico: true,
      creadoPorId: adminUser.id,
      contenido: {
        productos: [
          {
            nombre: 'Leche',
            categoria: 'Lácteos',
            cantidad: 2,
            unidad: 'litros',
          },
          {
            nombre: 'Pan',
            categoria: 'Panadería',
            cantidad: 1,
            unidad: 'barra',
          },
          {
            nombre: 'Huevos',
            categoria: 'Lácteos',
            cantidad: 12,
            unidad: 'unidades',
          },
          {
            nombre: 'Plátanos',
            categoria: 'Frutas y Verduras',
            cantidad: 1,
            unidad: 'kg',
          },
        ],
      },
    },
  });

  console.log('✅ Blueprint creado');

  console.log('🎉 Seed completado exitosamente!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error durante el seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });