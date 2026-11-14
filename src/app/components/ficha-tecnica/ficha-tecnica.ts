import { Component, Input, OnChanges, OnDestroy, computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { ProductoFichaService } from '../../services/producto-ficha-service';
import { ProductoFicha, ProductoVariante } from '../../models/producto-ficha.model';

// Color que se muestra cuando una variante no tiene color registrado
const SIN_COLOR = 'Único';

// Este proyecto usa Angular sin zone.js (modo zoneless): el estado que la plantilla
// lee debe guardarse en signals; con variables normales la pantalla no se actualiza.
@Component({
  selector: 'app-ficha-tecnica',
  standalone: true,
  imports: [],
  templateUrl: './ficha-tecnica.html',
  styleUrl: './ficha-tecnica.css',
})
export class FichaTecnica implements OnChanges, OnDestroy {

  // id del producto (el mismo de FakeStore)
  @Input({ required: true }) idProducto!: number;

  readonly ficha = signal<ProductoFicha | null>(null);
  readonly cargando = signal(true);
  readonly error = signal(false);

  readonly colorSeleccionado = signal('');
  readonly varianteSeleccionada = signal<ProductoVariante | null>(null);

  // Colores distintos que tiene el producto
  readonly colores = computed(() => {
    const variantes = this.ficha()?.variantes ?? [];
    return [...new Set(variantes.map((v) => v.color ?? SIN_COLOR))];
  });

  // Variantes (tallas) del color elegido
  readonly variantesDelColor = computed(() =>
    (this.ficha()?.variantes ?? [])
      .filter((v) => (v.color ?? SIN_COLOR) === this.colorSeleccionado())
  );

  // Solo se muestra el selector de tallas si el producto realmente tiene tallas
  readonly tieneTallas = computed(() =>
    this.variantesDelColor().some((v) => !!v.talla)
  );

  private suscripcion?: Subscription;

  constructor(private fichaService: ProductoFichaService) {}

  ngOnChanges(): void {
    this.cargarFicha();
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
  }

  private cargarFicha(): void {
    this.suscripcion?.unsubscribe();

    this.cargando.set(true);
    this.error.set(false);
    this.ficha.set(null);
    this.colorSeleccionado.set('');
    this.varianteSeleccionada.set(null);

    this.suscripcion = this.fichaService.obtenerFicha(this.idProducto).subscribe({
      next: (ficha) => {
        this.ficha.set(ficha);
        this.cargando.set(false);

        const colores = this.colores();
        if (colores.length > 0) {
          this.elegirColor(colores[0]);
        }
      },
      error: (err) => {
        // 404 = el producto no tiene ficha registrada: no es un error para el usuario
        if (err?.status !== 404) {
          console.error('No se pudo cargar la ficha del producto', err);
          this.error.set(true);
        }
        this.cargando.set(false);
      },
    });
  }

  elegirColor(color: string): void {
    this.colorSeleccionado.set(color);
    const variantes = this.variantesDelColor();
    // Se preselecciona la primera variante con stock
    this.varianteSeleccionada.set(
      variantes.find((v) => v.stock > 0) ?? variantes[0] ?? null
    );
  }

  elegirVariante(variante: ProductoVariante): void {
    if (variante.stock > 0) {
      this.varianteSeleccionada.set(variante);
    }
  }

  textoStock(variante: ProductoVariante): string {
    if (variante.stock <= 0) {
      return 'Agotado';
    }
    if (variante.stock <= 5) {
      return variante.stock === 1
        ? 'Queda 1 unidad'
        : `Quedan ${variante.stock} unidades`;
    }
    return `Disponible (${variante.stock} unidades)`;
  }
}
