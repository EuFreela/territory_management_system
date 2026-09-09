import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { IconArrowLeft, IconKey, IconSave } from '@/components/Map/mapIcons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import FieldError from '@/components/ui/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { SYSTEM_ADMIN_EMAIL } from '@/lib/permissions';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const systemAdmin = user != null && user.email.trim().toLowerCase() === SYSTEM_ADMIN_EMAIL;
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (user?.name != null) setName(user.name);
  }, [user?.name]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (systemAdmin) return;
    const trimmed = name.trim();
    if (trimmed === '') {
      setNameError('Preencha este campo.');
      return;
    }
    if (trimmed.length < 2) {
      setNameError('Use pelo menos 2 caracteres.');
      return;
    }
    if (trimmed.length > 150) {
      setNameError('Use no máximo 150 caracteres.');
      return;
    }
    setNameError('');

    setSaving(true);
    try {
      await api('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: trimmed }),
      });
      await refresh();
      toast.success('Nome atualizado com sucesso.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar o nome.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 sm:py-10">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Conta</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
          Minha conta
        </h1>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
          {systemAdmin
            ? 'Conta de sistema fixa: somente a senha pode ser alterada.'
            : 'Edite seu nome e troque sua senha. Email e papel são definidos pelo administrador.'}
        </p>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold tracking-tight">Perfil</h2>
            <p className="mb-4 mt-1 text-sm leading-relaxed text-muted-foreground">
              O nome aparece para os demais usuários no mapa (GPS) e nas listas do sistema.
            </p>

            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="profile-name">Nome</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  maxLength={150}
                  disabled={systemAdmin}
                  autoComplete="name"
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? 'profile-name-error' : undefined}
                />
                {nameError ? <FieldError id="profile-name-error">{nameError}</FieldError> : null}
                {systemAdmin ? (
                  <p className="text-xs text-muted-foreground">
                    O nome da conta de sistema é fixo e não pode ser alterado.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input
                  value={user?.email ?? ''}
                  className="cursor-not-allowed opacity-70"
                  disabled
                  readOnly
                  tabIndex={-1}
                  aria-readonly
                />
                <p className="text-xs text-muted-foreground">
                  Email só pode ser alterado pelo administrador.
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label>Papel</Label>
                <Input
                  value={user?.role?.name ?? '—'}
                  className="cursor-not-allowed opacity-70"
                  disabled
                  readOnly
                  tabIndex={-1}
                  aria-readonly
                />
                <p className="text-xs text-muted-foreground">
                  Papel só pode ser alterado pelo administrador.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  data-tooltip="Voltar"
                  aria-label="Voltar"
                >
                  <Link to="/dashboard">
                    <IconArrowLeft />
                  </Link>
                </Button>
                {systemAdmin ? null : (
                  <Button type="submit" disabled={saving}>
                    <IconSave />
                    {saving ? 'Salvando…' : 'Salvar'}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold tracking-tight">Senha</h2>
            <p className="mb-4 mt-1 text-sm leading-relaxed text-muted-foreground">
              Use uma senha forte: mínimo 10 caracteres, com maiúscula, minúscula, número e
              caractere especial.
            </p>
            <Button asChild>
              <Link to="/change-password">
                <IconKey className="size-4" />
                Trocar Senha
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
