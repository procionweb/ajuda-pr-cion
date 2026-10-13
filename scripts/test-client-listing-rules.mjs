import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
function exportsOf(file){const exports={};vm.runInNewContext(ts.transpile(fs.readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS,esModuleInterop:true}),{exports,require:(name)=>JSON.parse(fs.readFileSync(name.replace('@/','src/'),'utf8'))});return exports;}
const rules=exportsOf('src/lib/client-listing-rules.ts');const versions=exportsOf('src/lib/erp-versions.ts');
const f={razaoSocial:'',fantasia:'',porte:'',ramo:'',cep:'',cidade:'',uf:'',cnpj:''};
const company={id:'fixture',legal_name:'Empresa Filial',trade_name:'Filial',document:'12.345.678/0002-90',industry:'0',size:'P',city:'São Carlos',state:'SP',postal_code:'13560-000',company_number:2,active:true,modules:'{"1":"","7":""}',billing:'["Registrado"]'};
assert.equal(rules.clientStatusLabel('9','Ativo'),'Bloqueado');
assert.equal(rules.industryLabel('0'),'Ramo não preenchido');assert.equal(rules.matchesCompany(company,{...f,cnpj:'000290',ramo:'Ramo não preenchido',cidade:'sao carlos',companyModules:['1'],hasBoletos:'yes',billing:'registrado'}),true);
assert.equal(rules.matchesCompany(company,{...f,companyModules:['99']}),false);assert.equal(rules.matchesCompany(company,{...f,hasBoletos:'no'}),false);
assert.equal(rules.hasBilling('[]'),false);assert.equal(rules.hasBilling('{}'),false);assert.equal(rules.hasBilling(null),false);
const companies=[company,{...company,document:'99999999000199',modules:'{"99":""}'}];assert.equal(companies.some(c=>rules.matchesCompany(c,{...f,cnpj:'000290',companyModules:['99']})),false);
assert.equal(rules.matchesPeriod('2026-10-13 10:00:00',{start:'2026-10-13',end:'2026-10-13'}),true);assert.equal(rules.matchesPeriod('',{start:'2026-10-13'}),false);assert.equal(rules.matchesPeriod('12/10/2026',{start:'2026-10-13'}),false);
assert.equal(versions.latestErpAlterationDate,'2026-04-01');assert.equal(versions.isErpVersionOutdated('31/03/2026'),true);assert.equal(versions.isErpVersionOutdated('01/04/2026'),false);assert.equal(versions.isErpVersionOutdated('29/09/2026'),false);
assert.equal(versions.getClientErpVersionStatus('1.9','27/07/2025').isLegacy,true);assert.equal(versions.getClientErpVersionStatus('','28/07/2025').isLegacy,false);
console.log('Regras de versão, períodos, ramo zero, boletos, módulos e filtros na mesma empresa passaram.');
