# Texture manifest

Runtime textures served by the app from `/textures/` (Vite copies `public/` into the build). Downloaded
2026-10-12 from Poly Haven. Licence for all: CC0 (https://polyhaven.com/license), commercial use and
redistribution allowed, no attribution required; credited here anyway.

| Asset | Use | Source | Author | Physical size | Files (2048 × 2048 JPEG) |
| --- | --- | --- | --- | --- | --- |
| Oak Veneer 02 | Cabinet panels | https://polyhaven.com/a/oak_veneer_02 | Jenelle van Heerden | 1.0 m × 1.0 m | `oak_veneer_02/oak_veneer_02_{diff,rough,nor_gl}_2k.jpg` |
| Oak Wood Planks | Floor | https://polyhaven.com/a/oak_wood_planks | Dimitrios Savva | 1.2 m × 1.2 m | `oak_wood_planks/oak_wood_planks_{diff,rough,nor_gl}_2k.jpg` |

Map conventions:

- `diff`: colour, sRGB. `rough`: roughness, linear, single channel. `nor_gl`: tangent-space normal, OpenGL
  convention (+Y up), linear.
- Grain and boards run along the image width (u) in both assets. A vertical board needs its UVs rotated
  90° so the grain runs up the board.
- No transformations: files are exactly as downloaded (checksums below). Colour and coating are tuned in
  the material, not by editing the images. The plank colour map is darker than the reference floor and is
  lightened in the material.

SHA-256:

```
c56ed85b190cdeb6c3656aaacf3b9a33ac76e08e3f47fa7aacc6b923b975455a  oak_veneer_02/oak_veneer_02_diff_2k.jpg
4baa7cd0ad25c78fd171d0aad1e19833e4feaf650b0330e4fdc92654796e5e68  oak_veneer_02/oak_veneer_02_nor_gl_2k.jpg
31dce770142513800781464754bcd248d6f8ac79984dff26c81593195f3f9e6f  oak_veneer_02/oak_veneer_02_rough_2k.jpg
ec3d2deb1fe21150ede5f987b48c691b3c7dbffe4183850a9b8717e904917a46  oak_wood_planks/oak_wood_planks_diff_2k.jpg
340a51d81e5ec2ead28a1c864637375becb00a1e11861e47a72dde4c03950968  oak_wood_planks/oak_wood_planks_nor_gl_2k.jpg
18b2a97f44b18e1a794652dbb2ec4bbdfc35869e2f028e4bbb85441258da1018  oak_wood_planks/oak_wood_planks_rough_2k.jpg
```
