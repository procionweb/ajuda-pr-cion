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

async function imageData(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function exportFleetHistoryPdf(vehicle: VehicleExportInfo, rows: FleetHistoryExportRow[], logoUrl?: string) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setFillColor(13, 31, 51);
  pdf.rect(0, 0, 297, 31, "F");
  pdf.setFillColor(7, 151, 196);
  pdf.rect(0, 29, 297, 2, "F");
  if (logoUrl) {
    try {
      pdf.addImage(await imageData(logoUrl), "PNG", 14, 5.5, 48, 17);
    } catch {
      // O relatório continua disponível mesmo se a imagem não puder ser carregada.
    }
  }
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Histórico de Frota", logoUrl ? 70 : 14, 13);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`${vehicle.model}  |  ${vehicle.plate}`, logoUrl ? 70 : 14, 21);
  pdf.text(`${rows.length} registro(s)  |  Emitido em ${new Date().toLocaleString("pt-BR")}`, 283, 21, { align: "right" });

  const categories = new Set(rows.map((row) => row.category)).size;
  pdf.setFillColor(244, 249, 251);
  pdf.roundedRect(14, 37, 82, 13, 2, 2, "F");
  pdf.roundedRect(103, 37, 82, 13, 2, 2, "F");
  pdf.roundedRect(192, 37, 91, 13, 2, 2, "F");
  pdf.setTextColor(91, 105, 119);
  pdf.setFontSize(8);
  pdf.text("REGISTROS", 19, 42);
  pdf.text("CATEGORIAS", 108, 42);
  pdf.text("PERÍODO DO RELATÓRIO", 197, 42);
  pdf.setTextColor(13, 31, 51);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(String(rows.length), 19, 47);
  pdf.text(String(categories), 108, 47);
  pdf.text(rows.length ? `${rows.at(-1)?.date} a ${rows[0]?.date}` : "Sem registros", 197, 47);

  autoTable(pdf, {
    startY: 56,
    head: [columns.map((column) => column.label)],
    body: rows.map((row) => columns.map((column) => row[column.key])),
    theme: "grid",
    margin: { left: 14, right: 14, bottom: 12 },
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2.4, textColor: [32, 42, 58], lineColor: [220, 226, 232], valign: "middle" },
    headStyles: { fillColor: [16, 36, 58], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 249, 251] },
    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 27 }, 2: { cellWidth: 48 }, 3: { cellWidth: 28 }, 4: { cellWidth: 25 }, 5: { cellWidth: 22 }, 6: { cellWidth: 80 } },
    didDrawPage: ({ pageNumber }) => {
      pdf.setDrawColor(220, 226, 232);
      pdf.line(14, 199, 283, 199);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 110, 122);
      pdf.text(`Portal Prócion  •  Página ${pageNumber}`, 283, 203, { align: "right" });
    },
  });
  pdf.save(filename(vehicle, "pdf"));
}
