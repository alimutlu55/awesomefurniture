const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const path=require('node:path');
const read=p=>readFileSync(path.join(__dirname,'..',p),'utf8');
const baseline=require('./fixtures/editor-baseline.json');
const hash=s=>createHash('sha256').update(s).digest('hex');
test('planner and controls match reviewed feature baselines; styles match the shared mobile and desktop baseline',()=>{
 assert.equal(hash(read('src/domain/planner/wardrobe-planner.js').replace('export const WardrobePlanner','const WardrobePlanner')),baseline.planner);
 assert.equal(hash(read('src/presentation/editor/editor.css')),baseline.css);
 assert.equal(hash(read('src/presentation/editor/editor.html')),baseline.markup);
});
test('both application entries open the editor without project screens',()=>{
 assert.ok(read('vite.config.ts').includes("editor: 'editor.html'"));
 assert.ok(!read('vite.config.ts').includes('Wardrobe_Forge-4-16-7-4'));
 assert.match(read('index.html'), /id="editor-root"/);
 assert.match(read('src/app/main.ts'), /import '\.\/editor'/);
 assert.doesNotMatch(read('src/app/editor.ts'), /projectToScene|projects\.open|initialScene/);
 assert.doesNotMatch(read('src/presentation/editor/mount-editor.ts'), /mountProjectControls|projectStyles/);
 assert.equal(require('node:fs').existsSync(path.join(__dirname,'../src/presentation/projects/project-workspace.ts')),false);
});

test('presentation writes design changes only through application commands',()=>{
 const ts=require('typescript');
 const {readdirSync}=require('node:fs');
 const files=[];
 const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.[jt]s$/.test(file)&&!file.endsWith('.d.ts'))files.push(file)}};
 walk(path.join(__dirname,'../src/presentation'));
 const fields=new Set(['w','h','d','n','wt','secs','dividers','fin','doors','profile','proposal','reachLine','shape']);
 const violations=[];
 for(const file of files){
  const text=readFileSync(file,'utf8'),source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  const visit=node=>{
   if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(node.left)&&fields.has(node.left.name.text)&&/^(?:(?:editorPorts\.)?S|renderDesign|model\.activeCabinet\(\)\.state)$/.test(node.left.expression.getText(source)))violations.push(path.basename(file)+': '+node.left.getText(source));
   ts.forEachChild(node,visit);
  };
  visit(source);
 }
 assert.deepEqual(violations,[]);
});
test('retired standalone HTML is absent and cannot mask a module dependency',()=>{
 assert.equal(require('node:fs').existsSync(path.join(__dirname,'../Wardrobe_Forge-4-16-12.html')),false);
});
