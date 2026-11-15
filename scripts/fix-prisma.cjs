const fs = require('fs');
let content = fs.readFileSync('src/lib/prisma.ts', 'utf-8');

// Fix 1: Change .mjs to .cjs
content = content.replace(
  "const initScriptPath = '/tmp/prisma/init-db.mjs';",
  "const initScriptPath = '/tmp/prisma/init-db.cjs';"
);

// Fix 2: Fix the async IIFE closure
const oldEnd = [
  "  for (const sql of tables) {",
  "    try { await client.$executeRawUnsafe(sql); } catch(e) { console.error('SQL error:', e.message); }",
  "  }",
  "  console.log('Tables created successfully');",
  "}",
  "await client.$disconnect();",
  "`;"
].join('\n');

const newEnd = [
  "  for (const sql of tables) {",
  "    try { await client.$executeRawUnsafe(sql); } catch(e) { console.error('SQL error:', e.message); }",
  "  }",
  "  console.log('Tables created successfully');",
  "  await client.$disconnect();",
  "})().catch(e => { console.error(e); process.exit(1); });",
  "`;"
].join('\n');

content = content.replace(oldEnd, newEnd);

fs.writeFileSync('src/lib/prisma.ts', content, 'utf-8');
console.log('Fixed successfully');