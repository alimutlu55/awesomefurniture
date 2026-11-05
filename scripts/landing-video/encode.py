"""Edit double-density studio captures into CFR loops. Requires Pillow, ffmpeg and ffprobe."""
import json
import os
import subprocess
import sys
from functools import lru_cache
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(os.getenv('CAPTURE_DIR', '/tmp/furnidraw-landing-frames'))
DEST = ROOT / 'public/assets/video'
SIZE = (1600, 1000)
FPS = 30

# A shot is its first frame time, source image, attention point and magnification.
# The pointer travels during the hold, before the corresponding editor change.
def beat(t, name, x=.5, y=.5, zoom=1, cursor=None):
    return (t, name, (x,y,zoom), cursor)

films = {
    'studio': (9.2, 6.85, [
        beat(0,'wall-1',.5,.5,1.22,(.65,.18)), beat(1.0,'wall-2',.5,.5,1.22,(.65,.81)),
        beat(1.75,'wall-3',.5,.5,1.22,(.35,.81)), beat(2.55,'wall-4',.5,.5,1.22,(.35,.18)),
        beat(3.05,'wall-size-1'),beat(3.86,'wall-size-2'),beat(4.62,'door',.5,.56,1.34,(.50,.79)), beat(5.52,'window',.52,.5,1.34,(.65,.5)),
        beat(6.42,'room3d'),beat(7.42,'room-orbit'),beat(8.05,'plan-openings')]),
    'parametric': (9.6, 2.9, [
        beat(0,'size',cursor=(.075,.81)),beat(1.7,'width-300',cursor=(.075,.81)),
        beat(3.5,'width-240',cursor=(.075,.81)),beat(4.9,'white'),beat(6.85,'oak')]),
    'autolayout': (8.8, 6.7, [
        beat(0,'empty',cursor=(.31,.895)),beat(1.45,'storage',.26,.22,1.40,(.16,.22)),
        beat(2.8,'storage-filled',.26,.22,1.4),beat(4.05,'proposals'),beat(5.68,'layout')]),
    'make': (9.8, 7.75, [
        beat(0,'choose-shelf',cursor=(.223,.411)),beat(1.25,'added-shelf'),
        beat(2.22,'choose-drawer',cursor=(.090,.411)),beat(3.22,'added-drawer'),
        beat(4.35,'hinged',cursor=(.157,.912)),beat(5.65,'handle',cursor=(.46,.90)),beat(7.1,'joinery-cut')]),
    'drawings': (9.3, 3.6, [
        beat(0,'menu',.65,.42,1,(.83,.42)),beat(1.35,'drawing-plan'),beat(2.65,'elevation'),
        beat(4.15,'elevation-detail',.53,.50,1.2),beat(6.7,'drawing-list')]),
    'render': (9.4, 6.3, [
        beat(0,'model',.53,.45,1.32),beat(1.5,'ai',cursor=(.52,.855)),
        beat(3.0,'model',.53,.45,1.32),beat(3.85,'photo'),beat(7.45,'model',.53,.45,1.32)]),
    'hero': (9.9, 7.8, [
        beat(0,'plan-openings',.5,.49,1.16),beat(1.45,'room3d'),beat(2.55,'model',.53,.45,1.26),
        beat(3.85,'width-300'),beat(5.1,'elevation-detail'),beat(6.7,'finished' if os.getenv('HERO_3D_END')=='1' else 'photo')]),
}

def smooth(t):
    t=max(0,min(1,t))
    return t*t*(3-2*t)

@lru_cache(maxsize=20)
def frame(name, crop):
    im=Image.open(SOURCE/(name+'.jpg')).convert('RGB')
    x,y,z=crop
    w,h=im.size
    cw=min(w,h*1.6)/z
    ch=cw/1.6
    left=max(0,min(w-cw,w*x-cw/2))
    top=max(0,min(h-ch,h*y-ch/2))
    return im.resize(SIZE,Image.Resampling.LANCZOS,box=(left,top,left+cw,top+ch)),(left/w,top/h,cw/w,ch/h)

def point(pos, bounds):
    x,y,w,h=bounds
    return ((pos[0]-x)/w*SIZE[0],(pos[1]-y)/h*SIZE[1])

def cursor(im,xy,opacity):
    if opacity<.02:return im
    icon=Image.new('RGBA',(30,42))
    ImageDraw.Draw(icon).polygon([(2,2),(2,30),(9,24),(15,37),(20,34),(14,22),(25,21)],fill=(43,42,37,round(245*opacity)),outline=(255,255,255,round(255*opacity)),width=2)
    im=im.copy();im.paste(icon,tuple(round(v) for v in xy),icon);return im

def compose(slug,t):
    duration,_,shots=films[slug]
    idx=max(i for i,b in enumerate(shots) if t>=b[0])
    start,name,crop,target=shots[idx]
    im,bounds=frame(name,crop)
    elapsed=t-start
    previous=shots[max(0,idx-1)]
    transition=.24
    wipe=slug=='render' and (name=='photo' or previous[1]=='photo')
    if wipe:transition=.8
    if idx and elapsed<transition:
        prev=frame(previous[1],previous[2])[0]
        alpha=smooth(elapsed/transition)
        if wipe:
            split=round(SIZE[0]*alpha); mixed=prev.copy()
            if split:mixed.paste(im.crop((0,0,split,SIZE[1])),(0,0))
            im=mixed
        else:im=Image.blend(prev,im,alpha)
    if target:
        stop=shots[idx+1][0] if idx+1<len(shots) else duration-1.1
        move=smooth((elapsed-(.60 if idx==0 else .18))/max(.3,(stop-start)*.52))
        dest=point(target,bounds)
        origin=point(previous[3] or (target[0]+.045,target[1]-.07),bounds)
        pos=tuple(a+(b-a)*move for a,b in zip(origin,dest))
        opacity=smooth((elapsed-(.60 if idx==0 else .18))/.16)*smooth((stop-t)/.16)
        im=cursor(im,pos,opacity)
    # Eighteen identical frames at each end, with a half-second dissolve back.
    if t>=duration-1.1:
        im=Image.blend(im,frame(shots[0][1],shots[0][2])[0],smooth((t-duration+1.1)/.5))
    return im

def export(slug):
    duration,poster_time,_=films[slug]
    path=DEST/(slug+'.mp4')
    tmp=DEST/(slug+'.tmp.mp4')
    for crf in (23,25,27,29,31):
        args=['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1600x1000','-r','30','-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf',str(crf),'-profile:v','high','-pix_fmt','yuv420p','-movflags','+faststart',str(tmp)]
        with subprocess.Popen(args,stdin=subprocess.PIPE) as proc:
            for i in range(round(duration*FPS)):
                proc.stdin.write(compose(slug,i/FPS).tobytes())
            proc.stdin.close()
            if proc.wait():raise RuntimeError('ffmpeg failed')
        if tmp.stat().st_size<(2500000 if slug=='hero' else 1500000):break
    else:raise ValueError('Size budget exceeded')
    meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(tmp)]))['streams']
    assert len(meta)==1
    stream=meta[0]
    assert (stream['codec_name'],stream['profile'],stream['pix_fmt'],stream['width'],stream['height'],stream['r_frame_rate'])==('h264','High','yuv420p',1600,1000,'30/1')
    assert int(stream['nb_frames'])==round(FPS*duration)
    poster=compose(slug,poster_time)
    for q in range(81,59,-2):
        poster.save(DEST/(slug+'.jpg'),quality=q,optimize=True)
        if (DEST/(slug+'.jpg')).stat().st_size<200000:break
    else:raise ValueError('Poster size budget exceeded')
    tmp.replace(path)
    print(slug, '%.1fs'%duration,path.stat().st_size,(DEST/(slug+'.jpg')).stat().st_size,flush=True)

if __name__=='__main__':
    DEST.mkdir(parents=True,exist_ok=True)
    for slug in sys.argv[1:] or films:export(slug)
