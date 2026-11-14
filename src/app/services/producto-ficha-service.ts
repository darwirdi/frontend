import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppSettings } from '../../app.settings';
import { ProductoFicha } from '../models/producto-ficha.model';

const baseUrl = AppSettings.API_ENDPOINT + '/productoFicha';

@Injectable({
  providedIn: 'root',
})
export class ProductoFichaService {

  constructor(private http: HttpClient) {}

  // El idProducto es el id del producto en FakeStore API
  obtenerFicha(idProducto: number): Observable<ProductoFicha> {
    return this.http.get<ProductoFicha>(`${baseUrl}/${idProducto}`);
  }
}
