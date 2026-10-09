import fs from 'node:fs';
import { WardrobePlanner } from '../src/domain/planner/wardrobe-planner.js';
const data=JSON.parse(fs.readFileSync(process.argv[2]??'docs/verification/planner-archetype-results.json','utf8'));
const cases=Array.isArray(data)?data:data.rows;
const review=!Array.isArray(data);
const title=review?'Wardrobe test and design review':'Auto design: five inventory squint test';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors={short:'#6b7d89',long:'#6b7d89',lift:'#6b7d89',drawer:'#82998d',sdrawer:'#a08a98',folded:'#82998d',pants:'#8b8297',shoe:'#92949a',seasonal:'#a39785',void:'#ebe7df',shelf:'#82998d',basket:'#82998d'};
function thumbnail(p,c){const H=c.h-11.6;let offset=1.8;
 const parts=p.sections.flatMap((s,i)=>{
  const positions=WardrobePlanner.layoutSection(s.items,s.width);
  const content=s.items.map((it,j)=>{const q=positions[j],x=offset+q.x0,y=H-q.y1;return `<rect x="${x}" y="${y}" width="${q.w}" height="${q.h}" fill="${colors[it.k]??'#888'}" stroke="#f8f5ef" stroke-width=".7"/><text x="${x+q.w/2}" y="${y+q.h/2+2}" text-anchor="middle" font-size="4">${esc(it.k)}</text>`;});
  const dividers=(p.dividers??[]).filter(d=>d.i===i).map(d=>d.orientation==='vertical'?`<rect x="${offset+d.x-.9}" y="${H-d.y1}" width="1.8" height="${d.y1-d.y0}" fill="#dbc7a2"/>`:`<rect x="${offset+d.x0}" y="${H-d.y-.9}" width="${d.x1-d.x0}" height="1.8" fill="#dbc7a2"/>`);
  offset+=s.width+1.8;return [...content,...dividers];
 });
 return `<svg viewBox="0 0 ${c.w} ${H}" role="img" aria-label="${esc(p.title)}"><rect width="${c.w}" height="${H}" fill="#e9dfcc"/>${parts.join('')}<line x1="0" x2="${c.w}" y1="${H-c.reach+9.8}" y2="${H-c.reach+9.8}" stroke="#393933" stroke-dasharray="2 2" stroke-width=".6"/></svg>`;
}
const html=`<!doctype html><meta charset="utf-8"><title>${title}</title><style>body{font:14px system-ui;background:#f4f1eb;color:#333;margin:24px}h1{font-size:24px}h2{font-size:18px;margin:24px 0 8px}.row{display:flex;gap:16px}article{background:white;border-radius:12px;padding:12px;width:260px}svg{width:100%;height:240px}h3{font-size:16px;margin:8px 0}p{margin:8px 0;font-size:12px}.muted{color:#777}text{fill:#fff}</style><h1>${title}</h1><p>Existing fittings. Mirrored and near-identical families collapsed. Every specialist has ≥15% hero advantage and DNA distance ≥0.20.</p>${cases.map(c=>`<h2>${esc(c.name)} · ${c.cfg.w} × ${c.cfg.h} × ${c.cfg.d} cm</h2>${review?'<p>'+data.findings.filter(f=>f.caseName===c.name).map(f=>esc(f.message)).join(' · ')+'</p>':''}${!c.plans.length?'<p>'+esc(c.explanation??'No qualified plan')+'</p>':''}<div class="row">${c.plans.map(p=>`<article>${thumbnail(p,c.cfg)}<h3>${esc(p.title)}</h3><p>${Math.round(p.coverage*100)}% inventory coverage · score ${p.score}</p><p>${p.comparison?esc(p.comparison.hero)+': +'+Math.round(p.comparison.margin*100)+'% vs Best Overall':'Balanced reference'}</p><p class="muted">${esc(p.comparison?.giveUp??'')}</p></article>`).join('')}</div>`).join('')}`;
fs.writeFileSync(review?'docs/verification/planner-review.html':'docs/verification/archetype-thumbnails.html',html);
