import { GitBranch, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCrmCatalog } from "@/lib/crm-catalog-api";
import { formatVersionDate, type ErpVersion } from "@/lib/erp-versions";

export function VersionsContent() {
  const { items, loaded } = useCrmCatalog<ErpVersion>("versions");
  const versions = [...items].sort((a, b) => b.data_versao.localeCompare(a.data_versao));

  if (!loaded) return <p className="py-8 text-sm text-muted-foreground">Carregando versões...</p>;

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border hidden sm:block" />
      <div className="space-y-5">
        {versions.map((v) => (
          <div key={v.id} className="sm:pl-12 relative">
            <div className="hidden sm:grid absolute left-0 top-4 h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
              <GitBranch className="h-4 w-4" />
            </div>
            <Card className="p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:justify-between mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-lg font-semibold">{v.versao}</h4>
                    <Badge className="bg-success/15 text-success hover:bg-success/15">
                      Versão Hádron
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatVersionDate(v.data_versao)}
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {[
                  ["Runtime", v.data_runtime],
                  ["Arquivos", v.data_arq],
                  ["Arquivos base", v.data_arq_bas],
                  ["Alteração", v.data_alterar],
                ].map(([label, date]) => (
                  <li key={label} className="flex items-start gap-2 text-sm">
                    <CalendarDays className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>
                      <strong>{label}:</strong> {formatVersionDate(date)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
