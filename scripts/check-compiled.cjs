const fs = require('fs');
const e = fs.readFileSync('.next/server/chunks/451.js', 'utf-8');
const idx = e.indexOf('init-db.cjs');
const templateStart = e.indexOf('`', idx) + 1;
// Find the matching closing backtick
let templateEnd = -1;
for (let i = templateStart; i < e.length; i++) {
  if (e[i] === '\\' && i + 1 < e.length && e[i + 1] === '`') { i++; continue; }
  if (e[i] === '`') { templateEnd = i; break; }
}
const templateContent = e.substring(templateStart, templateEnd);

// Now evaluate this as a template literal to see the actual output
const tmpDb = '/tmp/prisma/uzu_bank.db';
const E = tmpDb;
const actualScript = eval('`' + templateContent + '`');
console.log('Actual script length:', actualScript.length);
console.log('=== LAST 200 CHARS ===');
console.log(actualScript.substring(actualScript.length - 200));
// Check for backslash-backtick in actual output
const hasEscaped = actualScript.includes('\\`');
console.log('Has escaped backticks in output:', hasEscaped);

// Try to run the actual script
const tmpFile = 'test-actual-output.cjs';
fs.writeFileSync(tmpFile, actualScript, 'utf-8');
console.log('\nWritten to', tmpFile);
console.log('Trying to execute...');
try {
  require('child_process').execSync('node ' + tmpFile, { stdio: 'pipe', timeout: 10000 });
  console.log('Script executed successfully!');
} catch (err) {
  console.error('Script execution failed:', err.message);
  if (err.stdout) console.log('stdout:', err.stdout.toString());
  if (err.stderr) console.log('stderr:', err.stderr.toString());
}