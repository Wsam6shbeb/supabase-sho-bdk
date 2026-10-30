#!/usr/bin/env node
// ===============================================================
// يحوّل console.error / console.warn بكل ملفات src إلى logError / logWarn (services/logger.ts)
// ويضيف الاستيراد. الواجهة متطابقة، فالتحويل آمن.
//
// الاستخدام (من جذر المشروع):
//   node scripts/migrate-console-logging.mjs --dry-run   # يعرض فقط، بدون كتابة
//   node scripts/migrate-console-logging.mjs             # ينفّذ
//
// - آمن للتكرار (لا يضيف استيراداً مرتين).
// - يتجاوز services/logger.ts، والأسطر التي هي تعليقات فقط.
// - يتجاوز أي ملف يعرّف بنفسه دالة اسمها logError/logWarn (ويحذّر).
// ===============================================================
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const LOGGER_FILE = join(SRC, 'services', 'logger.ts');
const IMPORT_PATH = '@/services/logger';
const DRY = process.argv.includes('--dry-run');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const isCommentLine = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

/** يرجع [المصدر الجديد، الأسماء المستعملة، عدد التبديلات]. */
export function transformSource(source) {
  const lines = source.split('\n');
  const used = new Set();
  let replaced = 0;
  const out = lines.map((line) => {
    if (isCommentLine(line)) return line;
    return line
      .replace(/\bconsole\.error\b/g, () => (used.add('logError'), replaced++, 'logError'))
      .replace(/\bconsole\.warn\b/g, () => (used.add('logWarn'), replaced++, 'logWarn'));
  });
  return { text: out.join('\n'), names: [...used], replaced };
}

/** يضيف الاستيراد بعد آخر import أعلى الملف، أو يدمج الأسماء بـ import موجود من نفس الملف. */
export function ensureImport(text, names) {
  const existing = text.match(/^import\s*\{([^}]*)\}\s*from\s*['"]@\/services\/logger['"];?[ \t]*$/m);
  if (existing) {
    const have = existing[1].split(',').map((s) => s.trim()).filter(Boolean);
    const merged = [...new Set([...have, ...names])];
    if (merged.length === have.length) return text;
    return text.replace(existing[0], `import { ${merged.join(', ')} } from '${IMPORT_PATH}';`);
  }

  const lines = text.split('\n');
  let lastImportEnd = -1;
  let inImport = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!inImport && /^import[\s{*'"]/.test(line)) {
      if (/(from\s+['"][^'"]+['"]|^import\s+['"][^'"]+['"])\s*;?\s*$/.test(line)) lastImportEnd = i;
      else inImport = true;
    } else if (inImport && /from\s+['"][^'"]+['"]\s*;?\s*$/.test(line)) {
      inImport = false;
      lastImportEnd = i;
    }
  }
  const statement = `import { ${names.join(', ')} } from '${IMPORT_PATH}';`;
  lines.splice(lastImportEnd + 1, 0, statement);
  return lines.join('\n');
}

export function processFile(source) {
  if (/\b(function|const|let|var)\s+(logError|logWarn)\b/.test(source)) {
    return { skipped: 'يعرّف logError/logWarn بنفسه' };
  }
  const { text, names, replaced } = transformSource(source);
  if (replaced === 0) return { unchanged: true };
  return { text: ensureImport(text, names), replaced };
}

function main() {
  if (!existsSync(SRC)) {
    console.error('لم أجد مجلد src. شغّل الأمر من جذر المشروع.');
    process.exit(1);
  }
  if (!existsSync(LOGGER_FILE)) {
    console.error('لم أجد src/services/logger.ts. أضفه أولاً.');
    process.exit(1);
  }
  let files = 0;
  let total = 0;
  for (const file of walk(SRC)) {
    if (file === LOGGER_FILE) continue;
    const source = readFileSync(file, 'utf8');
    const result = processFile(source);
    const name = relative(ROOT, file);
    if (result.skipped) {
      console.warn(`تخطيت ${name}: ${result.skipped}`);
      continue;
    }
    if (result.unchanged) continue;
    files += 1;
    total += result.replaced;
    console.log(`${DRY ? '[dry-run] ' : ''}${name}: ${result.replaced} تبديل`);
    if (!DRY) writeFileSync(file, result.text, 'utf8');
  }
  console.log(`\n${DRY ? 'سيتم تعديل' : 'تم تعديل'} ${files} ملف (${total} استدعاء).`);
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
