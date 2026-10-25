/** Line drawings of the spaces offered when a design starts, front on like an elevation, 160 × 100. Wall, floor
 * and wardrobe are classes the stylesheet colours, so the drawings follow the theme. */
const ART: Record<string, string> = {
  bedroom: '<rect class="wall" width="160" height="78"/><path class="floor" d="M0 78h160v22H0z"/>'
    + '<path class="trim" d="M0 78h160"/><rect class="glass" x="122" y="16" width="26" height="32" rx="1"/><path class="line" d="M135 16v32M122 32h26"/>'
    + '<rect class="wood" x="20" y="20" width="84" height="58"/><path class="line" d="M48 20v58M76 20v58M44 46v6M52 46v6M80 46v6"/>'
    + '<path class="shadow" d="M104 22l6 4v52h-6z"/>',
  alcove: '<rect class="wall" width="160" height="78"/><path class="floor" d="M0 78h160v22H0z"/>'
    + '<path class="recess" d="M34 8h92v70H34z"/><path class="shadow" d="M34 8l6 6v64h-6z"/>'
    + '<rect class="wood" x="40" y="14" width="80" height="64"/><path class="line" d="M60 14v64M80 14v64M100 14v64M56 44v6M64 44v6M96 44v6"/>'
    + '<path class="trim" d="M0 78h34M126 78h34"/>',
  'walk-in': '<path class="wall" d="M30 0h130v74H30z"/><path class="side" d="M0 0h30v74L0 100z"/><path class="floor" d="M0 100l30-26h130v26z"/>'
    + '<rect class="wood" x="36" y="16" width="118" height="58"/><path class="line" d="M65.5 16v58M95 16v58M124.5 16v58"/>'
    + '<path class="wood-side" d="M4 18l22-3v58L4 92z"/><path class="line" d="M15 16.5v67"/>',
  attic: '<path class="wall" d="M0 30 100 0h60v78H0z"/><path class="roof" d="M0 0h100L0 30z"/><path class="floor" d="M0 78h160v22H0z"/>'
    + '<path class="wood" d="M12 78V36l84-26h50v68z"/><path class="line" d="M48 78V24.9M96 78V10M121 78V10M44 50v6M100 50v6"/>'
    + '<path class="trim" d="M0 30 100 0"/>',
  stairs: '<rect class="wall" width="160" height="78"/><path class="floor" d="M0 78h160v22H0z"/>'
    + '<path class="roof" d="M14 0h146v52L14 4z"/><path class="line" d="M24 0v7h14v5h14v5h14v5h14v5h14v5h14v5h14v5h14v5h14"/>'
    + '<path class="wood" d="M18 78V10l128 46v22z"/><path class="line" d="M50 78V21.5M82 78V33M114 78V44.5M46 50v6M86 54v6"/>',
  free: '<ellipse class="shade" cx="80" cy="84" rx="48" ry="6"/><rect class="wood" x="50" y="14" width="60" height="68"/>'
    + '<path class="line" d="M80 14v68M76 44v6M84 44v6"/><path class="shadow" d="M110 16l5 3v61l-5 2z"/>',
};

export const spaceArt = (id: string) => '<svg class="xp-art" viewBox="0 0 160 100" aria-hidden="true" preserveAspectRatio="xMidYMid meet">' + (ART[id] ?? ART.free) + '</svg>';
