export function onlyDigits(cep: string) {
  return cep.replace(/\D/g, '');
}

export function formatCep(cep: string) {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function maskCepInput(raw: string) {
  const digits = onlyDigits(raw).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
