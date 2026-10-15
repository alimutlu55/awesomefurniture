"""Generate runtime oak maps. Requires Pillow and NumPy; source/licence: public/textures/MANIFEST.md.

Colour grading matches the original browser canvas formula, before filtering to reduce aliasing.
Run from the repository root. Outputs are committed; Python is not needed to build or run the app.
"""
from pathlib import Path
import numpy as np
from PIL import Image

OUTPUT = Path('src/presentation/viewport/textures')
OUTPUT.mkdir(parents=True, exist_ok=True)
for source in sorted(Path('public/textures').glob('*/*.jpg')):
    image = Image.open(source)
    colour = '_diff_' in source.name
    normal = '_nor_gl_' in source.name
    if colour:
        pixels = np.array(image, dtype=np.float64)
        luminance = pixels[:, :, 0] * .2126 + pixels[:, :, 1] * .7152 + pixels[:, :, 2] * .0722
        if 'veneer' in source.name:
            value = np.clip(235 + (luminance - luminance.mean()) * 2.2, 0, 255)
            pixels = np.stack([value * 1.06, value * .96, value * .9], axis=2)
        else:
            pixels = (luminance[:, :, None] + (pixels - luminance[:, :, None]) * .72) * (150 / luminance.mean())
        image = Image.fromarray(np.rint(np.clip(pixels, 0, 255)).astype('uint8'))
    # Roughness needs less spatial detail; high-quality normals keep compression error near one RGB level.
    size = 512 if '_rough_' in source.name else 1024
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    target = OUTPUT / source.name.replace('_2k.jpg', '.webp')
    image.save(target, quality=98 if normal else 90 if colour else 85, method=6)
    print(f'{target}: {target.stat().st_size:,} bytes')
