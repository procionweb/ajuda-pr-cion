import { useEffect, useState } from "react";
import { Save, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateVehicle,
  deleteVehicle,
  normalizeVehiclePlate,
  type Vehicle,
} from "@/lib/fleet-store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VehicleEditorModal({ vehicle, open, onOpenChange }: Props) {
  const [draft, setDraft] = useState<Vehicle | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (vehicle && open) {
      setDraft({ ...vehicle });
    }
  }, [vehicle, open]);

  if (!draft || !vehicle) return null;

  const change = (field: keyof Vehicle, value: any) =>
    setDraft((current) => (current ? { ...current, [field]: value } : current));

  const handleSave = () => {
    if (!draft.plate) {
      toast.error("A placa é obrigatória.");
      return;
    }

    const normalizedPlate = normalizeVehiclePlate(draft.plate);
    if (normalizedPlate.replace(/[^A-Z0-9]/g, "").length < 7) {
      toast.error("Informe uma placa válida.");
      return;
    }

    updateVehicle(vehicle.id, {
      ...draft,
      plate: normalizedPlate,
    });

    toast.success("Dados do veículo atualizados com sucesso.");
    onOpenChange(false);
  };

  const handleDelete = () => {
    const result = deleteVehicle(vehicle.id);
    if (result.success) {
      toast.success("Veículo excluído com sucesso.");
      onOpenChange(false);
      // Opcional: redirecionar para listagem se estiver na página do veículo
      if (window.location.pathname.includes(`/frota/${vehicle.id}`)) {
        window.location.href = "/frota";
      }
    } else {
      toast.error(result.message || "Erro ao excluir veículo.");
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden p-0 shadow-lg border-border [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer">
          <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Editar veículo
                </span>
                <span className="text-lg font-semibold">
                  {draft.model || draft.brand || "Novo Veículo"}
                </span>
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6 modal-scrollbar space-y-8">
            {/* Seção: Status e Identificação Básica */}
            <section>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Status e Identificação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Field label="Status">
                  <Select value={draft.status} onValueChange={(v) => change("status", v)}>
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disponivel">Ativo</SelectItem>
                      <SelectItem value="inativo" disabled={draft.status === "em_uso"}>
                        Inativo
                      </SelectItem>
                      <SelectItem value="manutencao" disabled={draft.status === "em_uso"}>
                        Em Manutenção
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tipo de veículo">
                  <Input
                    value={draft.type || ""}
                    onChange={(e) => change("type", e.target.value)}
                    placeholder="Ex: Hatch, SUV, Caminhão"
                    className="h-10"
                  />
                </Field>
                <Field label="Categoria">
                  <Input
                    value={draft.category || ""}
                    onChange={(e) => change("category", e.target.value)}
                    placeholder="Ex: Utilitário"
                    className="h-10"
                  />
                </Field>
                <Field label="Marca">
                  <Input
                    value={draft.brand || ""}
                    onChange={(e) => change("brand", e.target.value)}
                    placeholder="Ex: Volkswagen"
                    className="h-10"
                  />
                </Field>
                <Field label="Modelo">
                  <Input
                    value={draft.model || ""}
                    onChange={(e) => change("model", e.target.value)}
                    placeholder="Ex: Gol G4"
                    className="h-10"
                  />
                </Field>
                <Field label="Nome / Apelido">
                  <Input
                    value={draft.nickname || ""}
                    onChange={(e) => change("nickname", e.target.value)}
                    placeholder="Ex: Carro 01"
                    className="h-10"
                  />
                </Field>
              </div>
            </section>

            {/* Seção: Características Técnicas */}
            <section>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Características Técnicas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Field label="Ano Fabricação">
                  <Input
                    value={draft.year || ""}
                    onChange={(e) => change("year", e.target.value)}
                    placeholder="Ex: 2022"
                    className="h-10"
                  />
                </Field>
                <Field label="Ano Modelo">
                  <Input
                    value={draft.yearModel || ""}
                    onChange={(e) => change("yearModel", e.target.value)}
                    placeholder="Ex: 2023"
                    className="h-10"
                  />
                </Field>
                <Field label="Cor">
                  <Input
                    value={draft.color || ""}
                    onChange={(e) => change("color", e.target.value)}
                    className="h-10"
                  />
                </Field>
                <Field label="Potência">
                  <Input
                    value={draft.power || ""}
                    onChange={(e) => change("power", e.target.value)}
                    placeholder="Ex: 100cv"
                    className="h-10"
                  />
                </Field>
                <Field label="Capacidade Passageiros">
                  <Input
                    type="number"
                    value={draft.passengerCapacity || ""}
                    onChange={(e) => change("passengerCapacity", Number(e.target.value))}
                    className="h-10"
                  />
                </Field>
                <Field label="Combustível">
                  <Select value={draft.fuelType || ""} onValueChange={(v) => change("fuelType", v)}>
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flex">Flex</SelectItem>
                      <SelectItem value="gasolina">Gasolina</SelectItem>
                      <SelectItem value="etanol">Etanol</SelectItem>
                      <SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="eletrico">Elétrico</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Unidade de Medição">
                  <Select
                    value={draft.measurementUnit || "km"}
                    onValueChange={(v) => change("measurementUnit", v)}
                  >
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="km">Quilômetros (km)</SelectItem>
                      <SelectItem value="mi">Milhas (mi)</SelectItem>
                      <SelectItem value="h">Horas (h)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Capacidade Tanque (L)">
                  <Input
                    type="number"
                    value={draft.tankCapacity || ""}
                    onChange={(e) => change("tankCapacity", Number(e.target.value))}
                    className="h-10"
                  />
                </Field>
                <div className="flex items-center space-x-2 pt-8">
                  <Switch
                    id="two-tanks"
                    checked={draft.hasSecondTank || false}
                    onCheckedChange={(checked) => change("hasSecondTank", checked)}
                  />
                  <Label htmlFor="two-tanks">Dois tanques</Label>
                </div>
                {draft.hasSecondTank && (
                  <Field label="Capacidade 2º Tanque (L)">
                    <Input
                      type="number"
                      value={draft.secondTankCapacity || ""}
                      onChange={(e) => change("secondTankCapacity", Number(e.target.value))}
                      className="h-10"
                    />
                  </Field>
                )}
              </div>
            </section>

            {/* Seção: Documentação e Registro */}
            <section>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Documentação e Registro
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Field label="Placa">
                  <Input
                    value={draft.plate || ""}
                    onChange={(e) => change("plate", e.target.value.toUpperCase())}
                    placeholder="AAA-0000"
                    className="h-10 uppercase font-mono"
                  />
                </Field>
                <Field label="Renavam">
                  <Input
                    value={draft.renavam || ""}
                    onChange={(e) => change("renavam", e.target.value.replace(/\D/g, ""))}
                    maxLength={11}
                    className="h-10 font-mono"
                  />
                </Field>
                <Field label="Chassi">
                  <Input
                    value={draft.chassis || ""}
                    onChange={(e) => change("chassis", e.target.value.toUpperCase())}
                    className="h-10 font-mono uppercase"
                  />
                </Field>
                <Field label="KM Atual">
                  <Input
                    type="text"
                    value={draft.currentMileage?.toLocaleString("pt-BR") || "0"}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      change("currentMileage", Number(val));
                    }}
                    className="h-10 tabular-nums"
                  />
                </Field>
              </div>
            </section>

            <section>
              <Field label="Observações">
                <Textarea
                  value={draft.observations || ""}
                  onChange={(e) => change("observations", e.target.value)}
                  placeholder="Informações adicionais sobre o veículo..."
                  className="min-h-[100px] resize-none"
                  spellCheck={true}
                  lang="pt-BR"
                />
              </Field>
            </section>
          </div>

          <DialogFooter className="flex flex-row items-center justify-between gap-3 border-t border-border px-6 py-4 bg-muted/20 shrink-0">
            <Button
              variant="ghost"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors gap-2"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Excluir veículo
            </Button>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 px-6 border-border hover:bg-muted"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="h-10 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-2"
              >
                <Save className="h-4 w-4" />
                Salvar alterações
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja excluir o veículo <strong>{vehicle.model}</strong> (
              {vehicle.plate})? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide ml-0.5">
        {label}
      </Label>
      {children}
    </div>
  );
}
