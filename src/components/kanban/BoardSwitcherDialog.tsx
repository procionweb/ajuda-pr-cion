import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutGrid, Search, Star } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listKanbanBoards, type BoardSummary } from "@/lib/kanban-api";

export function BoardSwitcherDialog({
  open,
  onOpenChange,
  currentBoardId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBoardId: string | null;
}) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(false);
    void listKanbanBoards()
      .then(({ boards }) => {
        if (active) setBoards(boards);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const visibleBoards = useMemo(
    () =>
      boards.filter(
        (board) =>
          (!favoritesOnly || board.isFavorite) &&
          board.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")),
      ),
    [boards, favoritesOnly, query],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(78vh,620px)] w-[min(94vw,620px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[620px]">
        <div className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <LayoutGrid className="h-4 w-4 text-primary" /> Mudar de quadro
          </DialogTitle>
        </div>
        <div className="flex flex-wrap gap-2 px-5 pt-4">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar seus quadros"
              className="pl-9"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={() => setFavoritesOnly((value) => !value)}
            aria-pressed={favoritesOnly}
            className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm ${favoritesOnly ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Star className="h-4 w-4" /> Favoritos
          </button>
        </div>
        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando quadros...</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">
              Não foi possível carregar os quadros.
            </p>
          ) : visibleBoards.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum quadro encontrado.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {visibleBoards.map((board) => (
                <Link
                  key={board.id}
                  to="/kanban/$boardId"
                  params={{ boardId: board.id }}
                  onClick={() => onOpenChange(false)}
                  className={`flex min-w-0 items-center gap-3 rounded-md border p-3 transition hover:border-primary/50 hover:bg-muted/50 ${board.id === currentBoardId ? "border-primary/60 bg-primary/5" : ""}`}
                >
                  <span
                    className="h-10 w-2 shrink-0 rounded-sm"
                    style={{
                      backgroundColor: board.color?.startsWith("#") ? board.color : "#0284c7",
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{board.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {board.cardsCount} cartões{board.id === currentBoardId ? " · Atual" : ""}
                    </span>
                  </span>
                  {board.isFavorite && (
                    <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
