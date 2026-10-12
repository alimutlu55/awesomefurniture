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
def tshirt(src):
    """'T-Shirt On Hanger' by FeisalKassim: a pressed tee on a plastic hanger. Scaled so the hanger is 42 cm."""
    reset()
    meshes = load(os.path.join(src, 'tshirt.glb'))
    shirt = max(meshes, key=lambda o: len(o.data.polygons) if bounds([o])[0].z < -500 else 0)
    hanger = join([o for o in meshes if o is not shirt], 'hanger')
    shirt = join([shirt], 'garment')
    lo, hi = bounds([hanger])
    s = 0.42 / (hi.x - lo.x)
    transform([shirt, hanger], Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -hi.z))))
    transform([shirt, hanger], Matrix.Scale(s, 4))
    bake_ao(shirt)
    export([shirt, hanger], 'tshirt')


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


def worn_garment(src, file, out, height, depth, keep_material=False):
    """A garment modelled as worn on an invisible body, hung on the wooden hanger instead: `height` tall from the
    shoulders down, the body's depth pressed to `depth` (metres). Garments keep their own material (a pattern) only
    where `keep_material`; otherwise the app colours them."""
    reset()
    cloth = join(load(os.path.join(src, file + '.glb')), 'garment')
    lo, hi = bounds([cloth])
    s = height / (hi.z - lo.z)
    transform([cloth], Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -hi.z))))
    transform([cloth], Matrix.Diagonal((s, depth / (hi.y - lo.y), s, 1)))
    transform([cloth], Matrix.Translation(Vector((0, 0, -0.105))))    # the hook stands above the collar
    decimate(cloth, 9000)
    wood = wooden_hanger(src)
    bake_ao(cloth)
    shrink_images(1024)
    export([cloth, wood], out, materials='EXPORT' if keep_material else 'PLACEHOLDER')


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
    src = sys.argv[sys.argv.index('--') + 1]
    tshirt(src)
    sweater(src)
    oxford(src)
    # Long: a trench coat, 1.15 m from the shoulders, coloured by the app.
    worn_garment(src, 'trench', 'trench', 1.15, 0.10)
    # A short-sleeved shirt in its own colour-blocked fabric, 0.72 m.
    worn_garment(src, 'checkshirt', 'checkshirt', 0.72, 0.07, keep_material=True)
    # Women's shoes: a pair of pumps (toes to -X as downloaded), a scanned ankle boot (toe to +Y).
    shoe_model(src, 'pumps', 'pumps', 0.25, 90)
    shoe_model(src, 'ankleboots', 'ankleboot', 0.25, 180)


main()
