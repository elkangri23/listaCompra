/**
 * Evento de dominio: Producto Añadido
 * Se dispara cuando se añade un producto a una lista
 */

import { BaseDomainEvent } from './DomainEvent';

export interface ProductoAnadidoData {
  productoId: string;
  listaId: string;
  nombre: string;
  descripcion?: string;
  cantidad: number;
  unidad?: string;
  precio?: number;
  categoriaId?: string;
  urgente: boolean;
  creadoPorId: string;
  fechaCreacion: string; // ISO string
}

export class ProductoAnadido extends BaseDomainEvent {
  constructor(
    productoId: string,
    data: ProductoAnadidoData,
    context?: {
      userId?: string;
      correlationId?: string;
      causationId?: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ) {
    super(
      productoId,
      'Producto',
      {
        productoId: data.productoId,
        listaId: data.listaId,
        nombre: data.nombre,
        descripcion: data.descripcion,
        cantidad: data.cantidad,
        unidad: data.unidad,
        precio: data.precio,
        categoriaId: data.categoriaId,
        urgente: data.urgente,
        creadoPorId: data.creadoPorId,
        fechaCreacion: data.fechaCreacion,
      },
      context
    );
  }

  /**
   * Datos específicos del evento tipados
   */
  get productoData(): ProductoAnadidoData {
    return {
      productoId: this.eventData['productoId'],
      listaId: this.eventData['listaId'],
      nombre: this.eventData['nombre'],
      descripcion: this.eventData['descripcion'],
      cantidad: this.eventData['cantidad'],
      unidad: this.eventData['unidad'],
      precio: this.eventData['precio'],
      categoriaId: this.eventData['categoriaId'],
      urgente: this.eventData['urgente'],
      creadoPorId: this.eventData['creadoPorId'],
      fechaCreacion: this.eventData['fechaCreacion'],
    };
  }

  /**
   * Crea el evento desde JSON
   */
  static override fromJSON(json: Record<string, any>): ProductoAnadido {
    return new ProductoAnadido(
      json['aggregateId'],
      {
        productoId: json['eventData']['productoId'],
        listaId: json['eventData']['listaId'],
        nombre: json['eventData']['nombre'],
        descripcion: json['eventData']['descripcion'],
        cantidad: json['eventData']['cantidad'],
        unidad: json['eventData']['unidad'],
        precio: json['eventData']['precio'],
        categoriaId: json['eventData']['categoriaId'],
        urgente: json['eventData']['urgente'],
        creadoPorId: json['eventData']['creadoPorId'],
        fechaCreacion: json['eventData']['fechaCreacion'],
      },
      json['eventContext']
    );
  }
}