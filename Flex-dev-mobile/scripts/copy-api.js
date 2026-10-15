const fs = require('fs')
const path = require('path')

const srcRoot = path.join(__dirname, '..', '..', 'Flex-dev-web-trainer', 'supabase')
const destRoot = path.join(__dirname, '..', 'src', 'api')

const skipNames = new Set([
  'supabaseAdmin.ts',
  'supabaseClient.ts',
  'link-person-auth.ts',
  'person-login.ts',
])

const skipDirs = new Set(['scripts', 'cron', 'server'])

function rewrite(content) {
  return content
    .replaceAll("@/supabase/supabaseClient", "@/src/api/supabase")
    .replaceAll("'@/supabase/supabaseClient'", "'@/src/api/supabase'")
    .replaceAll("@/supabase/", "@/src/api/")
    .replaceAll("from '../supabaseClient'", "from '../supabase'")
    .replaceAll('from "../supabaseClient"', 'from "../supabase"')
    .replaceAll("from '../../supabaseClient'", "from '../../supabase'")
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (skipNames.has(entry.name) || skipDirs.has(entry.name)) continue
    const src = path.join(from, entry.name)
    const dest = path.join(to, entry.name)
    if (entry.isDirectory()) {
      copyDir(src, dest)
      continue
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
    const raw = fs.readFileSync(src, 'utf8')
    if (raw.includes('supabaseAdmin') || raw.includes('next/server') || raw.includes('next/navigation')) {
      console.log('skip (next/admin):', path.relative(srcRoot, src))
      continue
    }
    fs.writeFileSync(dest, rewrite(raw))
  }
}

if (fs.existsSync(destRoot)) {
  fs.rmSync(destRoot, { recursive: true, force: true })
}

copyDir(path.join(srcRoot, 'fetches'), path.join(destRoot, 'fetches'))
copyDir(path.join(srcRoot, 'upserts'), path.join(destRoot, 'upserts'))
copyDir(path.join(srcRoot, 'deletions'), path.join(destRoot, 'deletions'))
copyDir(path.join(srcRoot, 'utils'), path.join(destRoot, 'utils'))
copyDir(path.join(srcRoot, 'auth'), path.join(destRoot, 'auth'))
copyDir(path.join(srcRoot, 'helpers'), path.join(destRoot, 'helpers'))

console.log('copied api layer')
