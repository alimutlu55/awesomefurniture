import { DRAWING_PRESETS, CLEARANCE_PROFILES } from '../../domain/drawings/view-policy';
export const viewerMarkup = () => `
<header class="drawings-bar">
  <div class="drawings-title"><h2>Technical drawings</h2><span class="drawings-count" aria-live="polite"></span></div>
  <button type="button" class="drawings-close" aria-label="Close technical drawings">×</button>
  <nav class="drawing-presets" aria-label="Drawing purpose">${DRAWING_PRESETS.map(p => `<button type="button" data-preset="${p.key}">${p.label}</button>`).join('')}</nav>
  <div class="drawings-tools">
    <button type="button" data-action="sheets" aria-expanded="false">Sheets</button>
    <button type="button" data-action="issues" class="drawing-issues-button">Checks</button>
    <button type="button" data-action="schedule">Cabinets</button>
    <div class="drawings-zoom" role="group" aria-label="Zoom"><button type="button" data-zoom="-1" aria-label="Zoom out">−</button><button type="button" data-zoom="1" aria-label="Zoom in">+</button></div>
    <button type="button" data-fit="drawing">Fit drawing</button><button type="button" data-fit="page">Fit page</button>
    <button type="button" class="drawings-pdf">Save as PDF</button>
  </div>
</header>
<div class="drawing-rule" hidden><label>Clearance review profile <select aria-label="Clearance review profile">${CLEARANCE_PROFILES.map(p => `<option value="${p.key}">${p.label}</option>`).join('')}</select></label>
<span>Planning recommendations · door handing must be confirmed</span></div>
<div class="drawing-workspace">
  <aside class="drawing-index" hidden aria-label="Sheet index">
<input type="search" aria-label="Search sheets" placeholder="Find a sheet or cabinet">
<div class="drawing-index-list"></div></aside>
  <div class="drawing-stage"><div class="drawing-page-nav">
<button type="button" data-action="previous" aria-label="Previous sheet">‹</button>
<button type="button" data-action="back-view">Previous view</button>
<span class="drawing-current" aria-live="polite"></span>
<button type="button" data-action="next" aria-label="Next sheet">›</button></div>
  <div class="drawings-sheets" tabindex="0" aria-label="Drawing viewport"><figure class="drawings-sheet"></figure></div></div>
  <aside class="drawing-inspector" hidden aria-label="Drawing details"></aside>
</div>
<div class="drawing-export" hidden role="dialog" aria-modal="true" aria-label="Export preview"><div class="drawing-export-card"><h3>Export preview</h3>
  <p class="drawing-export-purpose"></p>
<label>Pages <select aria-label="Export pages"><option value="set">Current drawing set</option>
<option value="sheet">Current sheet</option></select></label>
  <p class="drawing-export-summary"></p><div class="drawing-export-image"></div><p>Vector A3 landscape · dimensions in mm · saved label positions included</p>
  <button type="button" data-action="download">Download PDF</button><button type="button" data-action="cancel-export">Cancel</button></div></div>
<p class="drawing-status" role="status"></p>`;
