/**
 * The hand tools an assembly step needs, as a flat-pack manual draws them before step 1: each hardware entry names the
 * ones its fitting goes in with (`assembly.tools`), and a step that drills its own holes needs the drill too.
 * `icon` is a 24 × 24 line drawing (an SVG path).
 */
export const TOOLS = {
  drill: { name: 'Drill and bits', short: 'Drill', icon: 'M3 9h11v5H3zM14 10h4M18 11.5h3M6 14l-1 6h4l1-6' },
  pozidriv: { name: 'Cross-head screwdriver (PZ2)', short: 'PZ2', icon: 'M12 2v4M10.5 6h3v6h-3zM9 12h6l-1 10h-4zM10.5 4h3' },
  flat: { name: 'Flat screwdriver', short: 'Flat', icon: 'M12 2v4M11 2h2M10.5 6h3v6h-3zM9 12h6l-1 10h-4z' },
  hex: { name: '4 mm hex key', short: 'Hex 4', icon: 'M7 3v14a3 3 0 0 0 3 3h9' },
  hammer: { name: 'Hammer', short: 'Hammer', icon: 'M4 6h10v5H4zM14 7h4l2 2-2 2h-4M9 11v11' },
  level: { name: 'Spirit level', short: 'Level', icon: 'M2 9h20v6H2zM10 10.5h4v3h-4z' },
  hand: { name: 'By hand', short: 'Hand', icon: 'M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7 6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 15' },
} as const;
export type ToolKey = keyof typeof TOOLS;
/** The tools in the order a manual shows them. */
export const TOOL_ORDER = Object.keys(TOOLS) as ToolKey[];
