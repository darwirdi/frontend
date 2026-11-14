import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Producto } from '../models/producto.model';
import { Observable } from 'rxjs';

const baseUrl ='https://fakestoreapi.com/products';

@Injectable({
  providedIn: 'root',
})
export class ProductoService {

    constructor(private http:HttpClient) { }

    listaCatalogo():Observable<Producto[]>{
      return this.http.get<Producto[]>(baseUrl);
    }

    verDetalle(id: string):Observable<Producto>{
      return this.http.get<Producto>(baseUrl+ "/" + id);
    }

    // categorías (strings) de FakeStore API
    listaCategorias(): Observable<string[]> {
      return this.http.get<string[]>(`${baseUrl}/categories`);
    }

    // productos filtrados por una categoría específica
    listaPorCategoria(categoria: string): Observable<Producto[]> {
      return this.http.get<Producto[]>(`${baseUrl}/category/${categoria}`);
    }

}