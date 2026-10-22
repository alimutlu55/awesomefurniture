// Current mobile interaction contract plus desktop regression coverage.
const {spawnSync}=require('node:child_process');
const scripts=['check-toolbar-layout.cjs','check-contextual-toolbar.cjs','check-mobile-sheets.cjs','check-canvas-selection.cjs','check-size-drawer.cjs','check-dimension-anchors.cjs','check-item-edge-resize.cjs','check-interior-drag.cjs',
 'check-desktop-regression.cjs','check-shape-editing.cjs','check-studio-placement.cjs','check-viewed-wall-placement.cjs','check-tactile-canvas.cjs','check-measurement-badges.cjs','check-minimum-depth.cjs','check-minimum-width.cjs','check-first-wall.cjs','check-front-growth.cjs','check-roof-divider.cjs','check-canvas-add.cjs','check-label-entry.cjs','check-label-overlap.cjs'];
for(const script of scripts) {
 const args=[...(['check-studio-placement.cjs','check-canvas-add.cjs'].includes(script)?['--import','tsx']:[]),require('node:path').join(__dirname,script)];
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});
 if(result.status!==0) process.exit(result.status || 1);
}
