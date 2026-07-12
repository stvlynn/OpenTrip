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

/** Avatar used for the live user-location marker on the map. */
export interface UserLocationAvatar {
  name: string;
  bg: string;
  fg: string;
  src?: string | null;
  seed: string;
}
