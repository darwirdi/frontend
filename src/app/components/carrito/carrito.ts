import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MenuComponent } from '../../menu/menu.component';
import { CarritoService } from '../../services/carrito-service';
import { ProductoService } from '../../services/producto-service';
import { ItemCarrito } from '../../models/item-carrito.model';
import { Producto } from '../../models/producto.model';

const MAX_RECOMENDADOS = 4;

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule, FormsModule, MenuComponent, RouterLink],
  templateUrl: './carrito.html',
  styleUrl: './carrito.css',
})
export class Carrito implements OnInit {

  codigoCupon = '';
  errorCupon = '';

  catalogo: Producto[] = [];

  constructor(public carritoService: CarritoService,
              private productoService: ProductoService) { }

  ngOnInit(): void {
    this.productoService.listaCatalogo().subscribe({
      next: productos => this.catalogo = productos,
      error: () => this.catalogo = [],
    });
  }

  cambiarCantidad(item: ItemCarrito, delta: number): void {
    this.carritoService.actualizarCantidad(item.producto.id!, item.cantidad + delta);
  }

  // Valor escrito a mano: si no es válido (vacío, 0, negativo), se restaura el anterior.
  escribirCantidad(item: ItemCarrito, input: HTMLInputElement): void {
    const valor = Math.floor(Number(input.value));
    if (input.value.trim() !== '' && Number.isFinite(valor) && valor >= 1) {
      this.carritoService.actualizarCantidad(item.producto.id!, valor);
    }
    input.value = String(item.cantidad);
  }

  aplicarCupon(): void {
    if (!this.codigoCupon.trim()) {
      this.errorCupon = 'Ingrese un código de cupón.';
      return;
    }
    if (this.carritoService.aplicarCupon(this.codigoCupon)) {
      this.codigoCupon = '';
      this.errorCupon = '';
    } else {
      this.errorCupon = 'Cupón no válido.';
    }
  }

  quitarCupon(): void {
    this.carritoService.quitarCupon();
    this.errorCupon = '';
  }

  agregarRecomendado(producto: Producto): void {
    this.carritoService.agregar(producto, 1);
  }

  // ===== Recomendaciones =====

  /** Productos del catálogo que no están en el carrito, ordenados por popularidad. */
  private disponibles(): Producto[] {
    const enCarrito = new Set(this.carritoService.items.map(x => x.producto.id));
    return this.catalogo
      .filter(p => !enCarrito.has(p.id))
      .sort((a, b) =>
        (b.rating?.rate ?? 0) - (a.rating?.rate ?? 0) ||
        (b.rating?.count ?? 0) - (a.rating?.count ?? 0));
  }

  /** "También te puede interesar": misma categoría que los productos del carrito.
   *  Con el carrito vacío, muestra los más populares. */
  tambienTePuedeInteresar(): Producto[] {
    const categorias = new Set(this.carritoService.items.map(x => x.producto.category));
    const disponibles = this.disponibles();
    if (categorias.size === 0) {
      return disponibles.slice(0, MAX_RECOMENDADOS);
    }
    return disponibles
      .filter(p => categorias.has(p.category))
      .slice(0, MAX_RECOMENDADOS);
  }

  /** "Los clientes también compraron": productos populares de otras categorías,
   *  sin repetir los de la sección anterior. */
  losClientesTambienCompraron(): Producto[] {
    if (this.carritoService.items.length === 0) {
      return [];
    }
    const categorias = new Set(this.carritoService.items.map(x => x.producto.category));
    const yaMostrados = new Set(this.tambienTePuedeInteresar().map(p => p.id));
    return this.disponibles()
      .filter(p => !categorias.has(p.category) && !yaMostrados.has(p.id))
      .slice(0, MAX_RECOMENDADOS);
  }
}
