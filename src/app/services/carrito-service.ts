import { Injectable } from '@angular/core';
import { Producto } from '../models/producto.model';
import { ItemCarrito } from '../models/item-carrito.model';

const CLAVE_CARRITO = 'carrito';
const CLAVE_CUPON = 'carrito_cupon';

// ===== Reglas de precios (modificar aquí) =====

// Descuento automático por monto del subtotal. Se aplica el tramo más alto alcanzado.
export const TRAMOS_DESCUENTO = [
  { desde: 200, porcentaje: 10 },
  { desde: 100, porcentaje: 5 },
];

// Cupones válidos: código → porcentaje de descuento sobre el subtotal.
export const CUPONES: Record<string, number> = {
  DESCUENTO10: 10,
  BIENVENIDO5: 5,
};

export const COSTO_ENVIO = 10;
// Envío gratis cuando el monto después de descuentos alcanza este valor.
export const ENVIO_GRATIS_DESDE = 150;

export interface ResumenCarrito {
  subtotal: number;
  porcentajeTramo: number;
  descuentoTramo: number;
  cupon: string | null;
  porcentajeCupon: number;
  descuentoCupon: number;
  descuentoTotal: number;
  envio: number;
  total: number;
  faltaParaEnvioGratis: number;
}

// Redondeo a 2 decimales para evitar errores de punto flotante (0.1 + 0.2).
const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable({
  providedIn: 'root',
})
export class CarritoService {

  items: ItemCarrito[] = [];
  cupon: string | null = null;

  constructor() {
    try {
      this.items = JSON.parse(localStorage.getItem(CLAVE_CARRITO) || '[]');
      const cupon = localStorage.getItem(CLAVE_CUPON);
      this.cupon = cupon && CUPONES[cupon] ? cupon : null;
    } catch {
      this.items = [];
      this.cupon = null;
    }
  }

  agregar(producto: Producto, cantidad: number): void {
    const item = this.items.find(x => x.producto.id === producto.id);
    if (item) {
      item.cantidad += cantidad;
    } else {
      this.items.push({ producto, cantidad });
    }
    this.guardar();
  }

  actualizarCantidad(idProducto: number, cantidad: number): void {
    const item = this.items.find(x => x.producto.id === idProducto);
    const nueva = Math.floor(Number(cantidad));
    if (!item || !Number.isFinite(nueva) || nueva < 1) {
      return;
    }
    item.cantidad = nueva;
    this.guardar();
  }

  eliminar(idProducto: number): void {
    this.items = this.items.filter(x => x.producto.id !== idProducto);
    this.guardar();
  }

  /** Aplica un cupón. Devuelve false si el código no existe. */
  aplicarCupon(codigo: string): boolean {
    const normalizado = codigo.trim().toUpperCase();
    if (!CUPONES[normalizado]) {
      return false;
    }
    this.cupon = normalizado;
    this.guardar();
    return true;
  }

  quitarCupon(): void {
    this.cupon = null;
    this.guardar();
  }

  totalUnidades(): number {
    return this.items.reduce((suma, x) => suma + x.cantidad, 0);
  }

  subtotalItem(item: ItemCarrito): number {
    return redondear(item.cantidad * (item.producto.price ?? 0));
  }

  resumen(): ResumenCarrito {
    const subtotal = redondear(this.items.reduce((suma, x) => suma + this.subtotalItem(x), 0));

    const tramo = TRAMOS_DESCUENTO.find(t => subtotal >= t.desde);
    const porcentajeTramo = tramo ? tramo.porcentaje : 0;
    const descuentoTramo = redondear(subtotal * porcentajeTramo / 100);

    const porcentajeCupon = this.cupon ? CUPONES[this.cupon] : 0;
    const descuentoCupon = redondear(subtotal * porcentajeCupon / 100);

    const descuentoTotal = redondear(descuentoTramo + descuentoCupon);
    const conDescuento = redondear(subtotal - descuentoTotal);

    // Sin productos no hay envío.
    const envio = this.items.length === 0 || conDescuento >= ENVIO_GRATIS_DESDE ? 0 : COSTO_ENVIO;
    const faltaParaEnvioGratis = this.items.length === 0 ? 0 : Math.max(0, redondear(ENVIO_GRATIS_DESDE - conDescuento));

    return {
      subtotal,
      porcentajeTramo,
      descuentoTramo,
      cupon: this.cupon,
      porcentajeCupon,
      descuentoCupon,
      descuentoTotal,
      envio,
      total: redondear(conDescuento + envio),
      faltaParaEnvioGratis,
    };
  }

  total(): number {
    return this.resumen().total;
  }

  private guardar(): void {
    try {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify(this.items));
      if (this.cupon) {
        localStorage.setItem(CLAVE_CUPON, this.cupon);
      } else {
        localStorage.removeItem(CLAVE_CUPON);
      }
    } catch {
      // Almacenamiento no disponible: el carrito sigue funcionando en memoria.
    }
  }
}
