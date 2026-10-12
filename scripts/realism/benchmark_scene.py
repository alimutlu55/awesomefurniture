"""Photographic benchmark for the wardrobe editor (docs/photorealism-handoff.md, phase 1).

Builds the empty default wardrobe (200 x 230 x 60 cm) in a plain room, with the same construction as
the app's frame renderer (src/presentation/viewport/frame-geometry.ts), and renders it with Cycles.

Run from the repository root:
    blender -b --factory-startup -P scripts/realism/benchmark_scene.py -- \
        --out docs/realism-reference/benchmark-cycles.jpg [--samples 256] [--scale 50] [--blend out.blend]

Writes the image and, beside it, `<out>.camera.json`: the camera in app coordinates (centimetres, y up,
the wardrobe's front towards +z) so the browser renderers can reproduce the same view.

Everything is in centimetres until `M` converts it, once, at the Blender boundary.
"""
import argparse
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TEXTURES = os.path.join(ROOT, 'public', 'textures')

# Product dimensions (src/domain/wardrobe/catalog.js: PANEL, PLINTH) and the default wardrobe.
PANEL, PLINTH, BACK = 1.8, 8.0, 0.6
W, H, D = 200.0, 230.0, 60.0
# Tall enough that, as in the target, the frame shows wall above the wardrobe and no ceiling.
ROOM = {'width': 400.0, 'height': 520.0, 'depth': 480.0}
BEVEL = 0.15  # 1.5 mm: a sanded, lacquered board edge, not a rounded one.
M = 0.01      # centimetres to metres


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--out', default=os.path.join(ROOT, 'docs', 'realism-reference', 'benchmark-cycles.jpg'))
    p.add_argument('--samples', type=int, default=256)
    p.add_argument('--scale', type=int, default=50, help='resolution percentage of 1290 x 2796 (an iPhone screen)')
    p.add_argument('--blend', default='')
    return p.parse_args(argv)


# --- Geometry -------------------------------------------------------------------------------------
# App coordinates: x across, y up, z towards the viewer; the wardrobe's back is at z = -D/2.
# Blender: x across, y away from the viewer, z up. So blender = (x, -z, y).
def to_blender(x, y, z):
    return Vector((x * M, -z * M, y * M))


def board(name, size, centre, grain, material, offset, bevel=True):
    """A box board, size (x, y, z) and centre in app centimetres. UVs are in metres (the textures are
    1 m and 1.2 m tiles), with u along `grain` ('x', 'y' or 'z') on every face that contains it, so the
    grain runs the length of the board as on real veneered boards. `offset` shifts the UVs, so boards
    cut from the same sheet do not repeat each other."""
    sx, sy, sz = size
    cx, cy, cz = centre
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = to_blender(cx + v.co.x * sx, cy + v.co.z * sy, cz - v.co.y * sz)
    uv = bm.loops.layers.uv.new('UVMap')
    axis = {'x': 0, 'y': 2, 'z': 1}  # app axis -> blender component
    for face in bm.faces:
        n = face.normal
        normal_axis = max(range(3), key=lambda i: abs(n[i]))
        in_face = [i for i in range(3) if i != normal_axis]
        g = axis[grain]
        u_axis = g if g in in_face else in_face[0]
        v_axis = [i for i in in_face if i != u_axis][0]
        for loop in face.loops:
            co = loop.vert.co
            loop[uv].uv = (co[u_axis] + offset[0], co[v_axis] + offset[1])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new('edge', 'BEVEL')
        mod.width = BEVEL * M
        mod.segments = 3
        mod.limit_method = 'ANGLE'
        mod.harden_normals = True
        obj.data.shade_smooth()
    return obj


def wardrobe(veneer, back):
    """The frame as frame-geometry.ts builds it, for a regular top."""
    inner = W - 2 * PANEL
    # Sides: full height under the top board, full depth.
    board('side_left', (PANEL, H - PANEL, D), (-W / 2 + PANEL / 2, (H - PANEL) / 2, 0), 'y', veneer, (0.13, 0.41))
    board('side_right', (PANEL, H - PANEL, D), (W / 2 - PANEL / 2, (H - PANEL) / 2, 0), 'y', veneer, (0.57, 0.08))
    # Top across the full width; bottom between the sides, 1 cm short of the full depth.
    board('top', (W, PANEL, D), (0, H - PANEL / 2, 0), 'x', veneer, (0.31, 0.66))
    board('bottom', (inner, PANEL, D - 1), (0, PLINTH + PANEL / 2, 0), 'x', veneer, (0.72, 0.29))
    # Back: a thin board set into the frame, from the plinth to the top.
    board('back', (inner, H - PANEL - PLINTH, BACK), (0, PLINTH + (H - PANEL - PLINTH) / 2, -D / 2 + BACK / 2), 'y', back, (0.05, 0.5))
    # Plinth: recessed 4 cm at the front, 2 cm at the back.
    board('plinth', (inner, PLINTH, D - 6), (0, PLINTH / 2, -1), 'x', back, (0.9, 0.12))


def room(materials):
    rw, rh, rd = ROOM['width'], ROOM['height'], ROOM['depth']
    back_z = -D / 2  # the wardrobe stands against the back wall
    t = 10.0
    board('floor', (rw, 2, rd), (0, -1, back_z + rd / 2), 'x', materials['floor'], (0, 0), bevel=False)
    board('back_wall', (rw, rh, t), (0, rh / 2, back_z - t / 2), 'x', materials['wall'], (0, 0), bevel=False)
    # The ceiling bounces light but stays out of the picture, as in the target.
    board('ceiling', (rw, t, rd), (0, rh + t / 2, back_z + rd / 2), 'x', materials['wall'], (0, 0), bevel=False).visible_camera = False
    board('right_wall', (t, rh, rd), (rw / 2 + t / 2, rh / 2, back_z + rd / 2), 'z', materials['wall'], (0, 0), bevel=False)
    # Left wall with a tall window, the room's daylight: 120 wide, sill 60, head 230, 60 cm from the back.
    win = {'from': 60.0, 'width': 120.0, 'sill': 60.0, 'head': 230.0}
    x = -rw / 2 - t / 2
    z0, z1 = back_z + win['from'], back_z + win['from'] + win['width']
    board('left_wall_back', (t, rh, z0 - back_z), (x, rh / 2, (back_z + z0) / 2), 'z', materials['wall'], (0, 0), bevel=False)
    board('left_wall_front', (t, rh, back_z + rd - z1), (x, rh / 2, (z1 + back_z + rd) / 2), 'z', materials['wall'], (0, 0), bevel=False)
    board('left_wall_sill', (t, win['sill'], z1 - z0), (x, win['sill'] / 2, (z0 + z1) / 2), 'z', materials['wall'], (0, 0), bevel=False)
    board('left_wall_head', (t, rh - win['head'], z1 - z0), (x, (rh + win['head']) / 2, (z0 + z1) / 2), 'z', materials['wall'], (0, 0), bevel=False)
    # Skirting on the back wall either side of the wardrobe, and along the side walls.
    sk_h, sk_d = 8.0, 1.5
    for name, sx, cx in (('skirting_left', rw / 2 - W / 2, -(rw / 2 + W / 2) / 2), ('skirting_right', rw / 2 - W / 2, (rw / 2 + W / 2) / 2)):
        board(name, (sx, sk_h, sk_d), (cx, sk_h / 2, back_z + sk_d / 2), 'x', materials['skirting'], (0, 0))
    board('skirting_side', (sk_d, sk_h, rd), (rw / 2 - sk_d / 2, sk_h / 2, back_z + rd / 2), 'z', materials['skirting'], (0, 0))
    return win


# --- Materials ------------------------------------------------------------------------------------
def image(nodes, name, colour):
    path = os.path.join(TEXTURES, name)
    node = nodes.new('ShaderNodeTexImage')
    node.image = bpy.data.images.load(path, check_existing=True)
    node.image.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
    node.interpolation = 'Cubic'
    return node


def textured(name, asset, tint, roughness_range, normal_strength, coat=0.0, value=1.0, saturation=1.0, hue=0.5, contrast=0.0):
    """Principled material from a Poly Haven set: colour (sRGB) graded towards `tint`, roughness and
    OpenGL normal (linear data)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes['Principled BSDF']
    diff = image(nodes, f'{asset}/{asset}_diff_2k.jpg', True)
    rough = image(nodes, f'{asset}/{asset}_rough_2k.jpg', False)
    nor = image(nodes, f'{asset}/{asset}_nor_gl_2k.jpg', False)
    hsv = nodes.new('ShaderNodeHueSaturation')
    hsv.inputs['Hue'].default_value = hue
    hsv.inputs['Saturation'].default_value = saturation
    hsv.inputs['Value'].default_value = value
    links.new(diff.outputs['Color'], hsv.inputs['Color'])
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs['B'].default_value = (*tint, 1.0)
    # Grain contrast: the target's rift-cut oak reads as clear vertical streaks.
    grade = nodes.new('ShaderNodeBrightContrast')
    grade.inputs['Contrast'].default_value = contrast
    links.new(hsv.outputs['Color'], grade.inputs['Color'])
    links.new(grade.outputs['Color'], mix.inputs['A'])
    links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    rng = nodes.new('ShaderNodeMapRange')
    rng.inputs['To Min'].default_value, rng.inputs['To Max'].default_value = roughness_range
    links.new(rough.outputs['Color'], rng.inputs['Value'])
    links.new(rng.outputs['Result'], bsdf.inputs['Roughness'])
    nmap = nodes.new('ShaderNodeNormalMap')
    nmap.inputs['Strength'].default_value = normal_strength
    links.new(nor.outputs['Color'], nmap.inputs['Color'])
    links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    if coat:
        bsdf.inputs['Coat Weight'].default_value = coat
        bsdf.inputs['Coat Roughness'].default_value = 0.35
    return mat


def plain(name, colour, roughness, bump=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*colour, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    if bump:
        # Plaster: a faint, fine unevenness.
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 220.0
        b = nodes.new('ShaderNodeBump')
        b.inputs['Strength'].default_value = bump
        b.inputs['Distance'].default_value = 0.002
        links.new(noise.outputs['Fac'], b.inputs['Height'])
        links.new(b.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def srgb(hex_colour):
    """A hex colour as linear RGB for Blender."""
    out = []
    for i in (1, 3, 5):
        c = int(hex_colour[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# --- Light and camera -----------------------------------------------------------------------------
def lighting(win):
    world = bpy.data.worlds.new('world')
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*srgb('#f1ece4'), 1.0)
    # Daylight from behind the camera, through the open front of the room.
    bg.inputs['Strength'].default_value = 0.25
    # Low afternoon sun through the left window: the streaks on the floor and walls in the target.
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 1.4
    sun.data.angle = math.radians(2.5)
    sun.data.color = srgb('#fff1dc')
    sun.rotation_euler = (math.radians(62), 0, math.radians(-100))
    bpy.context.collection.objects.link(sun)
    # Skylight filling the window opening, facing into the room: the soft, broad daylight.
    sky = bpy.data.objects.new('window_sky', bpy.data.lights.new('window_sky', 'AREA'))
    sky.data.shape = 'RECTANGLE'
    sky.data.size = win['width'] * M
    sky.data.size_y = (win['head'] - win['sill']) * M
    sky.data.energy = 110.0
    sky.data.color = srgb('#f6f4ef')
    zc = -D / 2 + win['from'] + win['width'] / 2
    sky.location = to_blender(-ROOM['width'] / 2 - 12, (win['sill'] + win['head']) / 2, zc)
    # An area light shines along its local -Z: turned -90 degrees about Y it faces +X, into the room.
    sky.rotation_euler = (0, math.radians(-90), 0)
    bpy.context.collection.objects.link(sky)
    # The key light: a large soft source high up behind the camera, like a tall window behind the
    # photographer. Light from above and in front leaves the underside of the top in shade and the back
    # evenly lit, as in the target.
    key = bpy.data.objects.new('key', bpy.data.lights.new('key', 'AREA'))
    key.data.shape = 'RECTANGLE'
    key.data.size, key.data.size_y = 3.0, 1.6
    key.data.energy = 380.0
    key.data.color = srgb('#fbf7f0')
    key.location = to_blender(-40, 250, D / 2 + 380)
    aim = to_blender(0, 95, -D / 2) - key.location
    key.rotation_euler = aim.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.collection.objects.link(key)


def camera(scene):
    """Near-front, eye level, the wardrobe filling about four fifths of a portrait phone frame, as in the
    target image. Returns the camera in app coordinates."""
    lens, sensor = 50.0, 36.0
    # Level (vertical edges stay parallel, as in the target), a little below the wardrobe's middle, and
    # from far enough back with a longer lens that its inside reads shallow, as in the target; it spans
    # about 80 % of the frame's width.
    eye = {'x': 0.0, 'y': 104.0, 'z': D / 2 + 345.0}
    look = {'x': 0.0, 'y': 104.0, 'z': -D / 2}
    cam = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
    cam.data.lens = lens
    cam.data.sensor_fit = 'HORIZONTAL'
    cam.data.sensor_width = sensor
    cam.location = to_blender(eye['x'], eye['y'], eye['z'])
    direction = to_blender(look['x'], look['y'], look['z']) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    aspect = scene.render.resolution_y / scene.render.resolution_x
    horizontal = 2 * math.atan(sensor / 2 / lens)
    vertical = 2 * math.atan(math.tan(horizontal / 2) * aspect)
    return {'position': eye, 'target': look, 'verticalFovDeg': math.degrees(vertical), 'aspect': 1 / aspect}


def render_settings(scene, samples, scale):
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = 'GPU'
    except Exception:
        scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 12
    scene.render.resolution_x, scene.render.resolution_y = 1290, 2796
    scene.render.resolution_percentage = scale
    # Khronos PBR Neutral keeps material colours true (AgX bleaches bright oak towards pink), and Three.js
    # has the same curve (NeutralToneMapping), so the browser renderers can match this benchmark.
    scene.view_settings.view_transform = 'Khronos PBR Neutral'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = -2.0


def main():
    a = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    render_settings(scene, a.samples, a.scale)
    veneer = textured('oak_veneer', 'oak_veneer_02', srgb('#efe6d8'), (0.38, 0.55), 0.25, coat=0.2, value=0.95, saturation=0.4, hue=0.512, contrast=1.1)
    back = textured('oak_veneer_back', 'oak_veneer_02', srgb('#ece2d3'), (0.42, 0.6), 0.2, coat=0.15, value=0.93, saturation=0.4, hue=0.512, contrast=1.1)
    materials = {
        'floor': textured('oak_floor', 'oak_wood_planks', srgb('#f3ebdf'), (0.3, 0.55), 0.45, coat=0.1, value=1.7, saturation=0.4, hue=0.51, contrast=-0.2),
        'wall': plain('plaster', srgb('#e2dbd1'), 0.92, bump=0.08),
        'skirting': plain('skirting', srgb('#f3f0ea'), 0.45),
    }
    wardrobe(veneer, back)
    win = room(materials)
    lighting(win)
    view = camera(scene)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    scene.render.filepath = os.path.abspath(a.out)
    # A JPEG keeps the committed benchmark small; PNG for lossless comparisons.
    if a.out.lower().endswith(('.jpg', '.jpeg')):
        scene.render.image_settings.file_format = 'JPEG'
        scene.render.image_settings.quality = 92
    else:
        scene.render.image_settings.file_format = 'PNG'
    if a.blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a.blend))
    bpy.ops.render.render(write_still=True)
    record = {'camera': view, 'samples': a.samples, 'resolution': [scene.render.resolution_x * a.scale // 100, scene.render.resolution_y * a.scale // 100],
              'blender': bpy.app.version_string, 'device': scene.cycles.device, 'view_transform': scene.view_settings.view_transform}
    with open(os.path.abspath(a.out) + '.camera.json', 'w') as f:
        json.dump(record, f, indent=2)
    print('wrote', a.out)


main()
