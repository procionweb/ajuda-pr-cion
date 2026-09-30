import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  LoaderCircle,
  MessageCircleQuestion,
  RefreshCw,
  Route,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  analyzeTicket,
  type TicketDiagnosis,
  type TicketDiagnosisInput,
} from "@/lib/ticket-diagnosis";

type Props = { input: TicketDiagnosisInput };

const confidenceLabels = { baixa: "Baixa", media: "Média", alta: "Alta" } as const;
const basisLabels = {
  base_interna: "Base interna",
  conhecimento_geral: "Conhecimento técnico",
  mista: "Base + conhecimento técnico",
} as const;

export function TicketAiDiagnosis({ input }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<TicketDiagnosis | null>(null);

  useEffect(() => {
    setOpen(false);
    setLoading(false);
    setError(null);
    setDiagnosis(null);
  }, [input.ticketId]);

  const run = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      setDiagnosis(await analyzeTicket(input));
    } catch (requestError) {
      console.error("[ticket-diagnosis] Falha ao analisar chamado.", requestError);
      setError("Não foi possível analisar este chamado agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
            <BrainCircuit className="h-4 w-4 text-primary" />
            Assistente de diagnóstico
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Combina a base interna, chamados resolvidos e conhecimento técnico.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {diagnosis && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(!open)}>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {open ? "Recolher" : "Ver análise"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => void run()}
            disabled={loading || !input.description}
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : diagnosis ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <BrainCircuit className="h-4 w-4" />
            )}
            {loading ? "Analisando" : diagnosis ? "Analisar novamente" : "Analisar com IA"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.025]">
          {loading && !diagnosis ? (
            <div className="flex min-h-36 items-center justify-center gap-2 text-[12px] text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
              Cruzando o chamado com o conhecimento disponível...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-4 text-[12px] text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          ) : diagnosis ? (
            <DiagnosisResult diagnosis={diagnosis} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function DiagnosisResult({ diagnosis }: { diagnosis: TicketDiagnosis }) {
  const referencedSources = diagnosis.sources.filter((source) =>
    diagnosis.sourceRefs.includes(source.id),
  );

  return (
    <div className="divide-y divide-border">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            Leitura inicial
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-foreground">{diagnosis.assessment}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <Badge variant="secondary">{basisLabels[diagnosis.answerBasis]}</Badge>
          <Badge
            variant="outline"
            className={cn(
              diagnosis.confidence === "alta" && "border-success/40 bg-success/10 text-success",
              diagnosis.confidence === "media" &&
                "border-warning/40 bg-warning/10 text-warning-foreground",
              diagnosis.confidence === "baixa" &&
                "border-muted-foreground/30 text-muted-foreground",
            )}
            title={diagnosis.confidenceReason}
          >
            Confiança {confidenceLabels[diagnosis.confidence]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <DiagnosisList
          icon={AlertTriangle}
          title="Causas prováveis"
          items={diagnosis.probableCauses}
        />
        <DiagnosisList
          icon={MessageCircleQuestion}
          title="Perguntas que faltam"
          items={diagnosis.missingQuestions}
        />
        <div className="lg:col-span-2">
          <DiagnosisList
            icon={Route}
            title="Próximas verificações"
            items={diagnosis.suggestedSteps}
            ordered
          />
        </div>
      </div>

      {(referencedSources.length > 0 || diagnosis.shouldEscalate) && (
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          {referencedSources.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                <BookOpen className="h-4 w-4 text-primary" /> Fontes relacionadas
              </p>
              <div className="space-y-1.5">
                {referencedSources.map((source) => (
                  <div
                    key={source.id}
                    className="rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-medium text-foreground">{source.title}</p>
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir fonte"
                          className="text-primary hover:opacity-75"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {source.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {diagnosis.shouldEscalate && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                <ShieldAlert className="h-4 w-4 text-warning" /> Encaminhamento recomendado
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                {diagnosis.escalationReason}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 bg-muted/20 px-4 py-3 text-[10.5px] leading-relaxed text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {diagnosis.warning}
      </div>
    </div>
  );
}

function DiagnosisList({
  icon: Icon,
  title,
  items,
  ordered = false,
}: {
  icon: typeof AlertTriangle;
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </p>
      {items.length ? (
        <ol className="space-y-1.5">
          {items.map((item, index) => (
            <li
              key={`${title}-${index}`}
              className="flex gap-2 text-[11.5px] leading-relaxed text-muted-foreground"
            >
              <span className="mt-0.5 shrink-0 font-semibold text-primary">
                {ordered ? `${index + 1}.` : "•"}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[11px] text-muted-foreground">Nenhum item identificado.</p>
      )}
    </div>
  );
}
