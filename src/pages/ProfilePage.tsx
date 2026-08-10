import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { IconKey, IconSave } from '@/components/Map/mapIcons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { onInputClearValidity, onInvalidPtBr } from '@/lib/form-validation-pt';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.name != null) setName(user.name);
  }, [user?.name]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error('Informe um nome com pelo menos 2 caracteres.');
      return;
    }

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
          Edite seu nome e troque sua senha. Email e papel são definidos pelo administrador.
        </p>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold tracking-tight">Perfil</h2>
            <p className="mb-4 mt-1 text-sm leading-relaxed text-muted-foreground">
              O nome aparece para os demais usuários no mapa (GPS) e nas listas do sistema.
            </p>

            <form
              onSubmit={onSubmit}
              onInvalidCapture={onInvalidPtBr}
              onInput={onInputClearValidity}
              className="space-y-4"
            >
              <div className="grid gap-1.5">
                <Label htmlFor="profile-name">Nome</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={150}
                  autoComplete="name"
                />
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

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  size="icon"
                  disabled={saving}
                  data-tooltip="Salvar nome"
                >
                  <IconSave />
                </Button>
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
            <Button asChild size="icon" data-tooltip="Alterar senha">
              <Link to="/change-password">
                <IconKey className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
