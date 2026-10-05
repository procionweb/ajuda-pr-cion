#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const input = process.argv[2] ?? 'I:\\HADEXE20\\PHAD1232.dll'
const output = process.argv[3] ?? path.resolve('work/hadron-knowledge-import.json')

if (!fs.existsSync(input)) {
  throw new Error(`DLL não encontrada: ${input}`)
}

const buffer = fs.readFileSync(input)
const ascii = buffer.toString('latin1')
const strings = [...ascii.matchAll(/[ -~À-ÿ]{5,}/g)]
  .map((match) => match[0].replace(/\s+/g, ' ').trim())
  .filter((value) => value.length >= 5)

const uniqueStrings = [...new Set(strings)]
const optionMatch = path.basename(input).match(/PHAD(\d+)\.dll/i)
const optionNumber = optionMatch?.[1] ?? null
const fieldStrings = uniqueStrings.filter((value) =>
  /produto|código|codigo|descri|unidade|preço|preco|estoque|tribut|alíquota|aliquota|fornecedor|marca|embalagem|fórmula|formula|tabela|serviço|servico|promoção|promocao|imagem|garantia|vínculo|vinculo/i.test(value),
)
const procedureStrings = uniqueStrings.filter((value) =>
  /Incluir|Alterar|Consultar|Excluir|Confirma|Cancela|Visualiza|Manuten/i.test(value),
)
const errorStrings = uniqueStrings.filter((value) =>
  /erro|incorreta|inexistente|não pôde|nao pode|função incorreta|funcao incorreta|deve ser/i.test(value),
)

const result = {
  option_number: optionNumber,
  option_name: optionNumber === '1232' ? 'Cadastro de Produtos' : null,
  module: optionNumber === '1232' ? 'Produtos' : null,
  source_file: path.basename(input),
  source_path: input,
  source_size: buffer.length,
  extracted_at: new Date().toISOString(),
  review_status: 'pending',
  extraction_method: 'printable-strings-read-only',
  fields: fieldStrings,
  procedures: procedureStrings,
  errors: errorStrings,
  strings: uniqueStrings,
}

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
console.log(`Importado ${input} -> ${output}`)
console.log(`opção=${optionNumber ?? 'desconhecida'} strings=${uniqueStrings.length} campos=${fieldStrings.length}`)
