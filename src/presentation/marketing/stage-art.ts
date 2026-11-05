const ACCENT = '#a8642a';

function heroSvg(): string {
  return '<svg viewBox="0 0 240 150" fill="none" stroke="currentColor" stroke-width="1.4" role="img" aria-label="Fitted wardrobe system technical elevation">'
    + '<title>Fitted wardrobe elevation</title>'
    + '<path d="M35 15h170M35 10v10m170-10v10" stroke="' + ACCENT + '" stroke-width="1.2"/>'
    + '<text x="120" y="12" font-size="8" fill="' + ACCENT + '" stroke="none" text-anchor="middle" font-weight="600">2400 mm</text>'
    + '<rect x="35" y="24" width="170" height="106" rx="2"/>'
    + '<path d="M92 24v106M148 24v106" stroke-width="1.4"/>'
    + '<path d="M35 48h57M35 90h57" opacity=".6"/>'
    + '<path d="M46 56l17-8 17 8M55 48v8m17-8v8" stroke-width="1.1" opacity=".7"/>'
    + '<path d="M50 62v40M63 62v40M76 62v40" opacity=".4"/>'
    + '<path d="M92 42h56M92 68h56M92 94h56M92 110h56" opacity=".6"/>'
    + '<path d="M148 50h57M148 76h57M148 102h57" opacity=".6"/>'
    + '<path d="M170 63h14M170 89h14M170 115h14" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M213 24v106M209 24h8M209 130h8" stroke="' + ACCENT + '" stroke-width="1.2"/>'
    + '<text x="221" y="80" font-size="7.5" fill="' + ACCENT + '" stroke="none" transform="rotate(90 221 80)" text-anchor="middle">2600 mm</text>'
    + '<text x="40" y="142" font-size="7" fill="' + ACCENT + '" stroke="none" font-weight="600">FD—01 · 2400 × 2600 mm</text>'
    + '</svg>';
}

function studioSvg(): string {
  return '<svg viewBox="0 0 240 150" fill="none" stroke="currentColor" stroke-width="1.4" role="img" aria-label="Room plan and layout">'
    + '<title>Room floor plan</title>'
    + '<path d="M40 18h150M40 13v10m150-10v10" stroke="' + ACCENT + '" stroke-width="1.2"/>'
    + '<text x="115" y="14" font-size="8" fill="' + ACCENT + '" stroke="none" text-anchor="middle" font-weight="600">4000 mm</text>'
    + '<rect x="40" y="26" width="150" height="100" stroke-width="3"/>'
    + '<path d="M40 56h-6v40h6" stroke-width="1.6" fill="var(--bg,#f7f6f2)"/>'
    + '<path d="M37 56v40M40 56v40" opacity=".5"/>'
    + '<path d="M140 126h30v-4" stroke-width="1.6"/>'
    + '<path d="M140 126a30 30 0 0 1 30-30" stroke-dasharray="3 3" opacity=".6"/>'
    + '<path d="M170 96v30" opacity=".7"/>'
    + '<text x="115" y="70" font-size="10" fill="currentColor" stroke="none" text-anchor="middle" font-weight="600">14.0 m²</text>'
    + '<text x="115" y="84" font-size="8" fill="' + ACCENT + '" stroke="none" text-anchor="middle">4.00 × 3.50 m</text>'
    + '<path d="M22 26v100M17 26h10M17 126h10" stroke="' + ACCENT + '" stroke-width="1.2"/>'
    + '<text x="14" y="78" font-size="7.5" fill="' + ACCENT + '" stroke="none" transform="rotate(-90 14 78)" text-anchor="middle">3500 mm</text>'
    + '<g transform="translate(162,34)" stroke-width="1.2">'
    + '<rect x="0" y="0" width="22" height="12" rx="3" stroke="' + ACCENT + '"/>'
    + '<text x="11" y="9" font-size="6.5" fill="' + ACCENT + '" stroke="none" text-anchor="middle" font-weight="700">2D</text>'
    + '</g></svg>';
}

function parametricSvg(): string {
  return '<svg viewBox="0 0 240 150" fill="none" stroke="currentColor" stroke-width="1.4" role="img" aria-label="Parametric cabinet divisions">'
    + '<title>Parametric cabinet sizing</title>'
    + '<rect x="35" y="28" width="170" height="98" rx="2"/>'
    + '<path d="M85 28v98M145 28v98" stroke-width="1.4"/>'
    + '<path d="M35 18h50M35 14v8m50-8v8" stroke="' + ACCENT + '" stroke-width="1.1"/>'
    + '<text x="60" y="15" font-size="7" fill="' + ACCENT + '" stroke="none" text-anchor="middle">700 mm</text>'
    + '<path d="M85 18h60M85 14v8m60-8v8" stroke="' + ACCENT + '" stroke-width="1.1"/>'
    + '<text x="115" y="15" font-size="7" fill="' + ACCENT + '" stroke="none" text-anchor="middle">850 mm</text>'
    + '<path d="M145 18h60M145 14v8m60-8v8" stroke="' + ACCENT + '" stroke-width="1.1"/>'
    + '<text x="175" y="15" font-size="7" fill="' + ACCENT + '" stroke="none" text-anchor="middle">850 mm</text>'
    + '<path d="M35 55h50M35 85h50" opacity=".6"/>'
    + '<path d="M85 45h60M85 70h60M85 95h60" stroke="' + ACCENT + '" stroke-dasharray="2 2"/>'
    + '<path d="M145 60h60M145 80h60M145 100h60" opacity=".6"/>'
    + '<path d="M213 28v98M209 28h8M209 126h8" stroke="' + ACCENT + '" stroke-width="1.1"/>'
    + '<text x="221" y="80" font-size="7.5" fill="' + ACCENT + '" stroke="none" transform="rotate(90 221 80)" text-anchor="middle">H: 2300 mm</text>'
    + '<rect x="35" y="132" width="70" height="13" rx="3" stroke="' + ACCENT + '" fill="var(--bg,#f7f6f2)"/>'
    + '<text x="70" y="141" font-size="6.5" fill="' + ACCENT + '" stroke="none" text-anchor="middle" font-weight="600">18 mm · MFC</text>'
    + '</svg>';
}

function autolayoutSvg(): string {
  return '<svg viewBox="0 0 240 150" fill="none" stroke="currentColor" stroke-width="1.4" role="img" aria-label="Storage inventory and automatic layout">'
    + '<title>Storage inventory layout</title>'
    + '<rect x="30" y="22" width="180" height="106" rx="2"/>'
    + '<path d="M90 22v106M150 22v106"/>'
    + '<rect x="34" y="26" width="52" height="20" rx="1.5" stroke="' + ACCENT + '" stroke-dasharray="2 2"/>'
    + '<text x="60" y="39" font-size="7" fill="' + ACCENT + '" stroke="none" text-anchor="middle" font-weight="600">4×</text>'
    + '<path d="M38 52h44M38 56l10-6 10 6M48 52v4M58 52v4" opacity=".6"/>'
    + '<path d="M42 62v42M52 62v42M62 62v42M72 62v42" opacity=".35"/>'
    + '<text x="60" y="118" font-size="7" fill="currentColor" stroke="none" text-anchor="middle" font-weight="600">24×</text>'
    + '<path d="M94 26h52M94 50h52M94 74h52M94 98h52" opacity=".6"/>'
    + '<text x="120" y="42" font-size="7" fill="currentColor" stroke="none" text-anchor="middle" font-weight="600">20×</text>'
    + '<text x="120" y="66" font-size="7" fill="currentColor" stroke="none" text-anchor="middle" font-weight="600">12×</text>'
    + '<text x="120" y="90" font-size="7" fill="currentColor" stroke="none" text-anchor="middle" font-weight="600">30×</text>'
    + '<text x="120" y="116" font-size="7" fill="' + ACCENT + '" stroke="none" text-anchor="middle" font-weight="600">8×</text>'
    + '<path d="M154 38l44-8M154 62l44-8M154 86l44-8M154 110l44-8" stroke="' + ACCENT + '" opacity=".7"/>'
    + '<text x="176" y="122" font-size="7" fill="currentColor" stroke="none" text-anchor="middle" font-weight="600">12×</text>'
    + '<rect x="135" y="132" width="75" height="13" rx="3" fill="' + ACCENT + '"/>'
    + '<text x="172" y="141" font-size="7" fill="#fff" stroke="none" text-anchor="middle" font-weight="700">99.4%</text>'
    + '</svg>';
}

function makeSvg(): string {
  return '<svg viewBox="0 0 240 150" fill="none" stroke="currentColor" stroke-width="1.3" role="img" aria-label="Exploded assembly view">'
    + '<title>Assembly studio exploded CAD</title>'
    + '<g transform="translate(10,-5)">'
    + '<path d="M60 115l90-18 35 15-90 18z" stroke-width="1.6"/>'
    + '<circle cx="68" cy="116" r="5" stroke="' + ACCENT + '" fill="var(--bg,#f7f6f2)"/>'
    + '<text x="68" y="119" font-size="6" fill="' + ACCENT + '" stroke="none" text-anchor="middle" font-weight="700">1</text>'
    + '<path d="M60 115v-60l35 15v60z" stroke-width="1.5"/>'
    + '<path d="M60 55l15-20m0 0v60" stroke-dasharray="3 3" opacity=".5"/>'
    + '<circle cx="68" cy="75" r="5" stroke="' + ACCENT + '" fill="var(--bg,#f7f6f2)"/>'
    + '<text x="68" y="78" font-size="6" fill="' + ACCENT + '" stroke="none" text-anchor="middle" font-weight="700">2</text>'
    + '<path d="M150 97v-60l35 15v60z" stroke-width="1.5"/>'
    + '<circle cx="178" cy="65" r="5" stroke="' + ACCENT + '" fill="var(--bg,#f7f6f2)"/>'
    + '<text x="178" y="68" font-size="6" fill="' + ACCENT + '" stroke="none" text-anchor="middle" font-weight="700">3</text>'
    + '<path d="M60 55l90-18 35 15-90 18z" stroke-width="1.6" stroke="' + ACCENT + '"/>'
    + '<circle cx="120" cy="48" r="5" stroke="' + ACCENT + '" fill="' + ACCENT + '"/>'
    + '<text x="120" y="51" font-size="6" fill="#fff" stroke="none" text-anchor="middle" font-weight="700">4</text>'
    + '<path d="M95 70l45-9 17 8-45 9z" stroke-dasharray="2 2" opacity=".6"/>'
    + '</g>'
    + '<text x="35" y="142" font-size="7" fill="' + ACCENT + '" stroke="none" font-weight="600">1:20 · EXPLODED CAD</text>'
    + '</svg>';
}

function drawingsSvg(): string {
  return '<svg viewBox="0 0 240 150" fill="none" stroke="currentColor" stroke-width="1.3" role="img" aria-label="Technical drawing and elevation">'
    + '<title>Technical drawings and elevations</title>'
    + '<rect x="25" y="15" width="190" height="118" stroke-width="1.8"/>'
    + '<rect x="29" y="19" width="182" height="110" stroke-width="0.8" opacity=".7"/>'
    + '<g transform="translate(42,28)">'
    + '<path d="M0 80V0h110v80" stroke-width="1.5"/>'
    + '<path d="M35 0v80M75 0v80" stroke-width="1.2"/>'
    + '<path d="M0 25h35m40 0h35M0 50h35m40 0h35" opacity=".6"/>'
    + '<path d="M35 15h40M35 35h40M35 55h40" opacity=".6"/>'
    + '<path d="M-10 0v80M-14 0h8M-14 80h8" stroke="' + ACCENT + '" stroke-width="1"/>'
    + '<text x="-16" y="42" font-size="6.5" fill="' + ACCENT + '" stroke="none" transform="rotate(-90 -16 42)" text-anchor="middle">2400</text>'
    + '<path d="M0 -6h110M0 -9v6M110 -9v6" stroke="' + ACCENT + '" stroke-width="1"/>'
    + '<text x="55" y="-8" font-size="6.5" fill="' + ACCENT + '" stroke="none" text-anchor="middle">2200</text>'
    + '</g>'
    + '<rect x="145" y="98" width="62" height="27" stroke-width="1" fill="var(--bg,#f7f6f2)"/>'
    + '<path d="M145 107h62M145 116h62" stroke-width="0.7"/>'
    + '<text x="148" y="104" font-size="5" fill="currentColor" stroke="none" font-weight="700">FURNIDRAW DWG</text>'
    + '<text x="148" y="113" font-size="5" fill="' + ACCENT + '" stroke="none">DIN A3 · SCALE 1:20</text>'
    + '<text x="148" y="122" font-size="4.5" fill="currentColor" stroke="none">±0.5 mm</text>'
    + '</svg>';
}

function renderSvg(): string {
  return '<svg viewBox="0 0 240 150" fill="none" stroke="currentColor" stroke-width="1.3" role="img" aria-label="3D raytraced visualization">'
    + '<title>3D room visualization</title>'
    + '<g transform="translate(10,5)">'
    + '<path d="M30 15h160v105H30z" stroke-width="1"/>'
    + '<path d="M30 15l45 25m115-25l-45 25M30 120l45-20m115 20l-45-20" stroke-dasharray="3 3" opacity=".4"/>'
    + '<rect x="75" y="40" width="70" height="60" stroke-width="1.6"/>'
    + '<path d="M98 40v60M122 40v60" stroke-width="1.2"/>'
    + '<path d="M75 58h23M122 58h23M75 80h23M122 80h23" opacity=".6"/>'
    + '<path d="M30 35l30-10v35l-30 10z" stroke="' + ACCENT + '" stroke-width="1.2" fill="var(--bg,#f7f6f2)"/>'
    + '<path d="M60 40l60 25M60 55l60 25M60 70l60 25" stroke="' + ACCENT + '" stroke-dasharray="2 3" opacity=".6"/>'
    + '</g>'
    + '<g transform="translate(145,124)">'
    + '<rect x="0" y="0" width="70" height="14" rx="3" stroke="' + ACCENT + '" fill="var(--bg,#f7f6f2)"/>'
    + '<text x="35" y="10" font-size="6.5" fill="' + ACCENT + '" stroke="none" text-anchor="middle" font-weight="600">4K · RAYTRACE</text>'
    + '</g></svg>';
}

export function stageSvg(slug: string): string {
  switch (slug) {
    case 'hero': return heroSvg();
    case 'studio': return studioSvg();
    case 'parametric': return parametricSvg();
    case 'autolayout': return autolayoutSvg();
    case 'make': return makeSvg();
    case 'drawings': return drawingsSvg();
    case 'render': return renderSvg();
    default: return heroSvg();
  }
}
