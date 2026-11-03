# Studio 2D plan verification

Run the editor preview, then:

```sh
MOBILE_TEST_URL=http://127.0.0.1:4173 node scripts/check-studio-plan-improvements.cjs
```

The browser check uses the real editor at 1440 × 900 and 375 × 900. It adds an L-shaped room through Add,
selects walls, doors, furniture and a fixture, verifies clearances, turns a wardrobe with R and the rotation
handle, checks one undo checkpoint for each completed turn, and verifies Escape restores the starting angle
without a checkpoint. It also checks for browser errors. Phone checks use a touch-capable browser with
synthetic pointer and keyboard input; they were not run on physical hardware.

| Scenario | Desktop | 375 px |
| --- | --- | --- |
| Two rooms, including L-shaped | [Desktop](two-rooms-1440.png) | [Phone](two-rooms-375.png) |
| Selected wall's opening segments | [Desktop](wall-chain-1440.png) | [Phone](wall-chain-375.png) |
| Door clearances and width × height | [Desktop](door-clearances-1440.png) | [Phone](door-clearances-375.png) |
| Wardrobe clearances | [Desktop](wardrobe-clearances-1440.png) | [Phone](wardrobe-clearances-375.png) |
| Wardrobe at 90° | [Desktop](wardrobe-90-1440.png) | [Phone](wardrobe-90-375.png) |
| Wardrobe at 45° | [Desktop](wardrobe-45-1440.png) | [Phone](wardrobe-45-375.png) |
| Fixture footprint and clearances | [Desktop](fixture-clearances-1440.png) | [Phone](fixture-clearances-375.png) |

The phone overview deliberately shrinks measurements with the plan; the check zooms and pans into the
L-shaped room for its segment and door views. Crowded text is omitted instead of covering controls or geometry.
