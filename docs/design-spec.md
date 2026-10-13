# Design specs: building designs from a description

Agents (and people) describe the result they want; the app builds it with the editor's own commands and
reports back what it built. No clicking, no coordinates.

| Part | File | What it does |
|---|---|---|
| Spec | `src/domain/spec/design-spec.ts` | The description's types: room, ceilings, wardrobes. Versioned (`specVersion: 1`). |
| Codec | `src/infrastructure/serialization/design-spec-codec.ts` | `parseDesignSpec` checks a spec (every problem with its path); `designSpecJsonSchema()` publishes its JSON Schema, generated from the same definition. |
| Interpreter | `src/application/spec/build-from-spec.ts` | `buildFromSpec(spec, id)` builds it: `{ ok, project, report }` or `{ ok: false, problems }`. Nothing half-built. |
| Report | `src/application/spec/describe-scene.ts` | `describeScene(scene)`: the design as a carpenter describes it, in the spec's terms. Versioned (`reportVersion: 1`). |

## The spec

```json
{
  "specVersion": 1,
  "name": "Under the stairs",
  "room": { "width": 380, "depth": 115, "height": 260, "openings": [{ "wall": 4, "kind": "door", "width": 80 }] },
  "ceilings": [{ "wall": 1, "shape": "landing", "points": [[95, 205], [185, 205], [320, 105], [380, 105]] }],
  "wardrobes": [{ "against": 1, "fill": true, "for": { "short": 20, "pants": 10 } }]
}
```

- Centimetres. Walls are numbered from 1: 1 at the back (the wardrobe wall), 2 right, 3 front, 4 left.
- `from` along a wall is measured inside the room from the wall's left end, as you face the wall.
- `room`: a built-in room (`template`) or a rectangle (`width` × `depth`), wall `height` and `thickness`, `openings`.
- `ceilings`: what comes down along a wall (`shape`), optionally with its own `points` and `depth`.
- `wardrobes`: `against` a wall, `fill` its free stretch (default without a `width`) or stand at `from`;
  `width`, `height`, `depth`, `shape`; `for` what it should hold, planned by Auto design.
- Allowed names come from the registries (`STUDIO_TEMPLATES`, `CEILING_SHAPES`, `SHAPE_TEMPLATES`,
  `POSSESSIONS`). Add an entry there and the spec, its schema and the tests follow.

## The report

Walls with inside lengths and openings; ceilings with their points; each wardrobe with the wall it stands
against and where, its size and top, sections and fittings, gaps (left, right, back, front, top), what it holds
of what it was asked for, and warnings (for example under 60 cm in front for hinged doors). An agent reads it to
check its work and adjust the spec.

## Storing designs (backend)

- What is stored is the ordinary **project document** (`project-codec.ts`) with a **revision**, through
  `ProjectRepository` (`application/ports/project-repository.ts`): IndexedDB today; the HTTP adapter is
  described in `src/infrastructure/persistence/http/README.md`. A design built from a spec is saved like any
  other, and conflicting saves are refused by revision.
- The spec and the report are plain, versioned JSON with a checked shape, so a backend can store them beside
  the project (the request that made it, and what it became) and validate them with the same rules
  (`parseDesignSpec`, `designSpecJsonSchema`). A saved design reopens to the same report (tested).

## Next

1. A link that opens a design from a spec, and the same tools in the open page (WebMCP where browsers offer it).
2. An MCP server running the interpreter headless, answering with the report and a link to the design.

Known gap: Auto design plans a shaped wardrobe with its own sections, as in the editor, so a wardrobe filling
the wall under stairs loses the sections that followed the stairs' steps once it is planned.
