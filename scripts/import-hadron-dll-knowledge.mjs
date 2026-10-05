#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const input = process.argv[2] ?? 'I:\\HADEXE20\\PHAD1232.dll'
const output = process.argv[3] ?? path.resolve('work/hadron-knowledge-import.json')

const inputFiles = fs.existsSync(input) && fs.statSync(input).isDirectory()
  ? fs.readdirSync(input).filter((name) => /^PHAD\d+\.dll$/i.test(name)).map((name) => path.join(input, name))
  : [input]

if (inputFiles.length === 0 || inputFiles.some((file) => !fs.existsSync(file))) {
  throw new Error(`Nenhuma DLL PHAD encontrada em: ${input}`)
}

function extract(file) {
  const buffer = fs.readFileSync(file)
  const ascii = buffer.toString('latin1')
  const strings = []
  for (let offset = 0; offset < ascii.length && strings.length < 25000; offset += 1024 * 1024) {
    const chunk = ascii.slice(offset, offset + 1024 * 1024)
    const matches = chunk.match(/[ -~À-ÿ]{5,}/g) ?? []
    for (const raw of matches) {
      const value = raw.replace(/\s+/g, ' ').trim()
      if (value.length >= 5) strings.push(value)
      if (strings.length >= 25000) break
    }
  }

  const uniqueStrings = [...new Set(strings)]
  const optionMatch = path.basename(file).match(/PHAD(\d+)\.dll/i)
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

  return {
    option_number: optionNumber,
    option_name: optionNumber === '1232' ? 'Cadastro de Produtos' : null,
    module: optionNumber === '1232' ? 'Produtos' : null,
    source_file: path.basename(file),
    source_path: file,
    source_size: buffer.length,
    extracted_at: new Date().toISOString(),
    review_status: 'pending',
    extraction_method: 'printable-strings-read-only',
    fields: fieldStrings,
    procedures: procedureStrings,
    errors: errorStrings,
    strings: uniqueStrings,
  }
}

fs.mkdirSync(path.dirname(output), { recursive: true })
const records = inputFiles.map(extract)
const result = { generated_at: new Date().toISOString(), source: input, records }
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
console.log(`Importadas ${records.length} DLLs -> ${output}`)
console.log(`opções=${records.filter((record) => record.option_number).length} strings=${records.reduce((sum, record) => sum + record.strings.length, 0)}`)
