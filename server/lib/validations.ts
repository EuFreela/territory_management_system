import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(150),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export const territorySchema = z.object({
  // UI: "Localidade" (ex: Mundo Novo) — coluna name no banco
  name: z.string().min(2, 'Localidade é obrigatória').max(120),
  // UI: "Terr. N.º" (ex: 31)
  number: z.string().max(50).nullable().optional(),
  // Polígono da área do território (obrigatório ao salvar)
  geojson: z.string().min(10, 'Desenhe a área do território no mapa (mínimo 3 pontos).'),
  is_daily: z.boolean().optional(),
});

// Registro "NÃO EM CASA": número da quadra + rua + casas
export const blockSchema = z.object({
  name: z.string().min(1, 'Número da quadra é obrigatório').max(100),
  street_name: z.string().min(1, 'Nome da rua é obrigatório').max(180),
  house_numbers: z
    .array(z.union([z.string(), z.number()]))
    .min(1, 'Informe ao menos um número de casa (não em casa)'),
  sort_order: z.number().int().optional(),
});

// Marcar / desmarcar casa já visitada (checklist)
export const toggleHouseSchema = z.object({
  house_number: z.union([z.string(), z.number()]).transform(String),
  done: z.boolean(),
});
