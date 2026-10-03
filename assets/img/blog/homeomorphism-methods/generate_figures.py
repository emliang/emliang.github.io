"""Analytic illustrations for the blog; no learned map or experimental result."""
from pathlib import Path
from math import sin, cos, pi, sqrt
from html import escape
ROOT=Path(__file__).parent
INK='#21383c';TEAL='#2c6d77';COPPER='#ae6b4c';BLUE='#567aa8'
def radius(a,shape='convex'):
    return ((cos(a)/1.18)**4+(sin(a)/.82)**4)**(-.25) if shape=='convex' else 1+.25*cos(3*a)
def xy(r,a,mapped=False,center=(240,180),scale=110,shape='convex'):
    R=radius(a,shape) if mapped else 1
    return center[0]+scale*r*R*cos(a),center[1]-scale*r*R*sin(a)
def path(points,close=False):
    return 'M '+' L '.join(f'{x:.2f},{y:.2f}' for x,y in points)+(' Z' if close else '')
def curve(points,stroke,width=1,fill='none',extra=''):
    return f'<path d="{path(points,fill!="none")}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" {extra}/>'
def text(x,y,s,size=20,color=INK,anchor='middle'):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" text-anchor="{anchor}">{escape(s)}</text>'
def make(name,w,h,title,desc,body):
    ROOT.joinpath(name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc"><title id="title">{escape(title)}</title><desc id="desc">{escape(desc)}</desc><metadata>Analytic radial homeomorphism: Φ(ru)=r R(u)u, Φ(0)=0. Reference disk is the Euclidean unit ball. Convex target: (x/1.18)^4+(y/.82)^4 ≤ 1. Nonconvex target: 0≤r≤1+.25cos(3a).</metadata><g font-family="Arial,Helvetica,sans-serif">'+''.join(body)+'</g></svg>')
def grid(mapped,center=(240,178),scale=112,shape='convex'):
    pts=[xy(1,2*pi*j/240,mapped,center,scale,shape) for j in range(240)]
    b=[curve(pts,TEAL if mapped else BLUE,2,'#f2f7f7')]
    for r in [.25,.5,.75]:b.append(curve([xy(r,2*pi*j/180,mapped,center,scale,shape) for j in range(181)],'#c3d4d7',1.2))
    for j in range(12):b.append(curve([xy(0,0,mapped,center,scale,shape),xy(1,2*pi*j/12,mapped,center,scale,shape)],'#c3d4d7',1.2))
    b.append(f'<circle cx="{center[0]}" cy="{center[1]}" r="3" fill="{INK}"/>')
    return b
for mapped,name,label in [(False,'reference.svg','Simple coordinates · B'),(True,'mapped.svg','Feasible decisions · K')]:
    b=[text(240,30,label,23),*grid(mapped)]
    for r,a in [(.64,.55),(.9,2.5),(.46,4.6)]:
        x,y=xy(r,a,mapped,(240,178),112);b.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="5" fill="{COPPER}" stroke="white" stroke-width="1.5"/>')
    b.append(text(240,324,'Each point has one counterpart',19,'#607276'))
    make(name,480,348,label,'Matching radial grids and three paired points illustrate an exact homeomorphism between a disk and a convex rounded rectangle.',b)
for mapped,name in [(False,'samples-reference.svg'),(True,'samples-mapped.svg')]:
    b=[text(240,30,'Evenly spread in B' if not mapped else 'Same points, mapped to K',23),*grid(mapped,(240,178),106,'star')]
    for j in range(400):
        r=sqrt((j+.5)/400);a=j*pi*(3-sqrt(5));x,y=xy(r,a,mapped,(240,178),106,'star')
        b.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="2.4" fill="{COPPER}" fill-opacity=".7"/>')
    b.append(text(240,324,'400 illustrative equal-weight points',19,'#607276'))
    make(name,480,348,'Transporting probability mass','A deterministic equal-area disk point set is mapped radially into a nonconvex star-shaped domain. These are illustrative draws, not samples from a trained GFM model.',b)
b=[text(600,91,'Homeomorphism Methods',48),text(600,144,'Learning · Optimization · Sampling',27,'#607276')]
for mapped,c in [(False,(325,376)),(True,(875,376))]:b+=grid(mapped,c,142)
b+=[text(600,350,'Φ →',43,TEAL),text(600,413,'← Φ⁻¹',30,'#607276'),text(325,583,'Simple domain B',25),text(875,583,'Feasible set K',25)]
make('share.svg',1200,630,'Homeomorphism Methods','A unit disk and convex feasible set joined by an invertible coordinate map.',b)
