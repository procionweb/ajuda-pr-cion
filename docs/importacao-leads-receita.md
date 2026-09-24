# Importação de leads da Receita Federal

O importador lê os arquivos mensais de Dados Abertos do CNPJ. Por padrão, grava
estabelecimentos ativos nos municípios em um raio de 80 km de São Carlos/SP.
Com `--statewide`, considera todos os municípios do estado de São Paulo.

## Arquivos necessários

Baixe da mesma competência os ZIPs de:

- `Estabelecimentos`
- `Empresas`
- `Municipios`
- `Cnaes`
- `Naturezas` (recomendado)
- `Simples` (recomendado)

Não extraia os ZIPs. Coloque todos em uma pasta local.

## Execução

Defina `DATABASE_URL` no ambiente sem registrar a credencial no repositório:

```powershell
$env:CNPJ_SOURCE_DIR="C:\Dados\CNPJ\2026-07"
npm run import:company-leads
```

Para validar os arquivos e contar os registros sem gravar:

```powershell
npm run import:company-leads -- --dry-run
```

Sem `CNPJ_SOURCE_DIR`, o importador consulta o espelho público da Casa dos Dados,
descobre automaticamente a competência mais recente e baixa os arquivos
necessários. Os downloads ficam em `.cache/cnpj` e são reaproveitados nas
execuções seguintes:

```powershell
npm run import:company-leads
```

Para fixar uma competência específica, defina `CNPJ_COMPETENCE` no formato
`AAAA-MM-DD`.

## Regras

- somente situação cadastral `02` (ativa);
- somente os 48 municípios configurados em `scripts/company-leads-cities.mjs`;
- junção pelo CNPJ básico entre Estabelecimentos, Empresas e Simples;
- upsert idempotente pelo CNPJ completo;
- clientes já existentes em `client_companies` são vinculados pelo CNPJ;
- a origem e a competência são preservadas no registro.

Para importar somente CNPJs ainda ausentes, em qualquer município de São Paulo,
a partir da última competência já importada:

```powershell
$env:CNPJ_COMPETENCE="2026-09-14"
$env:CNPJ_OPENED_FROM="2026-08-10"
npm run import:company-leads -- --statewide --insert-only --skip-partners
```

`CNPJ_OPENED_FROM` limita o volume por data de abertura; esta carga incremental
não cobre empresas mais antigas dos municípios antes fora do raio de São Carlos.

## Importação nacional

Para incluir todos os estabelecimentos ativos do Brasil, execute por UF. O processo
usa a competência mais recente, preserva os CNPJs já cadastrados, registra o
resultado de cada UF em `company_lead_sync_runs` e pode ser retomado após falha:

```powershell
npm run import:company-leads:brazil -- --states=AC,AP
```

Sem `--states`, percorre as 27 UFs. Use `CNPJ_COMPETENCE` para fixar a mesma
competência em todas as execuções. O comando precisa de `DATABASE_URL` em
`.env.local` e usa os arquivos ZIP no cache. A carga completa exige bastante
espaço no banco; confira a capacidade antes de executá-la em produção.
