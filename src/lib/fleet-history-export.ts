import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type FleetHistoryExportRow = {
  date: string;
  category: string;
  title: string;
  operator: string;
  mileage: string;
  amount: string;
  details: string;
};

type VehicleExportInfo = { model: string; plate: string };

const columns: Array<{ key: keyof FleetHistoryExportRow; label: string }> = [
  { key: "date", label: "Data" },
  { key: "category", label: "Categoria" },
  { key: "title", label: "Descrição" },
  { key: "operator", label: "Operador" },
  { key: "mileage", label: "Quilometragem" },
  { key: "amount", label: "Valor" },
  { key: "details", label: "Detalhes" },
];

function filename(vehicle: VehicleExportInfo, extension: string) {
  return `historico-${vehicle.plate.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.${extension}`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportFleetHistoryCsv(vehicle: VehicleExportInfo, rows: FleetHistoryExportRow[]) {
  const csv = [columns.map((column) => column.label), ...rows.map((row) => columns.map((column) => row[column.key]))]
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  download(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), filename(vehicle, "csv"));
}

export function exportFleetHistoryXlsx(vehicle: VehicleExportInfo, rows: FleetHistoryExportRow[]) {
  const data = rows.map((row) => Object.fromEntries(columns.map((column) => [column.label, row[column.key]])));
  const sheet = XLSX.utils.json_to_sheet(data, { header: columns.map((column) => column.label) });
  sheet["!cols"] = [{ wch: 18 }, { wch: 18 }, { wch: 34 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 48 }];
  sheet["!autofilter"] = { ref: sheet["!ref"] || "A1:G1" };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Histórico");
  XLSX.writeFile(workbook, filename(vehicle, "xlsx"));
}

export function exportFleetHistoryPdf(vehicle: VehicleExportInfo, rows: FleetHistoryExportRow[]) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setFillColor(7, 151, 196);
  pdf.rect(0, 0, 297, 30, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Histórico de Frota", 14, 13);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`${vehicle.model}  |  ${vehicle.plate}`, 14, 21);
  pdf.text(`${rows.length} registro(s)  |  Emitido em ${new Date().toLocaleString("pt-BR")}`, 283, 21, { align: "right" });

  autoTable(pdf, {
    startY: 37,
    head: [columns.map((column) => column.label)],
    body: rows.map((row) => columns.map((column) => row[column.key])),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2.2, textColor: [32, 42, 58], lineColor: [220, 226, 232] },
    headStyles: { fillColor: [16, 36, 58], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 249, 251] },
    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 27 }, 2: { cellWidth: 48 }, 3: { cellWidth: 28 }, 4: { cellWidth: 25 }, 5: { cellWidth: 22 }, 6: { cellWidth: 80 } },
    didDrawPage: ({ pageNumber }) => {
      pdf.setFontSize(8);
      pdf.setTextColor(100, 110, 122);
      pdf.text(`Portal Prócion  •  Página ${pageNumber}`, 283, 203, { align: "right" });
    },
  });
  pdf.save(filename(vehicle, "pdf"));
}
