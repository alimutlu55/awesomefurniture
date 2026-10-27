# Automatic kitchen installation parts

All dimensions in the domain model are centimetres. Corner strips default to 4 cm and cabinet left/right side panels (`leftPanelThickness`, `rightPanelThickness`) default to 0 cm. Both have configurable controls in Size (**Corner strip**, **Left panel**, **Right panel**). Legacy zero corner strips use the required 4 cm default; positive saved specifications remain effective.

`corner-widths.ts` intersects the actual perpendicular cabinet footprints and front planes. An allocated strip inside a blind cabinet shares that cabinet's overall width: exposed face + strip + covered return = overall width. A returning cargo, drawer, or ordinary cabinet gets an additive strip outside its module width. Two ordinary fronts meeting at an inside corner each get an additive strip. A parallel continuation suppresses a strip at the old run end.

`automatic-installation.ts` derives the additive strips and exposed end panes from current poses. Their negative identifiers are transient; saved cabinet identifiers are positive. Rendering, collisions, plan/elevation dimensions, schedules, cutting lists, and manufacture checks consume the same derived parts. Touching aligned neighbours and explicitly added installation parts suppress duplicates. These parts consume real space; adding a default does not resize or move an existing saved cabinet to conceal an installation clash.

End panes extend outside the cabinet footprint. They stand vertically from its base level through its full height, including the plinth zone of floor cabinets. Worktops extend across them. At an independent front/rear roof profile, the pane follows the selected side's two actual top heights; the cutting dimensions give the enclosing blank and the detail section shows the cut profile.

Adding **End/Separator pane** beside a selected cabinet or wardrobe copies its dimensions, side roof profile, materials and construction settings into a separate editable panel. Its width is its actual thickness. This is an initial copy: subsequent edits to that manually added pane remain independent. Automatic run end panes continue following their owners.

The field explanations previously shown beside construction controls have been removed. Existing projects receive automatic parts when opened. Check their installation clearance before issuing a new manufacture set: the exported checks include these added physical parts and flag collisions.

Verification: `tests/architecture/automatic-installation.test.ts` covers independent corner types, default and custom sizes, persistence, inheritance, collision clearance and movement. `scripts/check-automatic-installation.mjs` exercises the mounted app at 375 and 1440 px and writes previews to `output/automatic-installation/`.
