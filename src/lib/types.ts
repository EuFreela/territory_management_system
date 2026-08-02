export type Territory = {
  id: number;
  user_id: number;
  name: string;
  number?: string | null;
  cep?: string | null;
  geojson?: string | null;
  map_lat?: number | string | null;
  map_lng?: number | string | null;
  is_daily: number;
  created_at?: string;
  updated_at?: string;
  blocks?: Block[];
};

/** Registro "NÃO EM CASA" (quadra + rua + casas) */
export type Block = {
  id: number;
  territory_id?: number;
  /** Número da quadra */
  name: string;
  /** Nome da rua */
  street_name?: string | null;
  /** Números das casas (não em casa) */
  house_numbers: string[];
  /** Casas já trabalhadas / concluídas no checklist */
  completed_houses?: string[];
  done_count?: number;
  total?: number;
  is_finished?: boolean;
  sort_order?: number;
};

export type UnfinishedTerritory = Territory & {
  unfinished_blocks: number;
  total_blocks: number;
  pending_houses: number;
  blocks?: Block[];
};

export type DashboardData = {
  user: { id: number; name: string; email: string };
  territories: Territory[];
  daily: (Territory & { blocks: Block[] }) | null;
  /** Territórios com ao menos uma quadra de "não em casa" ainda incompleta */
  unfinished?: UnfinishedTerritory[];
};

export type CepLocation = {
  cep: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  lat: number;
  lng: number;
  label: string;
};
