// Current mobile interaction contract plus desktop regression coverage.
const {spawnSync}=require('node:child_process');
for(const script of ['check-contextual-toolbar.cjs','check-mobile-sheets.cjs','check-desktop-regression.cjs']) {
 const result=spawnSync(process.execPath,[require('node:path').join(__dirname,script)],{stdio:'inherit',env:process.env});
 if(result.status!==0) process.exit(result.status || 1);
}
