"""Check metadata, encoding, poster dimensions and the decoded loop seam."""
from pathlib import Path
import json
import subprocess
import sys
from PIL import Image, ImageChops, ImageStat

root = Path(__file__).resolve().parents[2] / 'public/assets/video'
for slug in sys.argv[1:] or sorted(p.stem for p in root.glob('*.mp4')):
    video = root / (slug + '.mp4')
    poster = root / (slug + '.jpg')
    info = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(video)
    ]))
    stream, = info['streams']
    assert (stream['codec_name'], stream['profile'], stream['pix_fmt']) == ('h264', 'High', 'yuv420p')
    assert (stream['width'], stream['height'], stream['avg_frame_rate']) == (1600, 1000, '30/1')
    seconds = float(info['format']['duration'])
    count = int(stream['nb_frames'])
    assert (8 if slug == 'hero' else 6) <= seconds <= 10 and count == round(seconds * 30)
    assert video.stat().st_size < (2500000 if slug == 'hero' else 1500000)
    assert Image.open(poster).size == (1600, 1000) and poster.stat().st_size < 200000
    data = video.read_bytes()
    assert 0 < data.index(b'moov') < data.index(b'mdat')
    # Decode every frame. Only the first and last RGB frames leave ffmpeg.
    raw = subprocess.check_output(['ffmpeg','-v','error','-xerror','-i',str(video),'-vf',
        f"select='eq(n,0)+eq(n,{count-1})',scale=800:500",'-fps_mode','passthrough',
        '-pix_fmt','rgb24','-f','rawvideo','pipe:1'])
    stride = 800 * 500 * 3
    assert len(raw) == stride * 2
    ends = [Image.frombytes('RGB',(800,500),part) for part in (raw[:stride],raw[stride:])]
    delta = max(ImageStat.Stat(ImageChops.difference(*ends)).mean)
    assert delta < 2, (slug, delta)
    print(f'{slug:12} {seconds:4.1f}s {count:3} frames {len(data):9} bytes | poster {poster.stat().st_size:6} bytes | seam {delta:.3f}/255')
