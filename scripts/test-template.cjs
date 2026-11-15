const fs = require('fs');
const content = fs.readFileSync('src/lib/prisma.ts', 'utf-8');

// Extract the template literal content
const startMarker = "const initScript = `";
const startIdx = content.indexOf(startMarker);
if (startIdx < 0) { console.log('Start marker not found'); process.exit(1); }

// Find the closing backtick
const templateStart = startIdx + startMarker.length;
let depth = 0;
let endIdx = -1;
for (let i = templateStart; i < content.length; i++) {
  if (content[i] === '\\' && i + 1 < content.length && content[i + 1] === '`') {
    i++; // skip escaped backtick
    continue;
  }
  if (content[i] === '`') {
    endIdx = i;
    break;
  }
}

if (endIdx < 0) { console.log('Closing backtick not found'); process.exit(1); }

const templateContent = content.substring(templateStart, endIdx);
console.log('=== GENERATED SCRIPT ===');
console.log(templateContent);
console.log('=== END ===');

// Check for syntax errors by writing to temp and running
const tmpFile = 'test-init-output.cjs';
fs.writeFileSync(tmpFile, templateContent, 'utf-8');
console.log('\nWritten to', tmpFile);
console.log('\n=== FILE CONTENT ===');
console.log(templateContent);