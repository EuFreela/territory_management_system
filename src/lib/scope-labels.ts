/** Rótulos das permissões (escopos) para telas de papel e permissões exclusivas. */
export const SCOPE_LABELS: Record<string, { name: string; description: string }> = {
  'territory:create': { name: 'Criar território', description: 'Cadastrar novos territórios.' },
  'territory:read': { name: 'Ver territórios', description: 'Consultar territórios e mapas.' },
  'territory:update': { name: 'Editar território', description: 'Alterar dados de territórios existentes.' },
  'territory:delete': { name: 'Excluir território', description: 'Remover territórios.' },
  'territory:set_daily': { name: 'Definir território do dia', description: 'Escolher o território do dia / escala.' },
  'block:manage': { name: 'Gerir não em casa', description: 'Criar e editar quadras do não em casa.' },
  'block:check': { name: 'Marcar casas visitadas', description: 'Marcar números visitados no não em casa.' },
  'user:manage': { name: 'Gerir usuários', description: 'Gerenciar usuários e papéis.' },
  'config:cep': { name: 'Trocar região (CEP)', description: 'Alternar a congregação/CEP de trabalho.' },
  'congregation:manage': { name: 'Gerir congregações', description: 'Administrar o cadastro de congregações.' },
};