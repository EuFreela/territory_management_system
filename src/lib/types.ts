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
  /** Nota informativa da rua (só exibição; não clicável) */
  description?: string | null;
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
  /** Registros de rua ainda incompletos (legado: unfinished_blocks) */
  unfinished_blocks: number;
  unfinished_streets?: number;
  /** Quadras distintas com ao menos uma rua incompleta */
  unfinished_quadras?: number;
  total_blocks: number;
  total_streets?: number;
  /** Casas ainda não marcadas (pendentes) */
  pending_houses: number;
  /** Total de números de casa nas ruas incompletas */
  open_house_numbers?: number;
  blocks?: Block[];
};

export type DashboardData = {
  user: {
    id: number;
    name: string;
    email: string;
    role?: { id: number; slug: string; name: string } | null;
    permissions?: string[];
    isAdmin?: boolean;
  };
  territories: Territory[];
  daily: (Territory & { blocks: Block[]; is_finished?: boolean }) | null;
  /** Territórios com ao menos uma quadra de "não em casa" ainda incompleta */
  unfinished?: UnfinishedTerritory[];
};

/** Entrada do histórico de territórios finalizados */
export type FinishedTerritoryHistory = {
  id: number;
  territory_id?: number | null;
  territory_name: string;
  territory_number?: string | null;
  field_date: string;
  field_time?: string | null;
  leader_name?: string | null;
  people_count?: number | null;
  finished_by_user_id?: number | null;
  finished_by_name?: string | null;
  finished_at?: string;
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

/** Designação de dirigente do serviço de campo */
export type FieldAssignment = {
  id: number;
  service_date?: string | null;
  weekday_label: string;
  assignee_name: string;
  period_label?: string | null;
  is_fixed: number | boolean;
  fixed_weekday?: number | null;
  /** Horário ou período (ex: 08:00, Manhã, Tarde, Noite) — usado em fixos e datados */
  fixed_time?: string | null;
  sort_order?: number;
};

export type FieldLeadersToday = {
  date: string;
  weekday: number;
  weekday_label: string;
  dated: FieldAssignment[];
  fixed: FieldAssignment[];
};
