/** Senhas comuns / fracas bloqueadas explicitamente */
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

/**
 * Política de senha forte:
 * - mín. 10 caracteres
 * - 1 minúscula, 1 maiúscula, 1 número, 1 especial
 * - não pode ser senha comum da lista
 */
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
