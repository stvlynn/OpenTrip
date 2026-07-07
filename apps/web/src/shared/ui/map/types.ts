export interface MapStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  day: number;
  color: string;
  num: number;
  transit: boolean;
}

export interface SearchResult {
  lat: number;
  lng: number;
  name: string;
}
