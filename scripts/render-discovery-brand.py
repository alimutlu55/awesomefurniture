"""Render the original brand mark and social diagram. Requires Pillow; generated assets are committed."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(__file__).resolve().parents[1] / 'public' / 'assets'
ASSETS.mkdir(exist_ok=True)
PAPER, INK, MUTED = '#f7f6f2', '#292c25', '#727968'
font_roots = [Path('/System/Library/Fonts/Supplemental'), Path('/usr/share/fonts/truetype/dejavu')]

def font(size, bold=False):
    for root in font_roots:
        for name in (['Arial Bold.ttf', 'DejaVuSans-Bold.ttf'] if bold else ['Arial.ttf', 'DejaVuSans.ttf']):
            if (root / name).exists():
                return ImageFont.truetype(str(root / name), size)
    raise RuntimeError('Install Arial or DejaVu Sans to render brand assets.')


def mark(draw, origin, scale, color):
    x, y = origin
    def line(points):
        draw.line([(x + a * scale, y + b * scale) for a, b in points], fill=color, width=round(1.7 * scale))
    line([(5, 23), (5, 5), (23, 5), (23, 23)])
    line([(5, 14), (23, 14)])
    line([(14, 5), (14, 23)])
    line([(3, 25), (25, 25)])


logo = Image.new('RGB', (512, 512), INK)
mark(ImageDraw.Draw(logo), (32, 18), 16, PAPER)
logo.save(ASSETS / 'furnidraw-mark.png', optimize=True)

card = Image.new('RGB', (1200, 630), PAPER)
draw = ImageDraw.Draw(card)

def text(x, y, value, size, color=INK, bold=False):
    draw.text((x, y), value, font=font(size, bold), fill=color)

mark(draw, (62, 25), 1.3, INK)
text(105, 29, 'FurniDraw.', 28, bold=True)
draw.line((65, 83, 1135, 83), fill='#deded5', width=1)
text(68, 166, 'ONLINE FURNITURE DESIGNER', 12, MUTED)
text(65, 213, '3D furniture', 57, bold=True)
text(65, 284, 'design.', 57, bold=True)
text(65, 365, 'With precise plans.', 43, '#7d8572', True)
text(68, 495, 'Wardrobes. Kitchen cabinets.', 20, MUTED)
text(68, 526, 'Dimensions. Materials. Drawings.', 20, MUTED)
# Original axonometric cabinet diagram, generated from measured graphic coordinates.
ox, oy, width, height, dx, dy = 720, 500, 285, 340, 50, -33
face, top, side = '#c8a678', '#dfc69f', '#a17c51'
draw.polygon([(ox, oy-height), (ox+width, oy-height-25),
              (ox+width+dx, oy-height-25+dy), (ox+dx, oy-height+dy)], fill=top)
draw.polygon([(ox+width, oy-height-25), (ox+width+dx, oy-height-25+dy),
              (ox+width+dx, oy-25+dy), (ox+width, oy-25)], fill=side)
draw.polygon([(ox, oy), (ox, oy-height), (ox+width, oy-height-25), (ox+width, oy-25)], fill='#b59670')
for x in range(ox+5, ox+width, 6):
    draw.line((x, oy-6, x, oy-height+3), fill='#b09370', width=1)
for j in range(4):
    x = ox+j*width//3
    y = oy-(x-ox)*25/width
    draw.polygon([(x, y), (x, y-height), (x+7, y-height), (x+7, y)], fill=face)
for j in range(1, 5):
    y = oy-j*height//5
    draw.polygon([(ox+5, y), (ox+width, y-25), (ox+width+dx-5, y-25+dy), (ox+dx, y+dy)], fill=top)
    draw.line((ox+5, y, ox+width, y-25), fill=face, width=4)
draw.line((ox-10, oy+35, ox+width+8, oy+10), fill='#8b9380', width=1)
text(ox+105, oy+30, '2400 mm', 12, MUTED)
text(1025, 587, 'furnidraw.com', 13, MUTED)
card.save(ASSETS / 'furnidraw-design-social.png', optimize=True)
print('Rendered the brand mark and social preview.')
