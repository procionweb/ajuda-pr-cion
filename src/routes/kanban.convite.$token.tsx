import { disconnectBackgroundPush } from "@/lib/background-push";
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { acceptBoardInvite, getBoardInviteInfo, type BoardInviteInfo } from "@/lib/kanban-api";
import { usePortalAuth } from "@/lib/portal-auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/kanban/convite/$token")({
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { session } = usePortalAuth();
  const [info, setInfo] = useState<BoardInviteInfo | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setInfo(null);
    setFailed(false);
    void getBoardInviteInfo(token).then((result) => {
      if (!active) return;
      setInfo(result);
      if (session && result.recipientMatches && !result.expired && ["pending", "accepted"].includes(result.status)) {
        void acceptBoardInvite(token).then(({ boardId }) => {
          if (active) setBoardId(boardId);
        }).catch(() => {
          if (active) setFailed(true);
        });
      }
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [token, session?.user.id]);

  const goToLogin = async () => {
    sessionStorage.setItem("post_login_redirect", `/kanban/convite/${token}`);
    if (session) {
      await disconnectBackgroundPush().catch(() => {});
      await supabase.auth.signOut();
    }
    await navigate({ to: "/login", replace: true });
  };

  return <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
    <h1 className="text-xl font-semibold">Convite para o quadro</h1>
    {boardId ? <>
      <p>Convite aceito. Você já pode acessar o quadro.</p>
      <Link className="rounded-md bg-primary px-4 py-2 text-primary-foreground" to="/kanban/$boardId" params={{ boardId }}>Abrir quadro</Link>
    </> : !info && !failed ? <p>Carregando convite...</p> : !info || info.expired || !["pending", "accepted"].includes(info.status) ? <>
      <p>Este convite não está mais disponível. Peça um novo link ao responsável pelo quadro.</p>
      <Link className="text-primary underline" to="/kanban">Voltar aos quadros</Link>
    </> : <>
      <p>Você foi convidado para <strong>{info.boardName}</strong>.</p>
      {info.recipient && <p className="text-sm text-muted-foreground">Enviado para {info.recipient}</p>}
      {!info.accountExists && <p>Este endereço ainda não tem uma conta no CRM. Peça ao responsável para criar seu acesso com o mesmo email do convite.</p>}
      {session && !info.recipientMatches && <p>Você está conectado como {info.signedInEmail}. Entre com a conta que recebeu o convite.</p>}
      {!session && <p>Entre com o email que recebeu o convite para aceitá-lo.</p>}
      {failed && <p>Não foi possível concluir o aceite. Tente novamente ou solicite um novo convite.</p>}
      {session && info.recipientMatches && !failed ? <p>Confirmando seu convite...</p> :
        <button type="button" className="rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={() => void goToLogin()}>
          {session ? "Entrar com outra conta" : "Entrar no CRM"}
        </button>}
    </>}
  </main>;
}
