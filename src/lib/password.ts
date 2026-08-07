/** Espelha a política de senha do backend (server/lib/password.ts) */
const BLOCKED = new Set(
  [
    '123456',
    '1234567',
    '12345678',
    '123456789',
    '1234567890',
    'password',
    'password1',
    'senha',
    'senha123',
    'admin',
    'admin123',
    'qwerty',
    'abc123',
    '111111',
    '000000',
    'campo',
    'campo123',
  ].map((s) => s.toLowerCase()),
);

export function validateStrongPassword(password: string): string | null {
  if (typeof password !== 'string' || password.length < 10) {
    return 'Senha deve ter pelo menos 10 caracteres.';
  }
  if (password.length > 128) {
    return 'Senha muito longa (máx. 128).';
  }
  if (BLOCKED.has(password.toLowerCase())) {
    return 'Senha muito comum. Escolha outra.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Senha precisa de ao menos 1 letra minúscula.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Senha precisa de ao menos 1 letra maiúscula.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Senha precisa de ao menos 1 número.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Senha precisa de ao menos 1 caractere especial (ex.: !@#$%).';
  }
  return null;
}

export function isStrongPassword(password: string) {
  return validateStrongPassword(password) === null;
}

export const PASSWORD_REQUIREMENTS: Array<{ label: string; test: (value: string) => boolean }> = [
  { label: 'Mínimo 10 caracteres', test: (v) => v.length >= 10 },
  { label: 'Uma letra minúscula', test: (v) => /[a-z]/.test(v) },
  { label: 'Uma letra maiúscula', test: (v) => /[A-Z]/.test(v) },
  { label: 'Um número', test: (v) => /[0-9]/.test(v) },
  { label: 'Um caractere especial (!@#$%)', test: (v) => /[^A-Za-z0-9]/.test(v) },
  { label: 'Não ser uma senha comum', test: (v) => !BLOCKED.has(v.toLowerCase()) },
];

/** Gera senha forte aleatória (mesma regra do script scripts/create-admin.js) */
export function generateStrongPassword(length = 18): string {
  const pools = {
    lower: 'abcdefghijkmnpqrstuvwxyz',
    upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
    digits: '23456789',
    special: '!@#$%&*+-=?_',
  };
  const all = Object.values(pools).join('');
  const rand = (n: number) => Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * n);

  const chars = Object.values(pools).map((pool) => pool[rand(pool.length)]);
  while (chars.length < length) chars.push(all[rand(all.length)]);

  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
