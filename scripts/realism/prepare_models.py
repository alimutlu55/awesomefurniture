"""Prepares downloaded 3D models of real items for the app (sources and licences: public/models/MANIFEST.md).

Nothing here is modelled: each model is only brought to real size, given the app's orientation and origin,
reduced for phones, and saved as a small GLB. Garments also get the ambient occlusion of their folds baked into
vertex colours, so the folds read in the app's real-time light.

Run from the repository root, with the downloaded files in a folder of their own:
    blender -b --factory-startup -P scripts/realism/prepare_models.py -- <downloads folder>

Blender is Z-up in metres; glTF (and the app) is Y-up, and the app scales by 100 to centimetres.
- Garments: the hanger's hook top at the origin, shoulders along X, hanging down -Z. Meshes 'garment', 'hanger'.
- Shoes: one shoe, the sole's centre at the origin, the toe towards -Y (the room, in the app). Mesh 'shoe'.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'models')


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load(path):
    """Imports a glTF and returns its meshes, transforms applied, parented to nothing."""
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o not in before and o.type == 'MESH']
    for o in meshes:
        world = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = world
    select(meshes)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in [o for o in bpy.context.scene.objects if o.type == 'EMPTY']:
        bpy.data.objects.remove(o)
    return meshes


def select(objs):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def join(objs, name):
    select(objs)
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = obj.data.name = name
    return obj


def bounds(objs):
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def transform(objs, matrix):
    for o in objs:
        o.data.transform(matrix)
        o.data.update()


def decimate(obj, faces):
    if len(obj.data.polygons) <= faces:
        return
    mod = obj.modifiers.new('decimate', 'DECIMATE')
    mod.ratio = faces / len(obj.data.polygons)
    select([obj])
    bpy.ops.object.modifier_apply(modifier=mod.name)


def bake_ao(garment):
    """Ambient occlusion of the folds into vertex colours: within 10 cm, as cloth shades itself."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64
    scene.world = scene.world or bpy.data.worlds.new('w')
    scene.world.light_settings.distance = 0.1
    garment.data.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT')
    garment.data.color_attributes.active_color = garment.data.color_attributes['ao']
    if not garment.data.materials:
        garment.data.materials.append(bpy.data.materials.new('garment'))
    scene.render.bake.target = 'VERTEX_COLORS'
    select([garment])
    bpy.ops.object.bake(type='AO')
    # Folds shade, but never to black: occlusion is lifted to between 45 % and full light.
    for c in garment.data.color_attributes['ao'].data:
        r, g, b, a = c.color
        c.color = (0.45 + 0.55 * r, 0.45 + 0.55 * g, 0.45 + 0.55 * b, a)


def shrink_images(size):
    for img in bpy.data.images:
        if img.size[0] > size:
            img.scale(size, size)


def export(objs, name, materials='PLACEHOLDER'):
    select(objs)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_materials=materials, export_image_format='JPEG', export_jpeg_quality=85,
                              export_vertex_color='ACTIVE')
    print('wrote', path, os.path.getsize(path) // 1024, 'KB', sum(len(o.data.polygons) for o in objs), 'faces')


# --- Items ----------------------------------------------------------------------------------------
def sweater(src):
    """'sweater woman' by Rouker, worn on an invisible body: flattened as a sweater hangs, reduced, and put on
    roh3d's 'Wood Clothes Hanger'."""
    reset()
    knit = join(load(os.path.join(src, 'sweater.glb')), 'garment')
    lo, hi = bounds([knit])
    # Centimetres to metres; centred; the body's depth pressed to a hanging garment's.
    transform([knit], Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -hi.z))))
    transform([knit], Matrix.Diagonal((0.01, 0.0035, 0.01, 1)))
    decimate(knit, 9000)
    wood = join(load(os.path.join(src, 'hanger.glb')), 'hanger')
    lo, hi = bounds([wood])
    s = 0.44 / (hi.x - lo.x)
    transform([wood], Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -hi.z))))
    transform([wood], Matrix.Scale(s, 4))
    # The hook stands above the collar: the hanger's arms sit just inside the shoulders.
    hook = 0.105
    transform([knit], Matrix.Translation(Vector((0, 0, -hook))))
    bake_ao(knit)
    export([knit, wood], 'sweater')


def wooden_hanger(src):
    """roh3d's 'Wood Clothes Hanger', 44 cm, its hook's top at the origin."""
    wood = join(load(os.path.join(src, 'hanger.glb')), 'hanger')
    lo, hi = bounds([wood])
    transform([wood], Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -hi.z))))
    transform([wood], Matrix.Scale(0.44 / (hi.x - lo.x), 4))
    return wood


def hang_garment(src, file, out, length, keep_fabric=True, drop=()):
    """A garment modelled as worn (arms out, around an invisible body) hung on the wooden hanger as it would be in a
    wardrobe: brought to `length` metres from collar to hem, its body pressed flat, and each sleeve turned down at
    the shoulder to hang beside the body, blended over the shoulder so the cloth does not tear. Pockets, buttons
    and cuffs move with their sleeve or stay with the body. The garment's design, seams and fabric are kept."""
    reset()
    # `drop`: materials of inner layers (a garment's inside, modelled as a second skin) that are left out: pressed
    # flat they would show through, and enclosed they bake black.
    parts = [o for o in load(os.path.join(src, file + '.glb')) if len(o.data.polygons) > 50 and not any(m and m.name in drop for m in o.data.materials)]
    for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and o not in parts]:
        bpy.data.objects.remove(o)
    cloth = join(parts, 'garment')
    lo, hi = bounds([cloth])
    s = length / (hi.z - lo.z)
    transform([cloth], Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -hi.z))))
    transform([cloth], Matrix.Diagonal((s, s * 0.5, s, 1)))                 # the body pressed half flat, as it hangs
    # Sleeves: measure how far each is raised, then turn it down to 84 degrees below horizontal.
    pivot_x, pivot_z = 0.2, -0.07
    smooth = lambda a, b, x: max(0.0, min(1.0, (x - a) / (b - a))) ** 2 * (3 - 2 * max(0.0, min(1.0, (x - a) / (b - a))))
    for side in (-1, 1):
        far = [v.co for v in cloth.data.vertices if v.co.x * side > 0.34]
        if not far:
            continue
        current = math.atan2(sum(v.z for v in far) / len(far) - pivot_z, sum(v.x * side for v in far) / len(far) - pivot_x)
        turn = math.radians(-84) - current
        for v in cloth.data.vertices:
            # A sleeve point lies out from the shoulder and along the arm; a flared hem lies further below it.
            angle = math.atan2(v.co.z - pivot_z, v.co.x * side - pivot_x)
            w = smooth(0.13, 0.27, v.co.x * side) * smooth(current - math.radians(40), current - math.radians(22), angle)
            if w <= 0:
                continue
            dx, dz, a = v.co.x * side - pivot_x, v.co.z - pivot_z, turn * w
            nx, nz = dx * math.cos(a) - dz * math.sin(a), dx * math.sin(a) + dz * math.cos(a)
            v.co.x, v.co.z = (pivot_x + nx) * side, pivot_z + nz
            v.co.y -= 0.025 * w                                              # sleeves fall a little in front
    cloth.data.update()
    # One fabric: collar, cuffs and lining take the material covering most of the garment, so the app colours the
    # whole garment as one cloth.
    mats = list(cloth.data.materials)
    main = max(range(len(mats)), key=lambda i: sum(1 for p in cloth.data.polygons if p.material_index == i))
    for p in cloth.data.polygons:
        p.material_index = 0
    cloth.data.materials.clear()
    # Where the app colours the garment, a plain cloth; else the garment's own photographed fabric.
    cloth.data.materials.append(mats[main] if keep_fabric else bpy.data.materials.new('cloth'))
    decimate(cloth, 12000)
    wood = wooden_hanger(src)
    transform([wood], Matrix.Translation(Vector((0, 0, 0.07))))              # the hook's top 7 cm above the collar
    lo, hi = bounds([wood])
    transform([cloth, wood], Matrix.Translation(Vector((0, 0, -hi.z))))
    cloth.data.shade_smooth()
    bake_ao(cloth)
    shrink_images(1024)
    export([cloth, wood], out, materials='EXPORT' if keep_fabric else 'PLACEHOLDER')


def shoe_model(src, file, out, length, turn):
    """A shoe or a pair: turned `turn` degrees about Z so the toes point to -Y, the soles' centre at the origin,
    `length` metres long."""
    reset()
    shoe = join(load(os.path.join(src, file + '.glb')), 'shoe')
    transform([shoe], Matrix.Rotation(math.radians(turn), 4, 'Z'))
    lo, hi = bounds([shoe])
    transform([shoe], Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))))
    transform([shoe], Matrix.Scale(length / (hi.y - lo.y), 4))
    decimate(shoe, 5000)
    shrink_images(512)
    export([shoe], out, materials='EXPORT')


def oxford(src):
    """'Old Oxford Shoe' by inciprocal.com, a scan: straightened, toe to -Y, sole on the floor, reduced."""
    reset()
    shoe = join(load(os.path.join(src, 'oxford.glb')), 'shoe')
    pts = [v.co for v in shoe.data.vertices]
    cx, cy = sum(p.x for p in pts) / len(pts), sum(p.y for p in pts) / len(pts)
    sxx = sum((p.x - cx) ** 2 for p in pts); syy = sum((p.y - cy) ** 2 for p in pts); sxy = sum((p.x - cx) * (p.y - cy) for p in pts)
    angle = 0.5 * math.atan2(2 * sxy, sxx - syy)                    # the shoe's length in the floor plane
    transform([shoe], Matrix.Translation(Vector((-cx, -cy, 0))))
    transform([shoe], Matrix.Rotation(-angle + math.pi / 2, 4, 'Z'))  # length along Y
    # The heel stands taller than the toe: put the toe at -Y.
    ys = [v.co.y for v in shoe.data.vertices]
    mid = (max(ys) + min(ys)) / 2
    high = lambda f: max((v.co.z for v in shoe.data.vertices if f(v.co.y)), default=0)
    if high(lambda y: y < mid) > high(lambda y: y >= mid):
        transform([shoe], Matrix.Rotation(math.pi, 4, 'Z'))
    lo, hi = bounds([shoe])
    transform([shoe], Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))))
    s = 0.29 / (hi.y - lo.y)                                            # a 29 cm shoe
    transform([shoe], Matrix.Scale(s, 4))
    decimate(shoe, 4000)
    shrink_images(512)
    export([shoe], 'oxford', materials='EXPORT')


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    src, only = args[0], set(args[1:])
    if only:
        for name in only:
            {'dressshirt': lambda: hang_garment(src, 'dressshirt', 'dressshirt', 0.80, keep_fabric=False, drop=('Material3579',)), 'tancoat': lambda: hang_garment(src, 'tancoat', 'tancoat', 1.05)}[name]()
        return
    sweater(src)
    oxford(src)
    # Women's shoes: a pair of pumps (toes to -X as downloaded), a scanned ankle boot (toe to +Y).
    shoe_model(src, 'pumps', 'pumps', 0.25, 90)
    shoe_model(src, 'ankleboots', 'ankleboot', 0.25, 180)
    # Real garments modelled as worn, hung: a pressed dress shirt and a long double-breasted coat.
    hang_garment(src, 'dressshirt', 'dressshirt', 0.80, keep_fabric=False, drop=('Material3579',))
    hang_garment(src, 'tancoat', 'tancoat', 1.05)


main()
