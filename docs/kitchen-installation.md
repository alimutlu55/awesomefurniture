# Automatic kitchen installation parts

All dimensions in the domain model are centimetres. Corner allowances default to 4 cm and cabinet left/right side panels (`leftPanelThickness`, `rightPanelThickness`) default to 0 cm. Both have configurable controls in Size (**Corner allowance**, **Left panel**, **Right panel**). Legacy zero corner allowances use the 4 cm default; positive saved specifications remain effective. `cornerStrip` remains the persisted field name.

`corner-widths.ts` intersects the actual perpendicular cabinet footprints and front planes. An allocated strip inside a blind cabinet shares that cabinet's overall width: exposed face + strip + covered return = overall width. A returning cargo, drawer, or ordinary cabinet gets a strip outside its module width. Two ordinary fronts meeting at an open inside corner each get an additive strip. A parallel continuation suppresses a strip at the old run end.

`automatic-installation.ts` derives the additive strips and exposed end panes from current poses. Their negative identifiers are transient; saved cabinet identifiers are positive. Rendering, collisions, plan/elevation dimensions, schedules, cutting lists, and manufacture checks consume the same derived parts. Touching aligned neighbours and explicitly added installation parts suppress duplicates. These parts consume real space; adding a default does not resize or move an existing saved cabinet to conceal an installation clash.

End panes extend outside the cabinet footprint. They stand vertically from its base level through its full height, including the plinth zone of floor cabinets. Worktops extend across them. At an independent front/rear roof profile, the pane follows the selected side's two actual top heights; the cutting dimensions give the enclosing blank and the detail section shows the cut profile.

Adding **End/Separator pane** beside a selected cabinet or wardrobe copies its dimensions, side roof profile, materials and construction settings into a separate editable panel. Its width is its actual thickness. This is an initial copy: subsequent edits to that manually added pane remain independent. Automatic run end panes continue following their owners.

Existing projects receive derived installation parts when opened. Their poses and nominal module sizes never move to conceal a mismatch. Size now shows the actual corner equation and a spacing discrepancy when applicable. Check the installation clearance before issuing a new manufacture set: exported checks include the physical parts and the joint closure.

Verification: `tests/architecture/automatic-installation.test.ts` covers independent corner types, default and custom sizes, persistence, inheritance, collision clearance and movement. `scripts/check-automatic-installation.mjs` exercises the mounted app at 375 and 1440 px and writes previews to `output/automatic-installation/`.

## Blind corner: one gross allowance, two physical legs

The chosen construction is an overlapping butt joint. The allowance is measured from the **carcass front plane** to the perpendicular module's near edge. It includes the adjoining front thickness; it is not an extra clear width beyond the finished face. The blind cabinet supplies the long leg. The returning unit supplies the shorter leg:

`gross allowance = overlapping front thickness + return strip cutting width`

For the supplied professional drawing's 40 mm allocation with 18 mm stock, this is `40 = 18 + 22`. With 19 mm stock it is `40 = 19 + 21`. Changing thickness updates the return strip, without adding the thickness again to placement or shrinking the cargo/appliance module. Each leg keeps its owner's actual stock and height. Nonstandard depths, left/right hands, translated and rotated assemblies use the same intersections. Near-square intersections project thickness along the actual return axis rather than assuming an exact right angle.

For the reference fixture, the elevation reads `580 + 40 + 200`; the enlarged corner sheet explains `18 + 22`. Its 580 mm return reach includes a 50 mm rear service void and 530 mm carcass. The plan depth chain retains that subdivision. The attached elevation alone cannot establish every construction detail of the original project: this is the app's explicit, buildable convention, not an assertion about undisclosed joinery in the PDF.

An **open corner** between two ordinary module ends has no blind cabinet to supply the long leg. It retains two full return strips, with front thickness additionally reserved. It must not receive the blind butt-joint deduction on both legs.

## Drawings and verification

Every detected installed corner has a `Corner K... / K...` sheet. Its horizontal section cuts actual cabinet/strip boards at their shared height, hatches cut stock, identifies carcass and finished faces, and dimensions actual spacing separately from the specified allocation. The drawing is generated from the same boards as the cutting list. The blind strip width and the shortened return strip are stated separately; covered fronts remain fixed, without opening marks or handles.

The room overview dimensions the complete interval from the perpendicular carcass face to the returning module. It never dimensions a corner strip's cutting width as a separate module. A specified 40 mm corner shows **40**, with no words appended to the figure. If the saved geometry leaves 22 mm, the legend identifies corner figures as specified allowances; the detail and manufacturing check retain the measured 22 mm and missing 18 mm. The review export remains NOT FOR MANUFACTURE. Rendering never moves furniture or changes panel settings to conceal this difference.

The local worktop projection (20 mm under the current worktop rule) has its own short dimension at the inside corner, below the countertop on the elevation and next to the projected edge on the plan. It is independent of the main 40 mm corner chain and independent of the front-stock thickness. Perpendicular blind returns are hatched on the elevation. Front filler parts on the plan show their actual slab footprints rather than a full-depth cabinet envelope.

Corner checks report both measured and required spacing, missing space, unfilled space, and an allowance exhausted by stock thickness. These are blocking manufacturing findings. Reading, rendering and reopening never repair positions automatically; alignment and the explicit installation planner use the shared joint geometry.

The 40 mm default is a project starting value, **not hardware certification or a universal minimum**. Door thickness, handle projection, hinge travel, and corner mechanisms determine the needed allocation. Supplier review remains necessary; a static butt-joint detail does not establish full swept clearance. See [DIY Kitchens' corner-post construction and clearance guidance](https://advice.diy-kitchens.com/customer-questions/what-are-kitchen-corner-posts-and-why-are-they-needed/).

`tests/architecture/corner-joints.test.ts` checks reference chains, physical nonintersection, 18/19/22 mm stock, mirrored/rotated installations, invalid joint findings, deterministic details and atomic edits. `scripts/check-corner-joints.mjs` writes a reference elevation and corner-detail PDF for visual inspection.
