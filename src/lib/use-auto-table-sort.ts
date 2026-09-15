import { useEffect, type RefObject } from "react";

const UNSORTABLE_LABELS = new Set(["", "ações", "acao", "ação", "selecionar"]);

function normalizedText(cell: HTMLTableCellElement | undefined) {
  return (cell?.textContent || "").trim().replace(/\s+/g, " ");
}

function comparable(value: string) {
  const date = value.match(/^(\d{2})\/(\d{2})\/(\d{2,4})(?:[, ]+\s*(\d{2}):(\d{2}))?/);
  if (date) {
    const year = Number(date[3].length === 2 ? `20${date[3]}` : date[3]);
    return Date.UTC(
      year,
      Number(date[2]) - 1,
      Number(date[1]),
      Number(date[4] || 0),
      Number(date[5] || 0),
    );
  }
  const numeric = value
    .replace(/\./g, "")
    .replace(",", ".")
    .match(/^-?\d+(?:\.\d+)?$/);
  return numeric ? Number(numeric[0]) : value.toLocaleLowerCase("pt-BR");
}

export function useAutoTableSort(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prepare = () => {
      root.querySelectorAll<HTMLTableElement>("table:not([data-no-auto-sort])").forEach((table) => {
        table.querySelectorAll<HTMLTableCellElement>("thead th").forEach((header) => {
          const label = normalizedText(header).toLocaleLowerCase("pt-BR");
          if (
            header.colSpan > 1 ||
            UNSORTABLE_LABELS.has(label) ||
            header.querySelector("button, a, input, select")
          )
            return;
          header.dataset.autoSortable = "true";
          header.tabIndex = 0;
          header.title = header.title || "Clique para ordenar";
        });
      });
    };

    const sort = (header: HTMLTableCellElement) => {
      const table = header.closest("table");
      const body = table?.tBodies[0];
      if (!table || !body) return;
      const headers = Array.from(header.parentElement?.children || []);
      const column = headers.indexOf(header);
      if (column < 0) return;
      const nextDirection =
        header.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
      table
        .querySelectorAll<HTMLTableCellElement>("thead th[aria-sort]")
        .forEach((item) => item.removeAttribute("aria-sort"));
      header.setAttribute("aria-sort", nextDirection);
      const direction = nextDirection === "ascending" ? 1 : -1;
      const rows = Array.from(body.rows).filter((row) => row.cells.length > column);
      rows
        .sort((a, b) => {
          const left = comparable(normalizedText(a.cells[column]));
          const right = comparable(normalizedText(b.cells[column]));
          if (typeof left === "number" && typeof right === "number")
            return (left - right) * direction;
          return String(left).localeCompare(String(right), "pt-BR", { numeric: true }) * direction;
        })
        .forEach((row) => body.appendChild(row));
    };

    const activate = (target: EventTarget | null) => {
      const header =
        target instanceof Element
          ? target.closest<HTMLTableCellElement>("th[data-auto-sortable]")
          : null;
      if (header && root.contains(header)) sort(header);
    };
    const onClick = (event: MouseEvent) => activate(event.target);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const header =
        event.target instanceof Element ? event.target.closest("th[data-auto-sortable]") : null;
      if (!header) return;
      event.preventDefault();
      activate(header);
    };
    prepare();
    const observer = new MutationObserver(prepare);
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeyDown);
    };
  }, [rootRef]);
}
