import fs from 'node:fs'

const s = fs.readFileSync(new URL('../src/app/crm/clients/page.tsx', import.meta.url), 'utf8')
const i = s.indexOf('<h1')
console.log(JSON.stringify(s.slice(i, i + 200)))
