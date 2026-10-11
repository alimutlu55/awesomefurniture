# Adding a possession

A possession is something a person stores that Auto design plans for: shirts, shoes, handbags.
Anything that stands on a shelf (handbags, hats, boxes of cables) is added with **one entry**.

## Steps

1. Open `src/domain/wardrobe/possessions.ts`.
2. Append an entry with `engine: 'shelf'` to `POSSESSIONS`. Copy the `handbags` entry and change it:

   | Field | Meaning |
   |---|---|
   | `key` | One lowercase word. It is the planner category, the saved need and the item purpose. |
   | `label` | Name shown in the wizard, the Add menu and the layout drawing. |
   | `need` | Wizard field: starting count and maximum. |
   | `planner.frequency` | How often it is used, 1 is daily. Weighs it against the other possessions. |
   | `planner.home` | Share of the reach height where it is best kept, `[low, high]`. |
   | `holder` | Shelf height, width per unit, end margin, most shelves stacked, drawn unit size. |
   | `look` | Zone colour, line icon path and card stroke. |
   | `menu` | Add menu text and base ranking score. |

3. Run `npm test`. `tests/architecture/possessions.test.ts` walks the new entry through every place below.
   A failure names the step that is missing.

## What follows from the entry, with no other edit

- Planner: category, demand with the growth allowance, weights, stacked shelf modules, capacity in the
  physical engine, and the "Label: room for N of M" warning in Auto design.
- Wizard: a count field in "What do you store?", read and saved with the design.
- Saved projects: the need and the item purpose are accepted. Projects saved earlier open with the default count.
- Add item: a card, ranked with the shelves, that adds a shelf of the right height and width.
- Layout: zone colour and name, the icon, and the units drawn standing on the shelf in 3D.

## When it needs engine work

The six clothing possessions are `engine: 'bespoke'` because their fittings (hanging rails, drawers,
trouser pull-outs) have hand-written capacity rules in `wardrobe-planner.js`. A new kind of **fitting**
needs that work. A new thing to **put on a shelf** does not.
