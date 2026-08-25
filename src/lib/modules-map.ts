export const modulesMap: Record<string, string[]> = {
  "RESUMO DA VERSÃO": ["GERAL", "NOVIDADES DA VERSÃO"],
  BASICO: ["CADASTROS BÁSICOS", "EMPRESAS", "USUÁRIOS", "PRODUTOS", "TERCEIROS", "PARÂMETROS"],
  VENDAS: ["FATURAMENTO", "FRENTE DE LOJAS", "NFE", "PEDIDOS", "ORÇAMENTOS", "DEVOLUÇÕES"],
  COMPRAS: ["PEDIDOS DE COMPRA", "ENTRADAS", "FORNECEDORES", "COTAÇÕES"],
  FINANCEIRO: ["CONTAS A PAGAR", "CONTAS A RECEBER", "FLUXO DE CAIXA", "CONCILIAÇÃO"],
  "CONTROLE DE ESTOQUES": ["MOVIMENTAÇÃO", "INVENTÁRIO", "TRANSFERÊNCIA", "PLANEJAMENTO"],
  FISCAL: ["APURAÇÃO", "SPED", "ECF", "ICMS", "LIVROS FISCAIS"],
  CONTÁBIL: ["CONTABILIDADE", "ATIVO IMOBILIZADO", "INTEGRAÇÕES"],
  PRODUÇÃO: ["ORDENS DE PRODUÇÃO", "PLANEJAMENTO", "APONTAMENTOS"],
  "RECURSOS HUMANOS": ["FOLHA DE PAGAMENTO", "FUNCIONÁRIOS", "PONTO"],
  TRANSPORTES: ["FROTA", "CT-E", "MDF-E", "ENTREGAS"],
  COMBUSTÍVEIS: ["ABASTECIMENTOS", "BOMBAS", "TANQUES"],
  "GESTÃO RURAL": ["BOVINOS", "SAFRAS", "CUSTOS RURAIS"],
  "OUTROS MÓDULOS": ["HÁDRON WEB", "MOBILE", "INTEGRAÇÕES", "IMPRESSORAS", "RELATÓRIOS"],
};

export const moduleOptions = Object.keys(modulesMap);

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

/** Resolve module/submodule from a "Modulo - Submodulo" string. */
export function splitModule(text: string): { module: string; submodule: string } {
  const [rawMod, ...rest] = (text || "").split(" - ");
  const mod =
    moduleOptions.find((item) => normalize(item) === normalize(rawMod)) ?? moduleOptions[0];
  const subs = modulesMap[mod] ?? [];
  const rawSub = rest.join(" - ").trim();
  const submodule =
    subs.find((item) => normalize(item) === normalize(rawSub)) ?? subs[0] ?? "GERAL";
  return { module: mod, submodule };
}
