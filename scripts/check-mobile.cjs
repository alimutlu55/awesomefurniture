// Current mobile interaction contract plus desktop regression coverage.
const {spawnSync}=require('node:child_process');
const scripts=['check-toolbar-layout.cjs','check-contextual-toolbar.cjs','check-mobile-sheets.cjs',
 'check-desktop-regression.cjs','check-shape-editing.cjs','check-studio-placement.cjs','check-viewed-wall-placement.cjs','check-tactile-canvas.cjs','check-measurement-badges.cjs','check-minimum-depth.cjs','check-first-wall.cjs'];
for(const script of scripts) {
 const args=[...(script==='check-studio-placement.cjs'?['--import','tsx']:[]),require('node:path').join(__dirname,script)];
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});
 if(result.status!==0) process.exit(result.status || 1);
}
