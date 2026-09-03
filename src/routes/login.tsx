import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, LockKeyhole, LogIn, Mail } from "lucide-react";
import { toast } from "sonner";
import { ProcionLogo } from "@/components/portal/ProcionLogo";
import { ThemeToggle } from "@/components/portal/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar | CRM Prócion" },
      { name: "description", content: "Acesse o CRM da Prócion Sistemas." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) void navigate({ to: "/", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Informe o e-mail e a senha.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Não foi possível entrar.", {
        description: "Confira o e-mail e a senha informados.",
      });
      return;
    }

    toast.success("Login realizado com sucesso.");
    await navigate({ to: "/", replace: true });
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-8 text-foreground">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="grid w-full max-w-[940px] overflow-hidden rounded-lg border border-border bg-card shadow-2xl shadow-black/10 lg:grid-cols-[.9fr_1.1fr] dark:shadow-black/35">
        <section className="relative hidden min-h-[590px] flex-col justify-between overflow-hidden bg-[#10182f] p-10 text-white lg:flex">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
          <ProcionLogo className="text-white" />

          <div className="relative max-w-sm">
            <p className="text-xs font-semibold uppercase text-cyan-300">Portal corporativo</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight">
              Atendimento, operação e relacionamento em um só lugar.
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Acesse suas rotinas do CRM Prócion com segurança.
            </p>
          </div>

          <p className="text-xs text-slate-400">Prócion Sistemas</p>
        </section>

        <section className="flex min-h-[590px] items-center px-6 py-10 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-9 lg:hidden">
              <ProcionLogo className="text-foreground" />
            </div>

            <div>
              <p className="text-sm font-medium text-primary">CRM Prócion</p>
              <h2 className="mt-1 text-2xl font-semibold">Bem-vindo</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Use suas credenciais para acessar o portal.
              </p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="login-email">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nome@procion.com"
                    className="h-11 rounded-lg pl-10"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Digite sua senha"
                    className="h-11 rounded-lg px-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="h-11 w-full gap-2 rounded-lg" disabled={submitting}>
                <LogIn className="h-4 w-4" />
                {submitting ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">
              O acesso é restrito aos usuários autorizados pela Prócion Sistemas.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
