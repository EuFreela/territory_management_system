import type { ReactNode } from 'react';
import { IconInfo } from '@/components/Map/mapIcons';

type FieldErrorProps = {
  id?: string;
  children: ReactNode;
};

export default function FieldError({ id, children }: FieldErrorProps) {
  return (
    <div
      id={id}
      role="alert"
      className="mt-2 flex items-start gap-2 rounded-apple border border-apple-red/25 bg-apple-red/10 px-3 py-2 text-[12px] font-medium leading-snug text-apple-red"
    >
      <IconInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
