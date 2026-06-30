import fs from 'fs'
import path from 'path'

const transcript = process.argv[2]
const outDir = process.argv[3] || 'recovered'
const names = process.argv.slice(4)
if (!transcript) {
  console.error('Usage: node extract-transcript-writes.mjs <jsonl> [outDir] <filename-hints...>')
  process.exit(1)
}

fs.mkdirSync(outDir, { recursive: true })

let found = 0
for (const line of fs.readFileSync(transcript, 'utf8').split('\n')) {
  if (!line.includes('"Write"')) continue
  let j
  try {
    j = JSON.parse(line)
  } catch {
    continue
  }
  const writes = j.message?.content?.filter((c) => c.type === 'tool_use' && c.name === 'Write') ?? []
  for (const w of writes) {
    const p = w.input?.path?.replace(/\\/g, '/')
    const contents = w.input?.contents
    if (!p || typeof contents !== 'string') continue
    const base = path.basename(p)
    const match =
      names.length === 0 || names.some((n) => p.includes(n) || base.includes(n))
    if (!match) continue
    const dest = path.join(outDir, base)
    fs.writeFileSync(dest, contents)
    console.log('wrote', dest, contents.length)
    found++
  }
}
console.log('total', found)
