import { createFileRoute } from "@tanstack/react-router";
import { CompanyLeadsTab } from "@/components/clients/CompanyLeadsTab";
import { AppShell, PageHeader } from "@/components/portal/AppShell";

export const Route = createFileRoute("/comercial/prospeccao")({
  component: CommercialProspectingPage,
});

function CommercialProspectingPage() {
  return (
    <AppShell fullWidth>
      <PageHeader
        title="Prospecção"
        description="Pesquisa e qualificação de novas oportunidades comerciais."
        breadcrumbs={[{ label: "Comercial" }, { label: "Prospecção" }]}
      />
      <CompanyLeadsTab />
    </AppShell>
  );
}
