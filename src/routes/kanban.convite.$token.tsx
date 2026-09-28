import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { acceptBoardInvite } from "@/lib/kanban-api";

export const Route = createFileRoute("/kanban/convite/$token")({
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void acceptBoardInvite(token).then(({ boardId }) => {
      if (active) setBoardId(boardId);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [token]);

  return <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
    <h1 className="text-xl font-semibold">Convite para o quadro</h1>
    {boardId ? <>
      <p>Convite aceito. Você já pode acessar o quadro.</p>
      <Link className="rounded-md bg-primary px-4 py-2 text-primary-foreground" to="/kanban/$boardId" params={{ boardId }}>Abrir quadro</Link>
    </> : failed ? <>
      <p>Não foi possível aceitar este convite. Ele pode ter expirado, já ter sido usado ou pertencer a outra conta de email.</p>
      <Link className="text-primary underline" to="/kanban">Voltar aos quadros</Link>
    </> : <p>Confirmando seu convite...</p>}
  </main>;
}
