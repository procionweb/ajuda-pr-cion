import { Building2, FileText, Info, type LucideIcon } from "lucide-react";

export function RegistrationSummary({
  title,
  subtitle,
  items,
  children,
  note,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: string; icon: LucideIcon }>;
  children?: React.ReactNode;
  note: string;
}) {
  return (
    <aside className="min-w-0">
      <section className="sticky top-6 rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-medium">Resumo</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Prévia do cadastro em tempo real.
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-4 rounded-2xl border p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="break-words text-sm font-bold">{title}</p>
              <p className="mt-0.5 break-words text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {items.map(({ label, value, icon: Icon }) => (
              <div className="min-w-0" key={label}>
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Icon className="size-3.5 shrink-0" />
                  {label}
                </p>
                <p className="mt-1 break-words font-semibold">{value || "Não informado"}</p>
              </div>
            ))}
          </div>
          {children}
        </div>
        <div className="mt-4 flex gap-2 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>{note}</p>
        </div>
      </section>
    </aside>
  );
}
