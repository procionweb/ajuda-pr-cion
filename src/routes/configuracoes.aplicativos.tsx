import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AppWindow,
  ChevronLeft,
  ChevronRight,
  Globe2,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  Trash2,
  Upload,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/configuracoes/aplicativos")({
  head: () => ({ meta: [{ title: "Aplicativos - Configurações - Portal Prócion" }] }),
  component: ApplicationsSettingsPage,
});

type ApplicationRow = {
  id: string;
  legacy_id: string;
  name: string | null;
  app_type: string | null;
  build_version: string | null;
  db_version: string | null;
  image_name: string | null;
  status: string | null;
  active: boolean;
  crm_created_at: string | null;
  crm_updated_at: string | null;
};

const PAGE_SIZE = 10;
const LOGO_BUCKET = "application-logos";

type ApplicationForm = {
  name: string;
  appType: string;
  buildVersion: string;
  dbVersion: string;
  imageUrl: string;
};

const emptyForm: ApplicationForm = {
  name: "",
  appType: "",
  buildVersion: "",
  dbVersion: "",
  imageUrl: "",
};

const appPresentation: Record<
  string,
  { icon: typeof AppWindow; iconClass: string; backgroundClass: string }
> = {
  MOB: {
    icon: Smartphone,
    iconClass: "text-sky-700 dark:text-sky-300",
    backgroundClass: "bg-sky-100 dark:bg-sky-950/60",
  },
  WEB: {
    icon: Globe2,
    iconClass: "text-indigo-700 dark:text-indigo-300",
    backgroundClass: "bg-indigo-100 dark:bg-indigo-950/60",
  },
  B2C: {
    icon: ShoppingBag,
    iconClass: "text-emerald-700 dark:text-emerald-300",
    backgroundClass: "bg-emerald-100 dark:bg-emerald-950/60",
  },
  B2B: {
    icon: UsersRound,
    iconClass: "text-amber-700 dark:text-amber-300",
    backgroundClass: "bg-amber-100 dark:bg-amber-950/60",
  },
};

function ApplicationsSettingsPage() {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ApplicationRow | null>(null);
  const [deleting, setDeleting] = useState<ApplicationRow | null>(null);
  const [form, setForm] = useState<ApplicationForm>(emptyForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [saving, setSaving] = useState(false);

  function openEditor(application?: ApplicationRow) {
    setEditing(application ?? null);
    setLogoFile(null);
    const imageUrl = application?.image_name?.startsWith("http") ? application.image_name : "";
    setLogoPreview(imageUrl);
    setForm(
      application
        ? {
            name: application.name ?? "",
            appType: application.app_type ?? "",
            buildVersion: application.build_version ?? "",
            dbVersion: application.db_version ?? "",
            imageUrl,
          }
        : emptyForm,
    );
    setEditorOpen(true);
  }

  function closeEditor() {
    if (saving) return;
    if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setEditorOpen(false);
  }

  function selectLogo(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Escolha uma imagem PNG, JPG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("O logotipo deve ter no máximo 2 MB.");
      return;
    }
    if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function saveApplication() {
    if (!form.name.trim()) {
      toast.error("Informe a descrição do aplicativo.");
      return;
    }
    setSaving(true);
    let imageUrl = form.imageUrl;
    let uploadedPath: string | null = null;
    try {
      if (logoFile) {
        const extension = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        uploadedPath = `${editing?.id ?? crypto.randomUUID()}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(LOGO_BUCKET)
          .upload(uploadedPath, logoFile, { contentType: logoFile.type, upsert: false });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from(LOGO_BUCKET).getPublicUrl(uploadedPath).data.publicUrl;
      }

      // Imported CRM tables are not represented in the generated Supabase types yet.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: saveError } = await (supabase as any).rpc(
        "configuration_application_save",
        {
          application_id: editing?.id ?? null,
          application_payload: {
            name: form.name.trim(),
            app_type: form.appType.trim(),
            build_version: form.buildVersion.trim(),
            db_version: form.dbVersion.trim(),
            image_url: imageUrl || null,
          },
        },
      );
      if (saveError) throw saveError;
      toast.success(editing ? "Aplicativo atualizado." : "Aplicativo adicionado.");
      if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      setEditorOpen(false);
      await loadApplications();
    } catch (saveError) {
      if (uploadedPath) await supabase.storage.from(LOGO_BUCKET).remove([uploadedPath]);
      toast.error(
        saveError instanceof Error ? saveError.message : "Não foi possível salvar o aplicativo.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteApplication() {
    if (!deleting) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any).rpc(
        "configuration_application_delete",
        { application_id: deleting.id },
      );
      if (deleteError) throw deleteError;
      toast.success("Aplicativo excluído.");
      setDeleting(null);
      await loadApplications();
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível excluir o aplicativo.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function loadApplications() {
    setLoading(true);
    setError(null);
    // Imported CRM tables are not represented in the generated Supabase types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: requestError } = await (supabase as any).rpc(
      "configuration_applications_list",
    );
    if (requestError) {
      setError(requestError.message);
      setApplications([]);
    } else {
      setApplications((Array.isArray(data) ? data : []) as ApplicationRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadApplications();
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return applications;
    return applications.filter((application) =>
      [application.name, application.app_type, application.build_version, application.db_version]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [applications, query]);

  useEffect(() => setPage(0), [query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <AppShell>
      <PageHeader
        title="Aplicativos"
        description="Versões dos aplicativos integrados ao Hádron."
        breadcrumbs={[{ label: "Configurações" }, { label: "Aplicativos" }]}
      />

      <section className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar por aplicativo, tipo ou versão"
            className="h-10 pl-9"
          />
        </label>
        <Button
          variant="outline"
          className="h-10 gap-2"
          onClick={() => void loadApplications()}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </Button>
        <Button className="h-10 gap-2" onClick={() => openEditor()}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </section>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b bg-muted/35 px-5 py-3 text-xs font-medium uppercase text-muted-foreground">
          Aplicativos ({filtered.length})
        </div>
        {loading ? (
          <div className="grid min-h-56 place-items-center text-sm text-muted-foreground">
            Carregando aplicativos...
          </div>
        ) : error ? (
          <div className="grid min-h-56 place-items-center px-6 text-center text-sm text-destructive">
            Não foi possível carregar os aplicativos: {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="grid min-h-56 place-items-center text-sm text-muted-foreground">
            Nenhum aplicativo encontrado.
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((application) => {
              const presentation = appPresentation[application.app_type ?? ""] ?? {
                icon: AppWindow,
                iconClass: "text-muted-foreground",
                backgroundClass: "bg-muted",
              };
              const Icon = presentation.icon;
              return (
                <li
                  key={application.id}
                  className="flex min-h-28 items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/20 sm:gap-5 sm:px-6"
                >
                  <div
                    className={cn(
                      "grid h-16 w-16 shrink-0 place-items-center rounded-lg",
                      presentation.backgroundClass,
                    )}
                    title={application.image_name ?? undefined}
                  >
                    {application.image_name?.startsWith("http") ? (
                      <img
                        src={application.image_name}
                        alt=""
                        className="h-full w-full rounded-lg object-contain p-1"
                      />
                    ) : (
                      <Icon className={cn("h-8 w-8", presentation.iconClass)} strokeWidth={1.8} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground sm:text-lg">
                        {application.name || "Aplicativo sem nome"}
                      </h2>
                      {application.app_type && (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {application.app_type}
                        </span>
                      )}
                    </div>
                    <dl className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2 sm:gap-x-8">
                      <div className="flex gap-1.5">
                        <dt>Build:</dt>
                        <dd className="font-medium text-foreground">
                          {application.build_version || "Não informado"}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt>Versão BD:</dt>
                        <dd className="font-medium text-foreground">
                          {application.db_version || "Não informada"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar ${application.name || "aplicativo"}`}
                          onClick={() => openEditor(application)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Editar aplicativo</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Excluir ${application.name || "aplicativo"}`}
                          onClick={() => setDeleting(application)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Excluir aplicativo</TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "aplicativo" : "aplicativos"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              disabled={safePage === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-24 text-center text-muted-foreground">
              Página {safePage + 1} de {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próxima página"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <ApplicationEditorDialog
        open={editorOpen}
        editing={editing}
        form={form}
        logoPreview={logoPreview}
        saving={saving}
        onOpenChange={(open) => (open ? setEditorOpen(true) : closeEditor())}
        onFormChange={setForm}
        onLogoChange={selectLogo}
        onSave={() => void saveApplication()}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aplicativo?</AlertDialogTitle>
            <AlertDialogDescription>
              O aplicativo <strong>{deleting?.name || "selecionado"}</strong> será removido. Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void deleteApplication();
              }}
            >
              {saving ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function ApplicationEditorDialog({
  open,
  editing,
  form,
  logoPreview,
  saving,
  onOpenChange,
  onFormChange,
  onLogoChange,
  onSave,
}: {
  open: boolean;
  editing: ApplicationRow | null;
  form: ApplicationForm;
  logoPreview: string;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: ApplicationForm) => void;
  onLogoChange: (file?: File) => void;
  onSave: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const presentation = appPresentation[form.appType.toUpperCase()] ?? {
    icon: AppWindow,
    iconClass: "text-muted-foreground",
    backgroundClass: "bg-muted",
  };
  const PreviewIcon = presentation.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Alterar aplicativo" : "Novo aplicativo"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="grid gap-2">
            <Label>Logotipo</Label>
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg border",
                  presentation.backgroundClass,
                )}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Prévia do logotipo" className="h-full w-full object-contain p-1" />
                ) : (
                  <PreviewIcon className={cn("h-9 w-9", presentation.iconClass)} />
                )}
              </div>
              <div>
                <input
                  ref={fileInput}
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => onLogoChange(event.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Escolher logotipo
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">PNG, JPG ou WebP de até 2 MB.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="application-name">Descrição</Label>
            <Input
              id="application-name"
              value={form.name}
              maxLength={120}
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
              placeholder="Nome do aplicativo"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="application-type">Tipo</Label>
              <Input
                id="application-type"
                value={form.appType}
                maxLength={20}
                onChange={(event) => onFormChange({ ...form, appType: event.target.value.toUpperCase() })}
                placeholder="MOB"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="application-build">App v Compilação</Label>
              <Input
                id="application-build"
                value={form.buildVersion}
                maxLength={40}
                onChange={(event) => onFormChange({ ...form, buildVersion: event.target.value })}
                placeholder="110"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="application-database">BD Versão</Label>
              <Input
                id="application-database"
                value={form.dbVersion}
                maxLength={40}
                onChange={(event) => onFormChange({ ...form, dbVersion: event.target.value })}
                placeholder="14"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving} className="gap-2">
            <ImagePlus className="h-4 w-4" />
            {saving ? "Salvando..." : editing ? "Alterar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
