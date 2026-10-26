// Writes public/llms.txt (the guide for AI agents) from the same code as window.furnidraw.help(), so the
// two never differ. Run after changing the guide or a registry: npm run agents:guide (a test checks they match).
import { writeFileSync } from 'node:fs';
import { agentGuide } from '../src/app/agent-api.ts';
writeFileSync('public/llms.txt', agentGuide());
console.log('public/llms.txt written');
