"""Blog adaptations of INFORMS/Figures/Source/core_scenes.mjs:
rho/gauge, hompgdIllustrationStep, driftScene. Analytic illustrations only.
Run with Python + Pillow. No external slide materials needed at render time.
"""
from pathlib import Path
from math import sin, cos, pi, atan2, hypot
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / 'assets/img/blog/informs-motion'
OUT.mkdir(parents=True, exist_ok=True)
font = '/System/Library/Fonts/Supplemental/Arial.ttf'
def face(size):
    return ImageFont.truetype(font if Path(font).exists() else 'DejaVuSans.ttf', size)
ink = '#242729'
# Paper, domain fill, motion accent. Geometry stays neutral across chapters.
palettes = {
    'gauge': ('#fffdf8', '#f2ebdd', '#a34423'),
    'hom-pgd': ('#fbfcff', '#e8edf5', '#294db0'),
    'flow-drift': ('#fffdfb', '#f3ede8', '#ad382f'),
}
normals = [(cos(i*2*pi/5+.12),sin(i*2*pi/5+.12)) for i in range(5)]
offsets = [1.02,.86,.96,.88,.92]
def radius(a):
    return min(b/d for (x,y),b in zip(normals,offsets) if (d:=x*cos(a)+y*sin(a))>1e-10)
def gauge(z):
    return tuple(v*radius(atan2(z[1],z[0])) for v in z)
def valid(x):
    return all(a*x[0]+b*x[1]<=c+1e-9 for (a,b),c in zip(normals,offsets))
def mix(a,b,t):
    return tuple(x+(y-x)*t for x,y in zip(a,b))
z=(.20,-.13)
def objective(z):
    x,y=gauge(z); return ((x-1.6)**2+(y-.75)**2)/2
eps=1e-5
grad=[(objective((z[0]+eps*(j==0),z[1]+eps*(j==1)))-objective((z[0]-eps*(j==0),z[1]-eps*(j==1))))/(2*eps) for j in range(2)]
proposal=tuple(x-.70*g for x,g in zip(z,grad))
accepted=tuple(x/hypot(*proposal) for x in proposal)
steps=[(-.7,-.2)]
for _ in range(5):
    x,y=steps[-1];steps.append((x-.5*y,y+.5*x))
assert hypot(*proposal)>1 and valid(gauge(accepted)) and not valid(steps[-1])
def render(kind,t):
    paper,pale,accent=palettes[kind]
    primary=ink
    im=Image.new('RGB',(720,504),paper); d=ImageDraw.Draw(im)
    def label(x,y,s,size=25,color=ink,anchor='mm'):
        d.text((x,y),s,font=face(size),fill=color,anchor=anchor)
    title,chapter={'gauge':('Follow a ray','GAUGE MAP'),'hom-pgd':('Project, then map back','OPTIMIZATION'),'flow-drift':('When an update leaves the set','NUMERICAL FLOW')}[kind]
    label(28,25,chapter,17,accent,'lm')
    label(26,70,title,40,ink,'lm')
    d.line((28,106,692,106),fill='#cccac5',width=2)
    drift=kind=='flow-drift'
    def xy(side,p):
        return (182+350*side+112*p[0],277-112*p[1])
    def path(side,pts,col,w=4):
        d.line([xy(side,p) for p in pts],fill=col,width=w,joint='curve')
    def dot(side,p,col,r=8):
        x,y=xy(side,p);d.ellipse((x-r,y-r,x+r,y+r),fill=col,outline=paper,width=2)
    for side,name in enumerate(('Exact trajectory','Euler trajectory') if drift else ('Unit ball','Feasible set')):
        label(182+350*side,138,name,23)
        ring=[]
        for k in range(361):
            a=2*pi*k/360; r=radius(a) if drift or side else 1
            ring.append(xy(side,(r*cos(a),r*sin(a))))
        d.polygon(ring,fill=pale);d.line(ring,fill='#686965',width=3)
    if not drift:
        d.line((338,277,373,277),fill=ink,width=3)
        d.line([(365,270),(373,277),(365,284)],fill=ink,width=3)
    if kind=='gauge':
        fraction=min(1,2*t)
        a=.42+max(0,2*t-1)*1.9; u=(cos(a),sin(a))
        for s,end in enumerate((u,gauge(u))):
            path(s,[(0,0),end],'#a5a199',2);path(s,[(0,0),mix((0,0),end,fraction)],accent,4);dot(s,(0,0),ink,4)
            dot(s,mix((0,0),end,fraction),accent)
        msg=('Both points use the same fraction of their ray.' if t<.5
             else 'The boundary distance depends on the direction.')
    elif drift:
        n=min(5,int(t*5)); a=t*2.5
        def exact(v): return (-.7*cos(v)+.2*sin(v),-.7*sin(v)-.2*cos(v))
        path(0,[exact(a*k/80) for k in range(81)],primary);dot(0,exact(a),primary)
        p=mix(steps[n],steps[min(5,n+1)],t*5-n)
        path(1,steps[:n+1]+[p],accent)
        for v in steps[:n+1]: dot(1,v,accent,4)
        dot(1,p,accent)
        msg=f'Euler update {n} of 5' if n<5 else 'After five steps, the Euler output is outside.'
    else:
        stage=min(2,int(t*3)); u=min(1,t*3-stage)
        p=mix(z,proposal,u) if stage==0 else mix(proposal,accepted,u) if stage==1 else accepted
        path(0,[z,p if stage==0 else proposal],ink)
        if stage: path(0,[proposal,p],accent,6)
        dot(0,z,ink,4);dot(0,p,ink if stage==0 else accent)
        dot(1,gauge(z),ink,5)
        if stage==2: dot(1,gauge(accepted),accent,round(4+5*u))
        msg=['1. Take a gradient step in ball coordinates.','2. Project the proposal onto the ball.','3. Map the accepted point back.'][stage]
    d.line((28,432,692,432),fill='#cccac5',width=2)
    label(28,466,msg,24,ink,'lm');return im
for name in ('gauge','hom-pgd','flow-drift'):
    frames=[render(name,i/60) for i in range(61)]
    frames[0].save(OUT/(name+'.gif'),save_all=True,append_images=frames[1:],duration=[650]+[90]*59+[1500],loop=0,disposal=1)
    with Image.open(OUT/(name+'.gif')) as gif:
        gif.seek(gif.n_frames-1); assert gif.n_frames>35 and gif.size==(720,504)
