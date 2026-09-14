import serialExport from "@/data/numeros_serie.json";

export const hadronSerials = serialExport.find((entry) => entry.type === "table")!.data!
  .sort((a,b) => Number(a.id)-Number(b.id));
