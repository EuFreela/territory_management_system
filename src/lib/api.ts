let unauthorizedHandler: (() => void) | null = null;

/** Registra um callback global invocado quando qualquer requisição autenticada
 *  responde 401 (sessão caída/usuário bloqueado) — usado para derrubar a sessão. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    // Sessão inválida (ex.: conta bloqueada). Desconecta o usuário automaticamente.
    unauthorizedHandler?.();
  }

  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? 'Erro na requisição.');
  }

  return data as T;
}
