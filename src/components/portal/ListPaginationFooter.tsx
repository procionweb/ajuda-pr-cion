import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

function pageRange(page: number, pageCount: number): Array<number | "…"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index);
  const values = new Set([0, 1, page - 1, page, page + 1, pageCount - 2, pageCount - 1]);
  const sorted = [...values].filter((value) => value >= 0 && value < pageCount).sort((a, b) => a - b);
  const result: Array<number | "…"> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push("…");
    result.push(value);
  });
  return result;
}

function PageButton({
  children,
  active,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-md border px-2 text-[11.5px] font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background text-foreground hover:bg-muted",
        disabled && "cursor-not-allowed opacity-40 hover:bg-background",
      )}
    >
      {children}
    </button>
  );
}

export function ListPaginationFooter({
  page,
  pageCount,
  pageSize,
  total,
  noun,
  onPageChange,
  loading = false,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  noun: string;
  onPageChange: (page: number) => void;
  loading?: boolean;
}) {
  const safePageCount = Math.max(1, pageCount);
  const safePage = Math.min(Math.max(0, page), safePageCount - 1);
  const start = total ? safePage * pageSize + 1 : 0;
  const end = Math.min((safePage + 1) * pageSize, total);
  const pages = pageRange(safePage, safePageCount);
  const mobilePages = [...new Set([safePage - 1, safePage, safePage + 1])].filter(
    (value) => value >= 0 && value < safePageCount,
  );

  return (
    <footer className="flex flex-col items-stretch gap-3 rounded-lg border border-border/60 bg-card px-3 py-3 text-[12px] text-muted-foreground shadow-[0_6px_16px_rgba(25,29,51,0.04)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:rounded-2xl sm:px-4">
      <span>
        Mostrando <strong className="text-foreground">{start}</strong> a{" "}
        <strong className="text-foreground">{end}</strong> de{" "}
        <strong className="text-foreground">{total}</strong> {noun}
      </span>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <span className="inline-flex items-center gap-2">
          Itens por página
          <span className="inline-flex h-7 min-w-11 items-center justify-center rounded-md border border-border bg-background px-2 text-foreground">
            {pageSize}
          </span>
        </span>
        <div className="flex max-w-full items-center justify-between gap-1 sm:hidden">
          <PageButton label="Página anterior" disabled={safePage === 0 || loading} onClick={() => onPageChange(safePage - 1)}><ChevronLeft className="h-3.5 w-3.5" /></PageButton>
          <div className="flex items-center gap-1">
            {mobilePages.map((value) => (
              <PageButton key={value} active={value === safePage} disabled={loading} onClick={() => onPageChange(value)}>{value + 1}</PageButton>
            ))}
          </div>
          <PageButton label="Próxima página" disabled={safePage + 1 >= safePageCount || loading} onClick={() => onPageChange(safePage + 1)}><ChevronRight className="h-3.5 w-3.5" /></PageButton>
        </div>
        <div className="hide-scrollbar hidden max-w-full items-center gap-1 overflow-x-auto pb-0.5 sm:flex">
          <PageButton label="Primeira página" disabled={safePage === 0 || loading} onClick={() => onPageChange(0)}><ChevronsLeft className="h-3.5 w-3.5" /></PageButton>
          <PageButton label="Página anterior" disabled={safePage === 0 || loading} onClick={() => onPageChange(safePage - 1)}><ChevronLeft className="h-3.5 w-3.5" /></PageButton>
          {pages.map((value, index) =>
            value === "…" ? (
              <span key={`ellipsis-${index}`} className="px-1">…</span>
            ) : (
              <PageButton key={value} active={value === safePage} disabled={loading} onClick={() => onPageChange(value)}>{value + 1}</PageButton>
            ),
          )}
          <PageButton label="Próxima página" disabled={safePage + 1 >= safePageCount || loading} onClick={() => onPageChange(safePage + 1)}><ChevronRight className="h-3.5 w-3.5" /></PageButton>
          <PageButton label="Última página" disabled={safePage + 1 >= safePageCount || loading} onClick={() => onPageChange(safePageCount - 1)}><ChevronsRight className="h-3.5 w-3.5" /></PageButton>
        </div>
      </div>
    </footer>
  );
}
