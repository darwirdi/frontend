import { Component, OnInit } from '@angular/core';
import { MenuComponent } from '../../menu/menu.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ProductoService } from '../../services/producto-service';
import { Producto } from '../../models/producto.model';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-catalogo-producto',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule, // <-- Importante: Añadido para que funcione [(ngModel)] en el HTML
    MenuComponent,
    RouterLink
  ],
  templateUrl: './catalogo-producto.html',
  styleUrl: './catalogo-producto.css',
})
export class CatalogoProducto implements OnInit {

  productosAux!: Observable<Producto[]>;
  categorias: string[] = [];
  categoriaSeleccionada: string = '';

  constructor(private productoService: ProductoService) {
    console.log("==> constructor ");
  }

  ngOnInit(): void {
    console.log("==> ngOnInit ");
    
    // 1. Cargar la lista de categorías para llenar el <select>
    this.productoService.listaCategorias().subscribe((data: string[]) => {
      this.categorias = data;
    });

    // 2. Cargar todos los productos inicialmente
    this.cargarTodosLosProductos();
  }

  cargarTodosLosProductos(): void {
    this.productosAux = this.productoService.listaCatalogo();
  }

  filtrarPorCategoria(): void {
    if (this.categoriaSeleccionada === '') {
      this.cargarTodosLosProductos();
    } else {
      this.productosAux = this.productoService.listaPorCategoria(this.categoriaSeleccionada);
    }
  }
}