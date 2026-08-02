export type User = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export type Territory = {
  id: number;
  user_id: number;
  name: string;
  number?: string | null;
  geojson?: string | null;
  is_daily: number;
  created_at: string;
  updated_at: string;
};

export type Block = {
  id: number;
  territory_id: number;
  name: string;
  house_numbers: string[];
  sort_order?: number;
};

export type TerritoryImage = {
  id: number;
  territory_id: number;
  image_url: string;
  caption?: string | null;
  sort_order?: number;
};
