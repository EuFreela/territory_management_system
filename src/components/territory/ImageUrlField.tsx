import FieldError from '@/components/ui/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IMAGE_URL_MAX_LENGTH } from '@/lib/image-url';

type ImageUrlFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
};

export default function ImageUrlField({
  id = 'image-url',
  value,
  onChange,
  error,
  disabled,
}: ImageUrlFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Link da imagem</Label>
      <Input
        id={id}
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://…"
        maxLength={IMAGE_URL_MAX_LENGTH}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : `${id}-hint`}
      />
      {error ? (
        <FieldError id={errorId}>{error}</FieldError>
      ) : (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          Cole o link público da foto do cartão (https). O arquivo não fica no servidor — só o
          endereço. Google Drive e Dropbox são convertidos automaticamente.
        </p>
      )}
    </div>
  );
}
