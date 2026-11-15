const fs = require('fs');
const c = fs.readFileSync('src/lib/prisma.ts', 'utf-8');
const start = c.indexOf('const initScript =');
const end = c.indexOf('fs.writeFileSync(initScriptPath', start);
const script = c.substring(start, end);
const backtickStart = script.indexOf('`');
const backtickEnd = script.lastIndexOf('`');
const content = script.substring(backtickStart + 1, backtickEnd);
console.log('=== Generated script ===');
console.log(content);
console.log('=== End ===');
fs.writeFileSync('test-gen-output.cjs', content, 'utf-8');
console.log('Written to test-gen-output.cjs');

// Now try to parse it
try {
  require('child_process').execSync('node --check test-gen-output.cjs', { stdio: 'pipe' });
  console.log('✅ Syntax check PASSED');
} catch (e) {
  console.log('❌ Syntax check FAILED:', e.stderr ? e.stderr.toString() : e.message);
}