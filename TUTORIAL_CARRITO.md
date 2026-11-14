# Tutorial: cómo se implementó el Carrito de compras

Este tutorial explica, paso a paso, cómo está construido el carrito de compras del frontend (Angular 21). Funcionalidades cubiertas:

1. Agregar productos al carrito desde el detalle del producto.
2. Mostrar los productos en una grilla (tabla).
3. Modificar cantidades y eliminar productos.
4. Calcular subtotal, descuentos, costo de envío y total.
5. Aplicar un cupón de descuento.
6. Mostrar productos recomendados ("También te puede interesar" y "Los clientes también compraron").

> El carrito funciona **solo en el frontend**: los datos se guardan en el `localStorage` del navegador, por lo que no se pierden al recargar la página. Los productos vienen de la API pública **FakeStore** (`https://fakestoreapi.com/products`).

---

## 1. Archivos involucrados

| Archivo | Responsabilidad |
|---|---|
| `src/app/models/item-carrito.model.ts` | Modelo de un ítem del carrito (producto + cantidad). |
| `src/app/services/carrito-service.ts` | Lógica del carrito: agregar, actualizar, eliminar, cupones y cálculo de montos. |
| `src/app/components/carrito/carrito.ts` | Componente de la página del carrito. |
| `src/app/components/carrito/carrito.html` | Vista: tabla, resumen, cupón y recomendaciones. |
| `src/app/components/carrito/carrito.css` | Estilos simples de la página. |
| `src/app/components/catalogo-producto-detalle/...` | Botón "Agregar al carrito" en el detalle del producto. |
| `src/app/menu/menu.component.html` | Enlace "🛒 Carrito (N)" con el número de unidades. |
| `src/app/app.routes.ts` | Ruta `/carrito`. |

```
Detalle del producto ──agregar()──►  CarritoService  ◄── Página /carrito
                                      (items, cupón)        (tabla, resumen,
Menú "🛒 Carrito (N)" ◄─totalUnidades()─┘   │                recomendaciones)
                                            ▼
                                       localStorage
```

---

## 2. El modelo: `ItemCarrito`

Cada fila del carrito guarda el producto completo y la cantidad elegida.

```ts
// src/app/models/item-carrito.model.ts
import { Producto } from './producto.model';

export class ItemCarrito {
    producto!: Producto
    cantidad!: number
}
```

Se guarda el producto completo (nombre, precio, imagen, categoría) para poder mostrar la tabla sin volver a consultar la API.

---

## 3. El servicio: `CarritoService`

El servicio es un **singleton** (`providedIn: 'root'`): todos los componentes comparten la misma instancia. Por eso, cuando el detalle del producto agrega algo, el menú y la página del carrito ven el cambio de inmediato.

### 3.1 Cargar y guardar en `localStorage`

```ts
const CLAVE_CARRITO = 'carrito';
const CLAVE_CUPON = 'carrito_cupon';

@Injectable({ providedIn: 'root' })
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
```

- Al crearse el servicio, se lee lo guardado anteriormente.
- Cada operación que cambia el carrito llama a `guardar()`.
- El `try/catch` evita que la página falle si el navegador bloquea el almacenamiento.

### 3.2 Agregar un producto

Si el producto ya está en el carrito, se suma la cantidad; si no, se agrega una fila nueva.

```ts
agregar(producto: Producto, cantidad: number): void {
  const item = this.items.find(x => x.producto.id === producto.id);
  if (item) {
    item.cantidad += cantidad;
  } else {
    this.items.push({ producto, cantidad });
  }
  this.guardar();
}
```

### 3.3 Modificar la cantidad

Solo se aceptan números enteros mayores o iguales a 1. Si el valor no es válido, no se cambia nada.

```ts
actualizarCantidad(idProducto: number, cantidad: number): void {
  const item = this.items.find(x => x.producto.id === idProducto);
  const nueva = Math.floor(Number(cantidad));
  if (!item || !Number.isFinite(nueva) || nueva < 1) {
    return;
  }
  item.cantidad = nueva;
  this.guardar();
}
```

### 3.4 Eliminar y contar unidades

```ts
eliminar(idProducto: number): void {
  this.items = this.items.filter(x => x.producto.id !== idProducto);
  this.guardar();
}

totalUnidades(): number {
  return this.items.reduce((suma, x) => suma + x.cantidad, 0);
}
```

`totalUnidades()` se usa en el menú: `🛒 Carrito ({{ carritoService.totalUnidades() }})`.

---

## 4. Subtotal, descuentos, envío y total

### 4.1 Reglas de negocio

Las reglas están como constantes al inicio de `carrito-service.ts`, para poder cambiarlas en un solo lugar:

```ts
// Descuento automático por monto. Se aplica el tramo más alto alcanzado.
export const TRAMOS_DESCUENTO = [
  { desde: 200, porcentaje: 10 },
  { desde: 100, porcentaje: 5 },
];

// Cupones válidos: código → porcentaje de descuento.
export const CUPONES: Record<string, number> = {
  DESCUENTO10: 10,
  BIENVENIDO5: 5,
};

export const COSTO_ENVIO = 10;
export const ENVIO_GRATIS_DESDE = 150;  // después de descuentos
```

| Regla | Valor |
|---|---|
| Descuento por monto | 5 % desde $100, 10 % desde $200 |
| Cupón (se suma al descuento por monto) | `DESCUENTO10` = 10 %, `BIENVENIDO5` = 5 % |
| Costo de envío | $10 |
| Envío gratis | si el monto con descuento es ≥ $150 |
| Carrito vacío | sin envío, total $0 |

### 4.2 Redondeo

En JavaScript, `0.1 + 0.2` da `0.30000000000000004`. Para que los montos sean exactos, cada cálculo se redondea a 2 decimales:

```ts
const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
```

### 4.3 El método `resumen()`

Calcula todos los montos de una sola vez y los devuelve en un objeto. La vista solo muestra los valores; no hace cálculos.

```ts
resumen(): ResumenCarrito {
  // 1. Subtotal = suma de (cantidad × precio) de cada ítem
  const subtotal = redondear(this.items.reduce((suma, x) => suma + this.subtotalItem(x), 0));

  // 2. Descuento por monto: primer tramo que se cumple (están ordenados de mayor a menor)
  const tramo = TRAMOS_DESCUENTO.find(t => subtotal >= t.desde);
  const porcentajeTramo = tramo ? tramo.porcentaje : 0;
  const descuentoTramo = redondear(subtotal * porcentajeTramo / 100);

  // 3. Descuento por cupón
  const porcentajeCupon = this.cupon ? CUPONES[this.cupon] : 0;
  const descuentoCupon = redondear(subtotal * porcentajeCupon / 100);

  const descuentoTotal = redondear(descuentoTramo + descuentoCupon);
  const conDescuento = redondear(subtotal - descuentoTotal);

  // 4. Envío: gratis si el carrito está vacío o se supera el mínimo
  const envio = this.items.length === 0 || conDescuento >= ENVIO_GRATIS_DESDE ? 0 : COSTO_ENVIO;

  // 5. Total
  return { subtotal, porcentajeTramo, descuentoTramo, cupon: this.cupon,
           porcentajeCupon, descuentoCupon, descuentoTotal, envio,
           total: redondear(conDescuento + envio), /* ... */ };
}
```

### 4.4 Ejemplos verificados

| Subtotal | Descuentos | Envío | Total |
|---|---|---|---|
| $100.00 | 5 % = −$5.00 | $10.00 | **$105.00** |
| $160.00 | 5 % = −$8.00 | Gratis | **$152.00** |
| $200.00 + cupón `DESCUENTO10` | 10 % + 10 % = −$40.00 | Gratis | **$160.00** |
| $1,293.93 | 10 % = −$129.39 | Gratis | **$1,164.54** |

### 4.5 Cupones

```ts
aplicarCupon(codigo: string): boolean {
  const normalizado = codigo.trim().toUpperCase();   // "descuento10 " → "DESCUENTO10"
  if (!CUPONES[normalizado]) {
    return false;                                    // el componente muestra "Cupón no válido."
  }
  this.cupon = normalizado;
  this.guardar();
  return true;
}

quitarCupon(): void {
  this.cupon = null;
  this.guardar();
}
```

---

## 5. Agregar desde el detalle del producto

En `catalogo-producto-detalle.html` hay un campo de cantidad y un botón:

```html
<label for="cantidad">Cantidad</label>
<input id="cantidad" type="number" min="1" [(ngModel)]="cantidad" />
<button class="btn-agregar" (click)="agregarAlCarrito(producto)">
  🛒 Agregar al carrito
</button>
```

En el componente se valida la cantidad, se llama al servicio y se muestra un mensaje con SweetAlert2:

```ts
agregarAlCarrito(producto: Producto): void {
  const cantidad = Math.floor(Number(this.cantidad));
  if (!cantidad || cantidad < 1) {
    Swal.fire({ title: 'Cantidad inválida', text: 'Ingrese una cantidad mayor a 0', icon: 'warning' });
    return;
  }
  this.carritoService.agregar(producto, cantidad);
  Swal.fire({ title: 'Agregado al carrito', text: `${cantidad} x ${producto.title}`, icon: 'success' });
  this.cantidad = 1;
}
```

---

## 6. La página del carrito

### 6.1 Ruta

```ts
// src/app/app.routes.ts
{ path: 'carrito', component: Carrito },
```

### 6.2 El componente (`carrito.ts`)

El servicio se inyecta como `public` para poder usarlo directamente en el HTML.

```ts
export class Carrito implements OnInit {

  codigoCupon = '';
  errorCupon = '';
  catalogo: Producto[] = [];

  constructor(public carritoService: CarritoService,
              private productoService: ProductoService) { }

  // Botones − y +
  cambiarCantidad(item: ItemCarrito, delta: number): void {
    this.carritoService.actualizarCantidad(item.producto.id!, item.cantidad + delta);
  }

  // Valor escrito a mano: si no es válido, se restaura el anterior
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
}
```

> **¿Por qué `input.value = String(item.cantidad)`?** Si el usuario escribe `0`, la cantidad no cambia; como el valor enlazado (`[value]`) sigue siendo el mismo, Angular no vuelve a pintar el campo. Por eso se restaura manualmente.

### 6.3 La grilla (`carrito.html`)

Se usa la sintaxis de control de flujo de Angular (`@if`, `@for`, `@let`).

```html
@if (carritoService.items.length > 0) {
  @let r = carritoService.resumen();

  <table class="table table-bordered bg-white">
    <tbody>
      @for (item of carritoService.items; track item.producto.id) {
        <tr>
          <td><img [src]="item.producto.image" [alt]="item.producto.title" /></td>
          <td>{{ item.producto.title }}</td>
          <td>$ {{ item.producto.price | number: '1.2-2' }}</td>
          <td>
            <button [disabled]="item.cantidad <= 1" (click)="cambiarCantidad(item, -1)">-</button>
            <input #inputCantidad type="number" min="1" class="cantidad"
                   [value]="item.cantidad"
                   (change)="escribirCantidad(item, inputCantidad)"
                   (keyup.enter)="inputCantidad.blur()" />
            <button (click)="cambiarCantidad(item, 1)">+</button>
          </td>
          <td>$ {{ carritoService.subtotalItem(item) | number: '1.2-2' }}</td>
          <td><button (click)="carritoService.eliminar(item.producto.id!)">Eliminar</button></td>
        </tr>
      }
    </tbody>
    <!-- tfoot: resumen (siguiente sección) -->
  </table>
} @else {
  <p class="vacio">Tu carrito está vacío.</p>
}
```

Puntos clave:
- `@let r = carritoService.resumen();` calcula el resumen una vez por renderizado y lo reutiliza en el pie de la tabla.
- El botón **−** se desactiva cuando la cantidad es 1 (para quitar el producto se usa **Eliminar**).
- `#inputCantidad` es una referencia al campo para leer lo que escribió el usuario.
- El pipe `number: '1.2-2'` muestra siempre 2 decimales.

### 6.4 Resumen y cupón

```html
<tfoot>
  <tr><td colspan="4">Subtotal</td>       <td colspan="2">$ {{ r.subtotal | number: '1.2-2' }}</td></tr>
  <tr>
    <td colspan="4">
      Descuentos
      @if (r.porcentajeTramo > 0) { (monto {{ r.porcentajeTramo }}%) }
      @if (r.cupon) { (cupón {{ r.cupon }} {{ r.porcentajeCupon }}%) }
    </td>
    <td colspan="2">- $ {{ r.descuentoTotal | number: '1.2-2' }}</td>
  </tr>
  <tr>
    <td colspan="4">Costo de envío</td>
    <td colspan="2">@if (r.envio === 0) { Gratis } @else { $ {{ r.envio | number: '1.2-2' }} }</td>
  </tr>
  <tr><th colspan="4">Total</th>          <th colspan="2">$ {{ r.total | number: '1.2-2' }}</th></tr>
</tfoot>
```

```html
<p>
  Cupón:
  @if (r.cupon) {
    {{ r.cupon }} <button (click)="quitarCupon()">Quitar</button>
  } @else {
    <input type="text" [(ngModel)]="codigoCupon" (keyup.enter)="aplicarCupon()" />
    <button (click)="aplicarCupon()">Aplicar</button>
    @if (errorCupon) { <span class="text-danger">{{ errorCupon }}</span> }
  }
</p>
```

Como Angular vuelve a renderizar después de cada clic, **todos los montos se recalculan automáticamente** al cambiar una cantidad, eliminar un producto o aplicar un cupón.

---

## 7. Productos recomendados

Al abrir la página, el componente carga el catálogo completo una sola vez:

```ts
ngOnInit(): void {
  this.productoService.listaCatalogo().subscribe({
    next: productos => this.catalogo = productos,
    error: () => this.catalogo = [],
  });
}
```

### 7.1 Productos disponibles

Primero se excluyen los productos que ya están en el carrito y se ordenan por popularidad (calificación y luego número de reseñas):

```ts
private disponibles(): Producto[] {
  const enCarrito = new Set(this.carritoService.items.map(x => x.producto.id));
  return this.catalogo
    .filter(p => !enCarrito.has(p.id))
    .sort((a, b) =>
      (b.rating?.rate ?? 0) - (a.rating?.rate ?? 0) ||
      (b.rating?.count ?? 0) - (a.rating?.count ?? 0));
}
```

### 7.2 "También te puede interesar"

Productos de **las mismas categorías** que los del carrito (máximo 4). Si el carrito está vacío, muestra los más populares.

```ts
tambienTePuedeInteresar(): Producto[] {
  const categorias = new Set(this.carritoService.items.map(x => x.producto.category));
  const disponibles = this.disponibles();
  if (categorias.size === 0) {
    return disponibles.slice(0, MAX_RECOMENDADOS);
  }
  return disponibles.filter(p => categorias.has(p.category)).slice(0, MAX_RECOMENDADOS);
}
```

### 7.3 "Los clientes también compraron"

Productos populares de **otras categorías**, sin repetir los de la sección anterior.

```ts
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
```

> **Limitación:** los productos vienen de FakeStore API y no hay historial de compras real, por lo que esta sección se basa en la popularidad de los productos. Para recomendaciones reales habría que guardar las compras en el backend (por ejemplo, en las tablas `boleta` y `boleta_has_producto`).

### 7.4 Vista de las recomendaciones

Ambas secciones usan la misma plantilla (`ng-template`) para no repetir código:

```html
@let interesar = tambienTePuedeInteresar();
@if (interesar.length > 0) {
  <h2>También te puede interesar</h2>
  <ng-container *ngTemplateOutlet="listaProductos; context: { $implicit: interesar }"></ng-container>
}

<ng-template #listaProductos let-productos>
  <div class="recomendados">
    @for (p of productos; track p.id) {
      <div class="recomendado">
        <a [routerLink]="['/detalleProducto', p.id]">
          <img [src]="p.image" [alt]="p.title" />
          <p class="titulo">{{ p.title }}</p>
        </a>
        <p>$ {{ p.price | number: '1.2-2' }}</p>
        <button (click)="agregarRecomendado(p)">Agregar al carrito</button>
      </div>
    }
  </div>
</ng-template>
```

Al presionar **Agregar al carrito**, el producto pasa al carrito con cantidad 1, desaparece de las recomendaciones y los montos se actualizan.

---

## 8. Cómo probarlo

1. Iniciar el backend y el frontend (`npm start`) y abrir `http://localhost:4200`.
2. Entrar a un producto, elegir una cantidad y presionar **🛒 Agregar al carrito**. El contador del menú aumenta.
3. Ir a **🛒 Carrito** y comprobar:
   - Los botones **−** / **+** y el campo de cantidad cambian el subtotal y el total.
   - Con más de $100 aparece el descuento del 5 %; con más de $200, el del 10 %.
   - Con más de $150 (después de descuentos) el envío es **Gratis**.
   - El cupón `DESCUENTO10` agrega 10 % de descuento; un código inventado muestra **"Cupón no válido."**
   - Al recargar la página, el carrito y el cupón se mantienen.
   - Las secciones de recomendados muestran productos que no están en el carrito.

## 9. Cómo modificar las reglas

Todo está en la parte superior de `src/app/services/carrito-service.ts`:

- **Nuevo cupón:** agregar una línea en `CUPONES`, por ejemplo `VERANO20: 20,`.
- **Cambiar tramos de descuento:** editar `TRAMOS_DESCUENTO` (mantenerlos ordenados de mayor a menor).
- **Cambiar el envío:** editar `COSTO_ENVIO` y `ENVIO_GRATIS_DESDE`.
- **Más o menos recomendaciones:** cambiar `MAX_RECOMENDADOS` en `carrito.ts`.
