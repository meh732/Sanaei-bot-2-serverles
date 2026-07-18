const fs = require('fs');
let content = fs.readFileSync('server/db.ts', 'utf8');

// replace fs imports with dynamic usage or safe try/catch
// Actually, it's easier to just wrap all fs calls in try-catch in db.ts
content = content.replace(/fs\.existsSync/g, 'safeExistsSync');
content = content.replace(/fs\.readFileSync/g, 'safeReadFileSync');
content = content.replace(/fs\.writeFileSync/g, 'safeWriteFileSync');
content = content.replace(/fs\.mkdirSync/g, 'safeMkdirSync');
content = content.replace(/fs\.unlinkSync/g, 'safeUnlinkSync');
content = content.replace(/fs\.readdirSync/g, 'safeReaddirSync');
content = content.replace(/fs\.statSync/g, 'safeStatSync');

content = `
import fs from 'fs';
import path from 'path';

function safeExistsSync(p: string) { try { return fs.existsSync(p); } catch { return false; } }
function safeReadFileSync(p: string, enc: any) { try { return fs.readFileSync(p, enc); } catch { return ''; } }
function safeWriteFileSync(p: string, data: string, enc?: any) { try { fs.writeFileSync(p, data, enc); } catch {} }
function safeMkdirSync(p: string, opts: any) { try { fs.mkdirSync(p, opts); } catch {} }
function safeUnlinkSync(p: string) { try { fs.unlinkSync(p); } catch {} }
function safeReaddirSync(p: string) { try { return fs.readdirSync(p); } catch { return []; } }
function safeStatSync(p: string) { try { return fs.statSync(p); } catch { return { mtime: new Date(0) }; } }
` + content.replace("import fs from 'fs';\nimport path from 'path';\n", "");

fs.writeFileSync('server/db.ts', content);
