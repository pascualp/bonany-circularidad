export interface MonthlyData {
  mes: string;
  total: number;
  productoLocal: number;
  porcentajeLocal: number;
  envasesRetornable: number;
  noRetornable: number;
  porcentajeRetornable: number;
  articulosNoRetorno: number;
  porcentajeArtNoRetorno: number;
}

export interface HotelReport {
  hotelName: string;
  monthlyData: MonthlyData[];
  total: MonthlyData;
}
