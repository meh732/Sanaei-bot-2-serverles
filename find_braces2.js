const fs = await import('fs');
const lines = fs.readFileSync('server/bot.ts', 'utf8').split('\n');
let depth = 0;
for(let i=2720; i<2740; i++) {
  console.log(i + 1, lines[i]);
}
