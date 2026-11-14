// Modelos de la ficha de producto (respuesta de GET /url/productoFicha/{idProducto})

export interface ProductoDetalle {
  idProductoDetalle: number;
  idProducto: number;
  sku: string;
  condicion: string;
  marca?: string | null;
  modelo?: string | null;
  descripcionGeneral?: string | null;
}

export interface ProductoAtributo {
  idAtributo: number;
  idProducto: number;
  nombre: string;
  valor: string;
  orden: number;
}

export interface ProductoVariante {
  idVariante: number;
  idProducto: number;
  sku: string;
  color?: string | null;
  talla?: string | null;   // null en productos sin tallas (electrónica, mochila, etc.)
  stock: number;
  estado: number;
}

export interface ProductoFicha {
  detalle: ProductoDetalle;
  atributos: ProductoAtributo[];
  variantes: ProductoVariante[];
}
