import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Mail, Shield, Bell, KeyRound, Camera } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { currentUser } from "@/lib/mock-data";
import { useProfileAvatar } from "@/lib/profile-avatar";
import { uploadProfileAvatar } from "@/lib/kanban-api";

export const Route = createFileRoute("/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha Conta — Portal Prócion" },
      { name: "description", content: "Gerencie seu perfil, segurança e preferências no Portal Prócion." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const avatarUrl = useProfileAvatar();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast.error("Escolha uma imagem JPG, PNG ou WebP de até 2 MB.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await uploadProfileAvatar(dataUrl);
      window.dispatchEvent(new Event("procion:avatar-updated"));
      toast.success("Foto de perfil atualizada.");
    } catch {
      toast.error("Não foi possível atualizar a foto.");
    } finally {
      setUploading(false);
    }
  };
  return (
    <AppShell>
      <PageHeader
        title="Minha Conta"
        description="Gerencie seu perfil, segurança e preferências."
        breadcrumbs={[{ label: "Minha Conta" }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl ?? undefined} alt="Foto de perfil" />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
                {currentUser.initials}
              </AvatarFallback>
            </Avatar>
            <h3 className="mt-4 text-lg font-semibold">{currentUser.name}</h3>
            <p className="text-sm text-muted-foreground">{currentUser.role}</p>
            <Badge className="mt-3 bg-success/15 text-success hover:bg-success/15">
              Conta ativa
            </Badge>
            <div className="mt-6 w-full space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="truncate">{currentUser.email}</span>
              </div>
            </div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
            <Button variant="outline" size="sm" className="mt-6 w-full" disabled={uploading} onClick={() => fileInput.current?.click()}>
              <Camera className="mr-2 h-4 w-4" />{uploading ? "Enviando..." : "Trocar foto"}
            </Button>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold">Segurança</h4>
                <p className="text-sm text-muted-foreground">
                  Proteja sua conta com autenticação em duas etapas.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <SettingRow
                title="Autenticação em duas etapas (2FA)"
                description="Recomendado para todos os perfis administrativos."
                defaultChecked
              />
              <SettingRow
                title="Alertas de novo acesso"
                description="Receba um e-mail sempre que houver um novo login."
                defaultChecked
              />
              <div className="pt-2">
                <Button variant="outline" size="sm">
                  <KeyRound className="h-4 w-4 mr-1.5" /> Alterar senha
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent-foreground">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold">Notificações</h4>
                <p className="text-sm text-muted-foreground">
                  Escolha como e quando quer ser avisado.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <SettingRow
                title="Novas atualizações de versão"
                description="E-mail sempre que houver uma nova release estável."
                defaultChecked
              />
              <SettingRow
                title="Novos artigos e manuais"
                description="Resumo semanal das novidades da base de conhecimento."
              />
              <SettingRow
                title="Comunicados oficiais"
                description="Avisos importantes da Prócion Sistemas."
                defaultChecked
              />
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function SettingRow({
  title,
  description,
  defaultChecked,
}: {
  title: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
