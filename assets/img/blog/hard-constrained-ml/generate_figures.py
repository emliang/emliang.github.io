"""Rebuild compact article SVGs with the Python standard library.

Diagrams show mechanism roles and intervention locations. The fixed synthetic
record is validated and read, never modified while figures are rendered.
"""

from pathlib import Path
from html import escape
from base64 import b64encode
import json
import re

OUT = Path(__file__).resolve().parent
PAPER, INK, TEAL, COPPER = "#fbfaf8", "#24363a", "#2c6d77", "#9b654e"
MUTED, LINE, FILL = "#586a6d", "#dbe3e1", "#e9f3f0"
SANS = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
SERIF = "Georgia, 'Times New Roman', serif"
MATH_FONTS = Path(__file__).resolve().parents[3] / "vendor/katex-0.16.22/fonts"


def math_font_style():
    """Keep math in image SVGs identical to the article's bundled KaTeX faces."""
    faces = []
    for family, filename, style in (
        ("KaTeX_Main", "KaTeX_Main-Regular.woff2", "normal"),
        ("KaTeX_Math", "KaTeX_Math-Italic.woff2", "italic"),
    ):
        data = b64encode((MATH_FONTS / filename).read_bytes()).decode("ascii")
        faces.append(f'@font-face{{font-family:{family};font-style:{style};font-weight:400;src:url(data:font/woff2;base64,{data}) format("woff2")}}')
    return '<style>' + ''.join(faces) + (
        '.svg-math{font-family:KaTeX_Main,"Times New Roman",serif;font-style:normal;font-weight:400}'
        '.svg-math .math-var{font-family:KaTeX_Math,"Times New Roman",serif;font-style:italic;font-weight:400}'
        '</style>'
    )


def math_var(symbol):
    return f'<tspan class="math-var">{escape(symbol)}</tspan>'


def math_sub(symbol, subscript, size):
    """An attached subscript whose baseline resets with the surrounding span."""
    return (math_var(symbol)
            + f'<tspan baseline-shift="sub" font-size="{round(size*.7, 2)}">'
            + (math_var(subscript) if subscript.isalpha() else escape(subscript))
            + '</tspan>')


def math_text(x, y, content, size=26, color=INK, anchor=None):
    return (f'<text x="{x}" y="{y}" class="svg-math" font-size="{size}" fill="{color}"'
            + (f' text-anchor="{anchor}"' if anchor else '')
            + '>' + content + '</text>')


def candidate_hat(center, baseline, size=27, color=INK):
    """Draw a wide hat above y without depending on a combined Unicode glyph."""
    half = size * .29
    shoulders, apex = baseline - size*.59, baseline - size*.75
    return (f'<path class="math-accent" d="M{center-half:.4f} {shoulders:.4f}'
            f'L{center:.4f} {apex:.4f}L{center+half:.4f} {shoulders:.4f}" '
            f'fill="none" stroke="{color}" stroke-width="{size*.043:.4f}" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"/>')


def t(x, y, text, size=26, color=INK, weight=None, anchor=None, serif=False):
    attrs = [f'x="{x}"', f'y="{y}"', f'font-size="{size}"', f'fill="{color}"',
             f'font-family="{SERIF if serif else SANS}"']
    if weight:
        attrs.append(f'font-weight="{weight}"')
    if anchor:
        attrs.append(f'text-anchor="{anchor}"')
    content = escape(text)
    pattern = r'([A-Za-zΦΠεŷ][ⁱ⁺¹]*)_\{([^}]+)\}|([A-Za-zΦΠεŷ][ⁱ⁺¹]*)_([A-Za-z0-9]+)|([ΦfvsεE])θ'
    def subscript(match):
        base = match.group(1) or match.group(3) or match.group(5)
        sub = match.group(2) or match.group(4) or "θ"
        shift = round(size * .24, 2)
        return (base + f'<tspan dy="{shift}" font-size="{round(size*.7,2)}">{sub}</tspan>'
                + f'<tspan dy="{-shift}">&#8203;</tspan>')
    content = re.sub(pattern, subscript, content)
    return f'<text {" ".join(attrs)}>{content}</text>'


def line(x1, y1, x2, y2, color=LINE, width=2, dashed=False, arrow=False):
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="{color}" stroke-width="{width}"'
            + (' stroke-dasharray="8 7"' if dashed else '')
            + (f' marker-end="url(#{"back" if color == COPPER else "arrow"})"' if arrow else '')
            + '/>')


def rect(x, y, w, h, fill=FILL, stroke=TEAL, radius=12):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" '
            f'rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')


def box(x, y, w, label, color=TEAL):
    return rect(x, y, w, 60, stroke=color) + t(x+w/2, y+39, label, 27, anchor="middle")


def svg(name, w, h, title, description, body, metadata=None, math_fonts=False):
    s = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc">
<title id="title">{escape(title)}</title>
<desc id="desc">{escape(description)}</desc>
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="{TEAL}"/></marker>
  <marker id="back" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="{COPPER}"/></marker>
</defs>
<rect width="{w}" height="{h}" fill="#ffffff"/>
'''
    if math_fonts:
        s += math_font_style() + '\n'
    if metadata:
        s += '<metadata>' + escape(json.dumps(metadata, sort_keys=True)) + '</metadata>\n'
    s += '\n'.join(body) + '\n</svg>\n'
    (OUT/name).write_text(s, encoding="utf-8")


from collections import Counter
from math import sqrt

def point(x, y, kind, color, size=7):
    if kind == "square":
        return f'<rect x="{x-size}" y="{y-size}" width="{2*size}" height="{2*size}" fill="{color}" stroke="{PAPER}" stroke-width="2"/>'
    if kind == "diamond":
        return f'<path d="M{x} {y-size-2} L{x+size+2} {y} L{x} {y+size+2} L{x-size-2} {y} Z" fill="{PAPER}" stroke="{color}" stroke-width="3"/>'
    return f'<circle cx="{x}" cy="{y}" r="{size}" fill="{color if kind == "circle" else PAPER}" stroke="{color}" stroke-width="3"/>'


def rng(seed):
    state = seed & 0xFFFFFFFF
    while True:
        state = (1664525*state + 1013904223) & 0xFFFFFFFF
        yield state / 2**32


def project(x, y):
    """Exact projection onto {a,b >= 0, a+b <= 1}."""
    a, b = max(0.,x), max(0.,y)
    if a+b <= 1:
        return a,b
    a = min(1., max(0., (x-y+1)/2))
    return a,1-a


def samples(seed=104729, n=256):
    stream = rng(seed)
    accepted, projected, attempts = [],[],0
    while len(accepted) < n:
        x,y = 2*next(stream)-1, 2*next(stream)-1
        attempts += 1
        if len(projected) < n:
            projected.append(project(x,y))
        if x >= 0 and y >= 0 and x+y <= 1:
            accepted.append((x,y))
    boundary = sum(min(a,b,1-a-b) <= 1e-10 for a,b in projected)
    return accepted, projected, attempts, boundary


def share():
    b=[t(60,76,"A VISUAL GUIDE",24,TEAL,weight=600),
       t(60,162,"Hard-Constrained",62,serif=True),t(60,237,"Machine Learning",62,serif=True),
       t(60,315,"From constrained prediction",32),t(60,359,"to constrained generation.",32),
       t(60,496,"Prediction · Generation · Method selection",24,color=MUTED),
       t(60,562,"ENMING LIANG",23,TEAL,weight=600)]
    x,bottom,s=800,479,249
    b += [f'<path d="M{x} {bottom} L{x+s} {bottom} L{x} {bottom-s} Z" fill="{FILL}" stroke="{TEAL}" stroke-width="2.5"/>',
          line(x-16,bottom,x+s+30,bottom,MUTED,2),line(x,bottom+16,x,bottom-s-30,MUTED,2)]
    xy=lambda a,c:(x+s*a,bottom-s*c)
    c=xy(.8,.8); p=xy(.6,.6); q=xy(.5,.5); u=xy(.42,.18)
    b += [line(*c,*q,COPPER,3,dashed=True),point(*c,"open",COPPER,9),point(*p,"diamond",COPPER,9),point(*q,"diamond",TEAL,9),point(*u,"diamond",TEAL,9),
          t(788,535,"Encourage · Project · Parameterize",21,color=MUTED)]
    svg("share.svg",1200,630,"Hard-Constrained Machine Learning: a visual guide","A sharing cover with the blog title, subtitle, and the same triangular feasible-set illustration. A candidate outside the triangle, an infeasible penalty output, a projected boundary output, and a parameterized interior output summarize the article's central mechanisms.",b)


def validate():
    assert project(.8,.8)==(.5,.5)
    assert project(.3,.2)==(.3,.2)
    assert project(-.2,.8)==(0.,.8)
    assert project(2.,-1.)==(1.,0.)
    assert project(-2.,-1.)==(0.,0.)
    for i in range(-40,41):
        for j in range(-40,41):
            a,b = project(i/20,j/20)
            assert a >= -1e-12 and b >= -1e-12 and a+b <= 1+1e-12
            qa,qb = project(a,b)
            assert abs(qa-a)+abs(qb-b) < 1e-12
    accepted, projected, _, _ = samples()
    assert samples()==samples()
    assert len(accepted)==len(projected)==256
    assert all(a>=0 and b>=0 and a+b<=1 for a,b in accepted+projected)


def route(d,color=TEAL,dashed=False,arrow=True,width=3):
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"'
            +(' stroke-dasharray="7 6"' if dashed else '')
            +(f' marker-end="url(#{"back" if color==COPPER else "arrow"})"' if arrow else '')+'/>' )


def node(x,y,w,label,color=TEAL,size=26):
    learned=label in ("Model", "Φθ", "update")
    fill=INK if learned else ("#f7eee8" if color==COPPER else FILL)
    border=INK if learned else (COPPER if color==COPPER else "#a6c5c0")
    return rect(x,y,w,56,fill,border,12)+t(x+w/2,y+37,label,size,"#ffffff" if learned else INK,weight=500,anchor="middle")


def diagram_network(x,y,w=102,h=88,label="fθ",highlight=False):
    """Visible network structure, rather than an icon inside a process box."""
    layers=[[(x,y+h*a) for a in (.18,.5,.82)],
            [(x+w*.5,y+h*a) for a in (0,.33,.67,1)],
            [(x+w,y+h*a) for a in (.18,.5,.82)]]
    b=[rect(x-12,y-12,w+24,h+24,"#f5f7fa","#e5e9ec",14)]
    for first,second in zip(layers,layers[1:]):
        for a in first:
            for c in second:b.append(line(*a,*c,"#c9d5d9",1.35))
    active=[layers[0][1],layers[1][1],layers[2][1]]
    for a,c in zip(active,active[1:]):b.append(line(*a,*c,COPPER if highlight else TEAL,2.5))
    for layer in layers:
        for a,c in layer:b.append(f'<circle cx="{a}" cy="{c}" r="5.3" fill="#fff" stroke="{INK}" stroke-width="1.7"/>')
    b += [t(x+w/2,y+h+44,label,29,INK,anchor="middle",serif=True)]
    return b


def allocation_scene(x,y,kind="candidate",title="candidate c",returned=False):
    s=76;left=x+10;bottom=y+126
    b=[t(left+s/2,y-3,title,24,INK,weight=500,anchor="middle"),
       line(left-6,bottom,left+s+8,bottom,"#acb9bc",1.2),
       line(left,bottom+6,left,bottom-s-8,"#acb9bc",1.2)]
    if kind=="coordinates":
        b += [rect(left,bottom-s,s,s,"#edf1f8","#91a5c5",5),t(left+18,bottom-12,"U",25,"#657eaa",serif=True)]
        a,c=.6,.7
    else:
        b += [f'<path d="M{left} {bottom} L{left+s} {bottom} L{left} {bottom-s} Z" fill="{FILL}" stroke="#90b2a8" stroke-width="1.8"/>',
              t(left+6 if kind=="projection" else left+11,
                bottom-12 if kind=="projection" else bottom-40,
                "K",22 if kind=="projection" else 24,TEAL,serif=True)]
        a,c={"candidate":(.8,.8),"projection":(.5,.5),"decoded":(.42,.18)}[kind]
    px,py=left+s*a,bottom-s*c
    b += [f'<circle cx="{px}" cy="{py}" r="13" fill="{COPPER if kind=="candidate" else TEAL}" fill-opacity=".09"/>',
          point(px,py,"diamond" if returned else "open",COPPER if kind=="candidate" else ("#657eaa" if kind=="coordinates" else TEAL),5.5)]
    return b


# Shared grammar: neutral tiles are quantities; filled tiles are operations.
def quantity(x,y,w,symbol,label=None,h=64):
    b=[rect(x,y,w,h,"#ffffff","#c8d3d5",9)]
    b += [t(x+w/2,y+(25 if label else h/2+9),symbol,28,anchor="middle",serif=True)]
    if label:b.append(t(x+w/2,y+56,label,18,MUTED,anchor="middle"))
    return b


def operation(x,y,w,title,detail=None,kind="model",h=64):
    fill,border,color={"model":(INK,INK,"#ffffff"),"compute":(FILL,"#9bbeb7",INK),"constraint":("#f7eee8","#c79c86",COPPER),"map":("#edf1f8","#91a5c5","#526e9b")}[kind]
    b=[rect(x,y,w,h,fill,border,9),t(x+w/2,y+(24 if detail else h/2+8),title,25,color,weight=500,anchor="middle")]
    if detail:b.append(t(x+w/2,y+56,detail,20,color,anchor="middle",serif=True))
    return b


def down(x,y1,y2,color=TEAL,dashed=False):
    return line(x,y1,x,y2,color,2.1,dashed,True)


def roles(include_overview=True):
    """Aligned classification chains, legible at 320px and 430px wide.

    The single-operation training row is centered. The other rows share the
    same model and constraint-operation positions, and all four share a
    baseline, model dimensions, and returned-output position.
    """
    def label(x, y, text, size, color=INK, serif=False, weight=None):
        result=t(x,y,text,size,color,weight,anchor='middle',serif=serif)
        # Restore the baseline on actual following text; avoid a zero-width
        # reset glyph, which some non-browser SVG renderers display as tofu.
        result=re.sub(r'<tspan dy="(-[\d.]+)">&#8203;</tspan>([^<]+)',
                      r'<tspan dy="\1">\2</tspan>',result)
        return result.replace('>', ' font-style="italic">', 1) if serif else result

    def model(x, width=126):
        center=x+width/2
        return [f'<rect x="{x}" y="52" width="{width}" height="72" rx="9" fill="#f0f4f3" stroke="#bdcbc7" stroke-width="1.5"/>',
                label(center,77,'Model',23,'#637674',weight=500),
                label(center,106,'fθ(x)',27,serif=True)]

    defs=('<defs>\n'
          '  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10Z" fill="'+TEAL+'"/></marker>\n'
          '  <marker id="back" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10Z" fill="'+COPPER+'"/></marker>\n'
          '</defs>')
    def arrow(start, end):
        return f'<path d="M{start} 88H{end}" fill="none" stroke="{TEAL}" stroke-width="2.1" stroke-linecap="round" marker-end="url(#arrow)"/>'

    specs=[]
    for slug in ('training','layer','coordinates','post'):
        if slug=='training':
            b=[label(239,19,'Constraints',22,COPPER,weight=500),
               f'<path d="M239 29V42" fill="none" stroke="{COPPER}" stroke-width="1.8" stroke-linecap="round" marker-end="url(#back)"/>',
               label(22,97,'x',29,serif=True),arrow(46,164),
               *model(176),arrow(314,438),label(458,97,'y',29,serif=True)]
            title='Training-based approaches'
            desc='Classification schematic: constraints shape how the predictor is trained or constructed; the model directly returns y.'
        else:
            middle={'layer':'Layer','coordinates':'Decode','post':'Correct'}[slug]
            fill,color=('#eef2f7','#526e9b') if slug=='coordinates' else ('#f6eee9',COPPER)
            b=[label(22,97,'x',29,serif=True),arrow(46,66),*model(78),
               arrow(216,268),label(241,64,'u' if slug=='coordinates' else 'c',27,serif=True),
               f'<rect x="280" y="52" width="126" height="72" rx="9" fill="{fill}" stroke="{color}" stroke-opacity=".45" stroke-width="1.5"/>']
            if slug=='coordinates':
                b += [label(343,77,middle,24,color,weight=500),
                      label(343,106,'D(u)',27,color,serif=True)]
            else:
                b += [label(343,97,middle,24,color,weight=500)]
            b += [arrow(418,438),label(458,97,'y',29,serif=True)]
            title={'layer':'Structured layers','coordinates':'Constraint parameterization','post':'Post-processing'}[slug]
            desc={'layer':'Classification schematic: a predictor produces c, which passes through a structured output layer. The operation participates in training and remains in inference.','coordinates':'Classification schematic: the predictor returns admissible reference coordinates u, and a specified feasible decoder D maps them to output y.','post':'Classification schematic: a downstream correction acts on candidate c after the fitted predictor. Training need not include this operation.'}[slug]
        header='<svg xmlns="http://www.w3.org/2000/svg" width="480" height="142" viewBox="0 0 480 142" role="img" aria-labelledby="title desc">'
        (OUT/('roles-'+slug+'.svg')).write_text('\n'.join([header,f'<title id="title">{escape(title)}</title>',f'<desc id="desc">{escape(desc)}</desc>',defs,*b,'</svg>','']),encoding='utf-8')
        specs.append((title,b))
    if not include_overview:
        return
    overview=[]
    for i,(title,b) in enumerate(specs):
        overview += [f'<g transform="translate(0,{i*204})">',t(16,26,title,25,weight=600),'<g transform="translate(0,40)">',*b,'</g></g>']
    svg('mechanism-roles.svg',480,816,'Four roles for constraints in prediction','Classification overview; methods can combine these roles.',overview)


def sampler():
    b=[*quantity(16,30,102,'z','noise'),
       *operation(175,30,191,'Sampling','iterative steps',kind='compute'),
       line(125,62,167,62,TEAL,2.1,arrow=True),
       line(374,62,412,62,TEAL,2.1,arrow=True),t(441,71,'y',30,anchor='middle',serif=True),
       t(270,130,'model + numerical update',23,MUTED,anchor='middle'),
       t(240,179,'Constraints can shape the process or its output.',22,MUTED,anchor='middle')]
    desc='A prior noise draw is transformed by repeated model-based numerical updates into an output. Constraint mechanisms may modify the representation, sampling dynamics, or output handling. This is a classification-level overview, not an algorithm.'
    svg('sampler-framework.svg',480,200,'From noise to a generated output',desc,b)
    svg('generation-processes.svg',480,200,'Iterative generation overview',desc,b)
    generation_interventions()


def generation_interventions(active_only=False):
    """Compact classification chains, following the accepted editorial style.

    The active taxonomy is training, geometry, parameterization, then grouped
    guidance/correction/search. Standalone guidance/correction variants remain
    available, but do not define separate top-level families in the article.
    """
    specs=[
      ('generation-training','Training-based methods','Data','Fit model','constraints','Model','compute',False,
       'Constraint supervision adapts model parameters before generation. Supervision may concern output estimates, completed rollouts, population statistics, or an inference operation. A penalty alone does not enforce feasibility for each output.'),
      ('geometry-overview','Geometry-aware sampling','On M','Geometric','update','On M','map',False,
       'The manifold case: dynamics and numerical operations evolve a state on a modeled manifold M. Reflection at domain boundaries is another geometry-aware mechanism; neither represents arbitrary additional constraints.'),
      ('coordinates-overview','Constraint parameterization','u ∈ U','Decode','D(u)','y ∈ K','map',True,
       'Generate valid reference coordinates u in U, then apply a decoder D whose image lies in the feasible set K. The map determines validity and coverage. This differs from intrinsic geometric dynamics.'),
      ('generation-interventions','Guidance, correction, and search','State','Guide','repair / select','Result','constraint',False,
       'Constraint information can steer an update, repair a specified candidate, or select among competing proposals. These are alternatives that can be combined, not three mandatory sequential operations. The object, timing and accuracy of the operation determine the final-output claim.'),
      ('guidance-overview','Guidance','State','Guide','update','Next','constraint',False,
       'Use an objective to steer sampling. This schematic does not prescribe a universal gradient formula or guarantee feasibility.'),
      ('correction-overview','Correction','Candidate','Correct','or solve','Output','constraint',False,
       'Apply a correction to a specified state, output estimate or final sample. Intermediate correction requires a connection to later sampling.')]
    for name,title,left,middle,detail,right,kind,math,desc in specs:
        active=name in {'generation-training','geometry-overview','coordinates-overview','generation-interventions'}
        if active_only and not active:
            continue
        fill,color={'compute':('#edf4f2',TEAL),'map':('#eef2f7','#526e9b'),'constraint':('#f6eee9',COPPER)}[kind]
        def label(x,y,text,size=22,color=INK,math=False,weight=None):
            result=t(x,y,text,size,color,weight,anchor='middle',serif=math)
            return result.replace('>', ' font-style="italic">', 1) if math else result
        body=[label(62,84,left,26 if math else 24,math=math),
              '<path d="M119 76H156" fill="none" stroke="'+TEAL+'" stroke-width="2.1" stroke-linecap="round" marker-end="url(#arrow)"/>',
              f'<rect x="168" y="38" width="170" height="76" rx="9" fill="{fill}" stroke="{color}" stroke-opacity=".45" stroke-width="1.5"/>']
        if name=='generation-interventions':
            # A single group of alternatives, not three boxes in a sequence.
            body += [label(253,64,'Guide / repair',22,color,weight=500),
                     label(253,96,'/ select',22,color,weight=500)]
        else:
            body += [label(253,65,middle,24 if active else 22,color,weight=500),
                     label(253,96,detail,25 if math else 22,color,math)]
        body += ['<path d="M350 76H389" fill="none" stroke="'+TEAL+'" stroke-width="2.1" stroke-linecap="round" marker-end="url(#arrow)"/>',
                 label(435,84,right,26 if math else 24,math=math)]
        header=f'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="134" viewBox="0 0 480 134" role="img" aria-labelledby="title desc">'
        defs='<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10Z" fill="'+TEAL+'"/></marker></defs>'
        meta=escape(json.dumps({'scope':'classification schematic; algorithm details in companion repository'}))
        (OUT/(name+'.svg')).write_text('\n'.join([header,f'<title id="title">{escape(title)}</title>',f'<desc id="desc">{escape(desc)}</desc>',defs,f'<metadata>{meta}</metadata>',*body,'</svg>','']))


def general_illustrations():
    """Two quiet, original diagrams sharing a typographic and colour system.

    Nodes summarize a 4-3-2 MLP; they do not encode activation magnitudes.
    The flow uses the existing exact monotone toy transport and its marginals.
    """
    from math import exp, pi, tanh
    from statistics import NormalDist

    sans = "Arial, Helvetica, sans-serif"
    soft_ink, faint, pale = "#65767a", "#c9d9d5", "#f1f6f3"

    def label(x, y, text, size=22, color=INK, weight=400, anchor="middle"):
        return (t(x, y, text, size, color, weight, anchor)
                .replace(f'font-family="{SANS}"', f'font-family="{sans}"'))

    def curve(d, color, width=1.3, opacity=1):
        return (f'<path d="{d}" fill="none" stroke="{color}" '
                f'stroke-width="{width}" stroke-opacity="{opacity}" '
                'stroke-linecap="round" stroke-linejoin="round"/>')

    def node(x, y, radius, selected=False, hidden=False):
        color = COPPER if selected else TEAL
        fill = "#f7eee8" if selected else ("#edf4f1" if hidden else "#ffffff")
        return (f'<circle cx="{x}" cy="{y}" r="{radius}" fill="{fill}" '
                f'stroke="{color}" stroke-width="1.7"/>')

    # The same illustrative toy network, now shown as a layer schematic.
    x_values = [.8, .35, .6, .15]
    w1 = [[.6, -.2, .4, .1], [-.3, .8, .5, .2], [.2, .1, -.6, .9]]
    b1 = [.05, .1, .25]
    h_values = [max(0., sum(w*x for w, x in zip(row, x_values))+bias)
                for row, bias in zip(w1, b1)]
    w2 = [[.65, .4, -.1], [-.2, .5, .8]]
    b2 = [.05, .1]
    y_values = [sum(w*h for w, h in zip(row, h_values))+bias
                for row, bias in zip(w2, b2)]
    inputs, hidden, outputs = [110, 155, 200, 245], [125, 177.5, 230], [150, 205]
    nn = [label(88, 35, "Input", weight=500),
          label(280, 35, "Hidden layer", weight=500),
          label(492, 35, "Prediction", weight=500),
          label(88, 66, "Features", 21.5, soft_ink),
          label(280, 66, "Affine + ReLU", 21.5, soft_ink),
          label(492, 66, "Affine", 21.5, soft_ink),
          '<rect x="244" y="94" width="72" height="168" rx="36" fill="#f4f7f5"/>']

    # Complete connectivity remains visible without repeating unit internals.
    def edge(a, b, color=faint, width=1.3, opacity=.85):
        x0, y0 = a; x1, y1 = b
        span = x1-x0
        return curve(f'M{x0} {y0} C{x0+span*.38} {y0}, '
                     f'{x1-span*.38} {y1}, {x1} {y1}', color, width, opacity)

    for yi in inputs:
        for yh in hidden:
            nn.append(edge((98, yi), (262, yh)))
    for yh in hidden:
        for yo in outputs:
            nn.append(edge((298, yh), (478, yo)))
    nn += [edge((98, inputs[1]), (262, hidden[1]), COPPER, 2.4, 1),
           edge((298, hidden[1]), (478, outputs[0]), COPPER, 2.4, 1)]
    for i, y in enumerate(inputs):
        nn.append(node(88, y, 10, selected=i == 1))
    for i, y in enumerate(hidden):
        nn.append(node(280, y, 18, selected=i == 1, hidden=True))
    for i, y in enumerate(outputs):
        nn.append(node(492, y, 14, selected=i == 0))
    nn += [math_text(88, 303, math_var('x'), 29, anchor="middle"),
           math_text(492, 303, math_var('y'), 29, anchor="middle"),
           candidate_hat(492, 303, 29)]
    svg("neural-network-prediction.svg", 560, 332,
        "From input features to a raw neural-network prediction",
        "A layer schematic of a fully connected 4-3-2 multilayer perceptron. "
        "Four feature nodes connect to three hidden units, each applying an "
        "affine transformation followed by ReLU. Two affine readout units form "
        "the raw prediction y hat. Pale curves show all learned connections; "
        "a copper route guides the eye through one unit in each layer. It is "
        "not an independent numerical contribution after nonlinear mixing. "
        "Nodes do not encode activation magnitudes. The hand-specified toy "
        "network is illustrative, not a trained result, and imposes no output "
        "constraint. The model equation is typeset below the image.", nn,
        {"kind": "original layer schematic; hand-specified toy MLP",
         "architecture": "4 inputs, 3 ReLU units, 2 affine outputs",
         "input": x_values, "W1": w1, "b1": b1, "W2": w2, "b2": b2,
         "hidden": h_values, "output": y_values,
         "encoding": "nodes indicate units, not numerical activation magnitudes",
         "visual_reference": "https://colah.github.io/posts/2015-08-Understanding-LSTMs/"}, math_fonts=True)

    # The same smooth monotone map and schedule used in the original diagram.
    normal = NormalDist()
    target = lambda z: 1.15*tanh(1.8*z)+.32*z
    target_derivative = lambda z: 2.07*(1-tanh(1.8*z)**2)+.32
    blend = lambda tm: 3*tm*tm-2*tm*tm*tm
    position = lambda z, tm: (1-blend(tm))*z+blend(tm)*target(z)
    indices = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 32, 35, 39, 43]
    quantiles = [normal.inv_cdf((i+.5)/44) for i in indices]
    focus_quantile = (32+.5)/44
    focus = normal.inv_cdf(focus_quantile)
    left, right, top, bottom = 148, 414, 98, 292
    px = lambda tm: left+(right-left)*tm
    py = lambda value: (top+bottom)/2-value*(bottom-top)/5.2
    ff = [label(90, 35, "Prior", weight=500),
          label(281, 35, "Transport", weight=500),
          label(478, 35, "Target", weight=500),
          curve('M205 64 H226', COPPER, 2.4),
          label(240, 71, "one sample", 21.5, COPPER, anchor="start"),
          math_text(20, 81, math_sub('z', 't', 30), 30, soft_ink)]

    # Endpoint silhouettes share the same sample-value and density scales.
    z_grid = [-2.6+i*5.2/200 for i in range(201)]
    prior_density = lambda z: exp(-z*z/2)/(2*pi)**.5
    prior_path = f'M124 {py(-2.6):.3f} '
    prior_path += ' '.join(f'L{124-82*prior_density(z):.3f} {py(z):.3f}' for z in z_grid)
    prior_path += f' L124 {py(2.6):.3f} Z'
    target_path = f'M438 {py(target(-2.6)):.3f} '
    target_path += ' '.join(f'L{438+82*prior_density(z)/target_derivative(z):.3f} '
                            f'{py(target(z)):.3f}' for z in z_grid)
    target_path += f' L438 {py(target(2.6)):.3f} Z'
    ff += [curve('M44 292 V98 M40 106 L44 98 L48 106', '#c0cec8', 1.1),
           label(28, py(0)+7, '0', 21.5, soft_ink, anchor='end'),
           curve(f'M44 {py(0)} H518', '#e9eeeb', 1),
           f'<path d="{prior_path}" fill="{pale}" stroke="{TEAL}" stroke-width="1.45"/>',
           f'<path d="{target_path}" fill="{pale}" stroke="{TEAL}" stroke-width="1.45"/>']
    for tm in (0., .5, 1.):
        ff.append(f'<path d="M{px(tm)} {top-8} V{bottom+6}" fill="none" '
                  f'stroke="#dce5e1" stroke-width="1.1"'
                  + (' stroke-dasharray="3 6"' if tm == .5 else '') + '/>')

    # Since s(t)=3t^2-2t^3, each curve is exactly a cubic Bezier in time.
    # Fewer visible quantiles reveal the trajectories without changing the map.
    def trajectory(z, color, width, opacity=1):
        y0, y1 = py(z), py(target(z)); third = (right-left)/3
        return curve(f'M{left} {y0:.4f} C{left+third:.4f} {y0:.4f}, '
                     f'{right-third:.4f} {y1:.4f}, {right} {y1:.4f}', color, width, opacity)
    for index, z in zip(indices, quantiles):
        if index != 32:
            ff.append(trajectory(z, '#91b1ac', 1.3, .72))
    ff.append(trajectory(focus, COPPER, 2.5))
    for tm in (0., .5, 1.):
        ff.append(f'<circle cx="{px(tm):.3f}" cy="{py(position(focus,tm)):.3f}" '
                  f'r="4.5" fill="{COPPER}" stroke="#ffffff" stroke-width="1.5"/>')
    # One small tangent arrow indicates the direction of the highlighted path.
    a, b = .63, .675
    ff.append(line(px(a), py(position(focus,a)), px(b), py(position(focus,b)),
                   COPPER, 2, arrow=True))
    ff.append(line(left, 314, right+5, 314, TEAL, 1.6, arrow=True))
    for tm, name in ((0., '0'), (.5, '0.5'), (1., '1')):
        ff += [curve(f'M{px(tm)} 310 V318', '#8da6a6', 1.1),
               label(px(tm), 344, name, 21.5, soft_ink)]
    ff.append(label(281, 376, 'generation time TIME', 22, soft_ink)
              .replace('TIME', '<tspan class="svg-math">'+math_var('t')+'</tspan>'))
    svg("flow-generation-general.svg", 560, 394,
        "Individual sample paths transport an entire distribution",
        "A normal prior at generation time zero is transported to an "
        "illustrative bimodal target at time one. Fifteen selected quantile "
        "paths share one vertical sample-value scale with the two exact "
        "endpoint marginal densities. The copper curve follows one sample; "
        "its three dots mark times zero, one-half, and one. Each path uses "
        "the same analytic monotone transport. No velocity field was trained "
        "and no output constraint is imposed. The generic flow-model equation "
        "is typeset below the image. Generation time is distinct from physical "
        "time along a generated robot route.", ff,
        {"kind": "original analytic toy transport, not learned model samples",
         "particles": len(indices), "source_quantile_grid_size": 44,
         "visible_quantile_indices": indices,
         "quantiles": "(i+0.5)/44 for the 15 displayed indices",
         "map": "T(z)=1.15 tanh(1.8z)+0.32z",
         "schedule": "s(t)=3t^2-2t^3",
         "transport": "Z_t(z)=(1-s(t))z+s(t)T(z)",
         "density": "p_1(T(z))=p_0(z)/T'(z)",
         "trajectory_geometry": "exact cubic Bezier for the existing schedule",
         "focus_quantile": focus_quantile,
         "visual_reference": "https://diffusionflow.github.io/"}, math_fonts=True)


def tri(b,x,bottom,s,math_fonts=False):
    b+=[f'<path d="M{x} {bottom} L{x+s} {bottom} L{x} {bottom-s} Z" fill="{FILL}" stroke="{TEAL}" stroke-width="2.5"/>',line(x-16,bottom,x+s+30,bottom,MUTED,2),line(x,bottom+16,x,bottom-s-22,MUTED,2),t(x-14,bottom+34,"0",22,MUTED,anchor="end"),t(x+s,bottom+34,"1",22,MUTED,anchor="middle"),t(x-14,bottom-s+8,"1",22,MUTED,anchor="end"),t(x+s+37,bottom+8,"y₁",24,MUTED),t(x-8,bottom-s-29,"y₂",24,MUTED)]
    if math_fonts:
        b[-2:] = [math_text(x+s+37,bottom+8,math_sub('y','1',24),24,MUTED),
                  math_text(x-8,bottom-s-29,math_sub('y','2',24),24,MUTED)]


def geometry(active_only=False):
    b=[];x,bottom,s=46,299,221
    tri(b,x,bottom,s,math_fonts=True)
    xy=lambda a,c:(x+s*a,bottom-s*c)
    c,p,q,u=xy(.8,.8),xy(.6,.6),xy(.5,.5),xy(.42,.18)
    b += [line(*c,*q,COPPER,2,dashed=True),
          point(*c,"open",COPPER,7),point(*p,"diamond",COPPER,7),
          point(*q,"diamond",TEAL,7),point(*u,"diamond",TEAL,7),
          route(f"M{c[0]+12} {c[1]} L266 76 L282 76",COPPER,arrow=False,width=1.6),
          t(294,80,"candidate",23,COPPER,weight=600),t(294,109,"(0.8, 0.8)",22,COPPER),
          line(p[0]+12,p[1],282,p[1],COPPER,1.6),
          t(294,165,"penalty output",22,COPPER,weight=600),t(294,194,"(0.6, 0.6)",22,COPPER),
          route(f"M{q[0]+12} {q[1]} L252 242 L282 242",TEAL,arrow=False,width=1.6),
          t(294,250,"projection",22,TEAL,weight=600),t(294,279,"(0.5, 0.5)",22,TEAL),
          route(f"M{u[0]+12} {u[1]} L230 274 L282 274 L282 327",TEAL,arrow=False,width=1.6),
          t(294,335,"decoded output",22,TEAL,weight=600),t(294,364,"(0.42, 0.18)",22,TEAL),
          math_text(68,284,math_var("K"),26,TEAL)]
    svg("mechanism-poster.svg",480,380,"Three mechanisms on a triangular feasible set","Synthetic geometry, not neural-network training. Candidate (0.8,0.8) violates the nonnegative total-budget set K. The quadratic penalty with lambda=1 returns (0.6,0.6); projection returns (0.5,0.5); b=0.6,q=0.7 construct (0.42,0.18). Formula and mechanism meaning belong in the HTML caption.",b,{"B":1,"candidate":[.8,.8],"quadratic_penalty_lambda":1,"penalty_output":[.6,.6],"projection_output":[.5,.5],"parameterization":{"b":.6,"q":.7,"output":[.42,.18]}},math_fonts=True)
    if active_only:
        return
    b=[];x,bottom,s=45,250,190
    tri(b,x,bottom,s);xy=lambda a,c:(x+s*a,bottom-s*c);c,q=xy(.8,.8),xy(.5,.5)
    b+=[line(*c,*q,COPPER,3,dashed=True),point(*c,"open",COPPER,7),point(*q,"diamond",TEAL,7),line(c[0]+14,c[1],262,c[1],COPPER,2),t(278,c[1]+2,"candidate",24,COPPER,weight=600),t(278,c[1]+34,"(0.8, 0.8)",23,COPPER),line(q[0]+14,q[1],262,q[1],TEAL,2),t(278,q[1]+8,"projection",24,TEAL,weight=600),t(278,q[1]+40,"(0.5, 0.5)",23,TEAL),t(82,234,"K",28,TEAL,serif=True)]
    svg("allocation-teaser.svg",480,300,"An allocation candidate exceeds the budget","Nonnegative allocations with total at most one form K. Candidate (0.8,0.8) lies outside; projection returns (0.5,0.5). Axes have the same scale.",b,{"B":1,"candidate":[.8,.8],"projection":[.5,.5]})


def scatter(active_only=False):
    record=json.loads((OUT/"illustrative-samples.json").read_text())
    actual=samples()
    assert actual[0]==list(map(tuple,record["rejection"]["returned_samples"]))
    assert actual[1]==list(map(tuple,record["projection"]["returned_samples"]))
    assert actual[2]==record["rejection"]["candidates_tested"] and actual[3]==record["projection"]["boundary_count"]
    def panel(title,data,draws,projection):
        b=[t(24,36,title,27,weight=600)];x,bottom,s=50,327,233
        tri(b,x,bottom,s,math_fonts=True)
        b[-5]=t(22,bottom+34,"0",22,MUTED,anchor="end")
        counts=Counter(map(tuple,data))
        for (a,c),n in sorted(counts.items(),key=lambda item:item[1]):
            color=COPPER if min(a,c,1-a-c)<=1e-10 else TEAL;r=2.8*sqrt(n)
            b+=[f'<circle cx="{x+s*a:.4f}" cy="{bottom-s*c:.4f}" r="{r:.4f}" fill="{color}" fill-opacity="{0.32 if n>1 else 0.82}"'+(f' stroke="{color}" stroke-width="1.4"' if n>1 else '')+f'><title>{n} sample{"s" if n!=1 else ""} at ({a:.8g}, {c:.8g})</title></circle>']
        b+=[t(331,93,"256 outputs",22),t(331,127,f"{draws:,} draws",22,MUTED)]
        if projection:
            b+=[t(331,184,"Boundary",22,COPPER,weight=600),t(331,218,"218/256",24,COPPER),t(331,270,"Theory",22,MUTED),t(331,302,"7/8",24,MUTED),t(98,397,f"{counts[(0.,0.)]} samples at (0, 0)",22,COPPER)]
        else:
            b+=[t(331,184,"Acceptance",22,MUTED),t(331,218,"1/8 ideal",22,MUTED),t(331,270,"Target",22,TEAL,weight=600),t(331,302,"0 boundary",22,TEAL)]
        return b
    rb=panel("Rejection",record["rejection"]["returned_samples"],actual[2],False)
    pb=panel("Projection",record["projection"]["returned_samples"],256,True)
    desc="Unchanged uniform-square synthetic record: seed 104729, equal 256 returned samples per method. No jitter is used. Circle area is proportional to the count of exactly coincident samples; the projection origin circle represents 75 samples. Boundary points are copper and interior points teal. Rejection tested 1917 candidates. Projection maps 256 candidates and has 218 boundary outputs; its ideal boundary probability is 7/8. The rejection conditional target has zero boundary probability and ideal acceptance 1/8."
    meta={"seed":104729,"n_outputs_per_method":256,"rejection_candidates_tested":actual[2],"projection_candidates_mapped":256,"projection_boundary_count":actual[3],"projection_origin_count":75,"ideal_projection_boundary_probability":7/8,"ideal_rejection_acceptance_probability":1/8,"marker_area":"proportional to exact coincident sample count"}
    svg("generation-rejection.svg",480,410,"Conditional samples by rejection",desc,rb,meta,math_fonts=True)
    svg("generation-projection.svg",480,410,"Feasible samples by projection",desc,pb,meta,math_fonts=True)
    if active_only:
        return
    combined=rb+[line(24,423,456,423),'<g transform="translate(0,445)">',*pb,'</g>',t(24,894,"Circle area = coincident sample count",22,MUTED)]
    svg("generation-poster.svg",480,925,"Rejection and projection produce different distributions",desc,combined,meta)


if __name__ == "__main__":
    validate()
    share()
    roles()
    sampler()
    geometry()
    general_illustrations()
    scatter()
    print("Compact SVGs rendered; primary record read only and validated unchanged.")
