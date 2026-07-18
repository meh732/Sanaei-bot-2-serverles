import fs from 'fs';
let code = fs.readFileSync('server/bot.ts', 'utf8');

// We need to close initBot() before runAutoBackup
code = code.replace(/\/\/ Start auto-backup worker/, '}\n\n// Start auto-backup worker');

// runAutoBackup is currently missing its closing brace, because it replaced `}, 10 * 60 * 1000);` with `// End AutoBackup`
code = code.replace(/\/\/ End AutoBackup \/\/ Check every 10 minutes/, '};\n\n// End AutoBackup');

// Then there's `export const runAutoBackup = async () => {` again which should be `runLimitCheck`?
code = code.replace(/export const runAutoBackup = async \(\) => \{\n\s*try \{\n\s*const state = db\.getState\(\);\n\s*const inboundsList = await xui\.getInbounds\(\);/, 'export const runLimitCheck = async () => {\n    try {\n      const state = db.getState();\n      const inboundsList = await xui.getInbounds();');

// Also the second setInterval closing is `}, 5 * 60 * 1000); // Check every 5 minutes` or similar
code = code.replace(/\},\s*\d+\s*\*\s*60\s*\*\s*1000\);\s*\/\/\s*Check every \d+ minutes\n\}/, '};\n');

// Also check for `}, 30 * 60 * 1000); // End LimitCheck`? Let's just remove the trailing `}` that was closing initBot if any, but we did that by replacing the setInterval closing.

fs.writeFileSync('server/bot.ts', code);
