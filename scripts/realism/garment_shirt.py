"""A long-sleeved shirt, built and draped in Blender, for the wardrobe's rails.

Run from the repository root:
    blender -b --factory-startup -P scripts/realism/garment_shirt.py -- --preview <out.jpg> [--glb <out.glb>] [--frames 90]

The shirt is one closed garment, as it is sewn: a torso cut with a shirt-tail hem (longer at front and back), two
armholes, set-in sleeves joined to them seam to seam, a collar (stand and fall) and a button placket. It starts
on the hanger's shoulders with a hanging garment's depth; Blender's cloth simulation (cotton weight, self-collision,
the hanger as a collider, the shoulders resting on the hanger) lets it settle under gravity, so the drape and folds
come from the fabric, not from modelling. Metres, Z up, the shirt's front towards -Y, the hanger's hook top at the
origin.
"""
import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# Pattern measurements (metres): a men's M shirt as it hangs.
SHOULDER = 0.23     # half the shoulder width, seam to seam
CHEST = 0.27        # half the chest width
LENGTH = 0.78       # collar seam to hem at the centre front
TAIL = 0.06         # how much shorter the hem is at the sides
DEPTH_TOP, DEPTH = 0.012, 0.075   # half the garment's depth at the shoulders and lower down, as it hangs
ARMHOLE = 0.24      # armhole depth below the shoulder point
SLEEVE, CUFF = 0.62, 0.042        # sleeve length and cuff radius
NECK_X, NECK_Y = 0.072, 0.055     # neck opening, half-axes
STEP = 0.011        # cloth resolution
HANGER_TOP, HANGER_DROP = -0.085, 0.06   # hanger arms' top below the hook, and how far they fall to the tips


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--preview', default='')
    p.add_argument('--glb', default='')
    p.add_argument('--frames', type=int, default=90)
    return p.parse_args(argv)


def shoulder_line(x):
    """Height of the hanger's top at x: the shirt's shoulders rest along it."""
    return HANGER_TOP - HANGER_DROP * min(1.0, abs(x) / SHOULDER) ** 1.4


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def torso(bm, uv):
    """The body: rings from the shoulders down, open at the armholes and the neck, cut to a shirt-tail hem."""
    n = int(2 * math.pi * CHEST / STEP) // 4 * 4
    rows = int(LENGTH / STEP)
    grid = []
    for r in range(rows + 1):
        t = r / rows
        rx = SHOULDER + (CHEST - SHOULDER) * smooth(0, .3, t)
        ry = DEPTH_TOP + (DEPTH - DEPTH_TOP) * smooth(0, .35, t)
        ring = []
        for k in range(n):
            a = 2 * math.pi * k / n
            x, y = rx * math.cos(a), ry * math.sin(a)
            # Each column runs to the shirt-tail hem: longest at the centre front and back, shorter at the sides.
            hem = shoulder_line(0) - LENGTH + TAIL * abs(math.cos(a)) ** 1.5
            z = shoulder_line(x) * (1 - t) + hem * t
            ring.append(bm.verts.new((x, y, z)))
        grid.append(ring)
    faces = {}
    for r in range(rows):
        for k in range(n):
            q = (grid[r][k], grid[r][(k + 1) % n], grid[r + 1][(k + 1) % n], grid[r + 1][k])
            faces[r, k] = bm.faces.new(q)
    # Openings: the armholes at the sides (the neck stays open where the shoulders are closed).
    arm_rows = int(ARMHOLE / STEP)
    arm_cols = int(n * 0.075)
    remove = set()
    for (r, k), f in faces.items():
        a = 2 * math.pi * (k + .5) / n
        side = min(abs(a), abs(a - math.pi), abs(a - 2 * math.pi))
        if 1 <= r < arm_rows and side * n / (2 * math.pi) < arm_cols:
            remove.add(f)
    bmesh.ops.delete(bm, geom=list(remove), context='FACES')
    # Close the top (the shoulder seams) except for the neck.
    top = grid[0]
    for k in range(n // 2):
        back, front = top[k], top[n - 1 - k]
        nxt_b, nxt_f = top[k + 1], top[n - 2 - k]
        if abs(back.co.x) > NECK_X and abs(nxt_b.co.x) > NECK_X and back.is_valid and front.is_valid:
            try:
                bm.faces.new((back, nxt_b, nxt_f, front))
            except ValueError:
                pass
    return grid, n, arm_rows, arm_cols


def armhole_loop(bm, side):
    """The boundary loop of the armhole on one side (+1 right, -1 left), ordered."""
    edges = [e for e in bm.edges if e.is_boundary and all(v.co.x * side > SHOULDER * .8 for v in e.verts)
             and all(v.co.z > shoulder_line(0) - ARMHOLE - .05 for v in e.verts)]
    verts = {v for e in edges for v in e.verts}
    start = min(verts, key=lambda v: v.co.z)
    loop, prev = [start], None
    while True:
        cur = loop[-1]
        nxt = [o for e in cur.link_edges if e in edges for o in [e.other_vert(cur)] if o is not prev and o not in loop[-2:]]
        if not nxt or nxt[0] is start:
            break
        prev = cur
        loop.append(nxt[0])
    return loop


def sleeve(bm, side):
    """A set-in sleeve: from the armhole loop itself, a tube along the arm hanging a little out from the body,
    tapering to the cuff. Its first ring is the armhole, so the sleeve is sewn in seam to seam."""
    loop = armhole_loop(bm, side)
    c0 = sum((v.co for v in loop), Vector()) / len(loop)
    r0 = sum((v.co - c0).length for v in loop) / len(loop)
    down = Vector((side * math.sin(math.radians(14)), -0.04, -math.cos(math.radians(14)))).normalized()
    across = Vector((side, 0, 0))
    rot = across.rotation_difference(down)
    rings, prev = int(SLEEVE / STEP), loop
    for s in range(1, rings + 1):
        f = s / rings
        r = r0 + (CUFF - r0) * smooth(0, .85, f)
        turn = Matrix.Identity(3).lerp(rot.to_matrix(), smooth(0, .25, f)) if False else rot.to_matrix() if f > .25 else \
            Matrix.Identity(3).to_3x3().lerp(rot.to_matrix(), f / .25)
        centre = c0 + down * (SLEEVE * f) + Vector((side * .02 * smooth(0, .2, f), 0, 0))
        ring = [bm.verts.new(centre + turn @ ((v.co - c0) * (r / r0))) for v in loop]
        for k in range(len(loop)):
            try:
                bm.faces.new((prev[k], prev[(k + 1) % len(loop)], ring[(k + 1) % len(loop)], ring[k]))
            except ValueError:
                pass
        prev = ring
    return prev


def collar(bm):
    """Stand and fall around the neck, open a little at the front."""
    seg, verts = 64, []
    rows = [(0.0, 0.0, -0.006), (0.0, 0.0, 0.03), (0.004, 0.004, 0.034), (0.02, 0.018, 0.0), (0.03, 0.026, -0.03)]
    for dx, dy, dz in rows:
        ring = []
        for k in range(seg + 1):
            a = math.radians(-70 + k * (320 / seg))            # front at -90 left open
            ring.append(bm.verts.new(((NECK_X + dx) * math.cos(a), (NECK_Y + dy) * math.sin(a), HANGER_TOP - .012 + dz)))
        verts.append(ring)
    for a, b in zip(verts, verts[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[k + 1], b[k + 1], b[k]))


def hanger():
    data = bpy.data.curves.new('hanger', 'CURVE')
    data.dimensions, data.bevel_depth, data.bevel_resolution = '3D', 0.009, 4
    sp = data.splines.new('POLY')
    pts = [(x, 0.0, shoulder_line(x) - .009) for x in [SHOULDER * (i / 12 - 1) * 1.02 for i in range(25)]]
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*co, 1)
    wood = bpy.data.objects.new('hanger', data)
    bpy.context.collection.objects.link(wood)
    hook = bpy.data.curves.new('hook', 'CURVE')
    hook.dimensions, hook.bevel_depth = '3D', 0.0022
    sp = hook.splines.new('POLY')
    pts = [(0, 0, HANGER_TOP)] + [(0.022 * math.sin(a), 0, -0.035 + 0.022 * math.cos(a)) for a in [math.radians(d) for d in range(0, 200, 20)]]
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*co, 1)
    metal = bpy.data.objects.new('hook', hook)
    bpy.context.collection.objects.link(metal)
    for o in (wood, metal):
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.convert(target='MESH')
        o.select_set(False)
    return wood, metal


def build():
    bm = bmesh.new()
    torso(bm, None)
    for side in (1, -1):
        sleeve(bm, side)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new('garment')
    bm.to_mesh(mesh)
    bm.free()
    shirt = bpy.data.objects.new('garment', mesh)
    bpy.context.collection.objects.link(shirt)
    # The shoulders rest on the hanger: everything within 3 cm of the shoulder line, inside the hanger's reach.
    pin = shirt.vertex_groups.new(name='pin')
    pin.add([v.index for v in mesh.vertices if abs(v.co.x) < SHOULDER * 1.02 and v.co.z > shoulder_line(v.co.x) - 0.03], 1.0, 'REPLACE')
    cbm = bmesh.new()
    collar(cbm)
    cm = bpy.data.meshes.new('collar')
    cbm.to_mesh(cm)
    cbm.free()
    col = bpy.data.objects.new('collar', cm)
    bpy.context.collection.objects.link(col)
    return shirt, col


def simulate(shirt, wood, frames):
    wood.modifiers.new('collision', 'COLLISION')
    wood.collision.thickness_outer = 0.003
    cloth = shirt.modifiers.new('cloth', 'CLOTH')
    s = cloth.settings
    s.quality = 7
    s.mass = 0.12                                   # cotton poplin, per vertex at 1.1 cm
    s.tension_stiffness = s.compression_stiffness = 22
    s.shear_stiffness = 8
    s.bending_stiffness = 0.35
    s.air_damping = 2.5
    s.vertex_group_mass = 'pin'
    c = cloth.collision_settings
    c.use_self_collision = True
    c.self_distance_min = 0.0028
    c.distance_min = 0.003
    cloth.point_cache.frame_start, cloth.point_cache.frame_end = 1, frames
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, frames
    for f in range(1, frames + 1):
        sc.frame_set(f)
        if f % 15 == 0:
            print('frame', f, flush=True)
    settled = bpy.data.meshes.new_from_object(shirt.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    shirt.modifiers.clear()
    shirt.data = settled


def placket_and_buttons(shirt):
    """A button placket down the centre front, and seven buttons, placed on the settled cloth."""
    me, front = shirt.data, []
    for v in me.vertices:
        if abs(v.co.x) < STEP * .6 and v.co.y < 0 and v.co.z < HANGER_TOP - 0.02:
            front.append(v)
    front.sort(key=lambda v: -v.co.z)
    btn = []
    top = front[0].co.z if front else HANGER_TOP
    for i in range(7):
        z = top - 0.03 - i * 0.105
        near = min(front, key=lambda v: abs(v.co.z - z), default=None)
        if near is None:
            continue
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.0055, depth=0.002, location=near.co + near.normal * 0.0022)
        b = bpy.context.active_object
        b.rotation_euler = near.normal.to_track_quat('Z', 'Y').to_euler()
        btn.append(b)
    if btn:
        for o in bpy.context.selected_objects:
            o.select_set(False)
        for b in btn:
            b.select_set(True)
        bpy.context.view_layer.objects.active = btn[0]
        bpy.ops.object.join()
        btn[0].name = 'buttons'
        return btn[0]
    return None


def finish(shirt):
    """Cloth thickness and a smooth surface; the folds stay as simulated."""
    bpy.context.view_layer.objects.active = shirt
    sol = shirt.modifiers.new('thickness', 'SOLIDIFY')
    sol.thickness, sol.offset = 0.0012, 0
    sub = shirt.modifiers.new('sub', 'SUBSURF')
    sub.levels = sub.render_levels = 1
    shirt.data.shade_smooth()


def fabric(path_hint='stretch_poplin'):
    m = bpy.data.materials.new('poplin')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.72, 0.73, 0.74, 1)
    b.inputs['Roughness'].default_value = 0.78
    b.inputs['Sheen Weight'].default_value = 0.4
    return m


def preview(out, objs):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 520, 720
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.82, 0.8, 0.77, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
    key = bpy.data.objects.new('key', bpy.data.lights.new('key', 'AREA'))
    key.data.size, key.data.energy = 1.6, 70
    key.location = (-0.9, -1.4, 0.5)
    key.rotation_euler = (Vector((0, 0, -0.45)) - key.location).to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(key)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.lens = 55
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.view_settings.view_transform = 'Khronos PBR Neutral'
    sc.render.image_settings.file_format = 'JPEG'
    target = Vector((0, 0, -0.45))
    for i, a in enumerate((0, 40, 90, 140)):
        r = math.radians(a)
        cam.location = target + Vector((math.sin(r), -math.cos(r), 0.12)) * 2.3
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = out.replace('.jpg', f'-{i}.jpg')
        bpy.ops.render.render(write_still=True)


def main():
    a = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    wood, metal = hanger()
    shirt, col = build()
    print('cloth vertices', len(shirt.data.vertices), flush=True)
    simulate(shirt, wood, a.frames)
    buttons = placket_and_buttons(shirt)
    finish(shirt)
    cloth = fabric()
    for o in (shirt, col):
        o.data.materials.append(cloth)
        o.data.shade_smooth()
    wm = bpy.data.materials.new('wood')
    wm.use_nodes = True
    wm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.45, 0.28, 0.15, 1)
    wood.data.materials.append(wm)
    mm = bpy.data.materials.new('chrome')
    mm.use_nodes = True
    mm.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = 1
    mm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .25
    metal.data.materials.append(mm)
    if buttons:
        pm = bpy.data.materials.new('pearl')
        pm.use_nodes = True
        pm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.9, 0.88, 0.84, 1)
        pm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .3
        buttons.data.materials.append(pm)
    if a.preview:
        preview(a.preview, [shirt, col, wood, metal])
    if a.glb:
        bpy.ops.export_scene.gltf(filepath=a.glb, export_format='GLB', export_apply=True)
    print('done', flush=True)


main()
