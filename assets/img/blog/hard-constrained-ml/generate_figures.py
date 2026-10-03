"""Rebuild compact article SVGs with the Python standard library.

Diagrams show mechanism roles and intervention locations. The fixed synthetic
record is validated and read, never modified while figures are rendered.
"""

from pathlib import Path
from html import escape
import json
import re

OUT = Path(__file__).resolve().parent
PAPER, INK, TEAL, COPPER = "#fbfaf8", "#24363a", "#2c6d77", "#9b654e"
MUTED, LINE, FILL = "#586a6d", "#dbe3e1", "#e9f3f0"
SANS = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
SERIF = "Georgia, 'Times New Roman', serif"


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


def svg(name, w, h, title, description, body, metadata=None):
    s = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc">
<title id="title">{escape(title)}</title>
<desc id="desc">{escape(description)}</desc>
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="{TEAL}"/></marker>
  <marker id="back" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="{COPPER}"/></marker>
</defs>
<rect width="{w}" height="{h}" fill="#ffffff"/>
'''
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


def roles():
    specs=[]
    for slug in ('training','layer','coordinates','post'):
        b=[t(12,71,'x',28,serif=True)]
        if slug=='training':
            b += [line(34,62,150,62,TEAL,2.1,arrow=True),
                  *operation(158,30,165,'Model','fθ(x)'),
                  line(331,62,428,62,TEAL,2.1,arrow=True),
                  t(447,71,'y',29,serif=True),
                  t(240,137,'Constraints shape the model',24,MUTED,anchor='middle')]
            title='Training-based approaches'
            desc='Classification schematic: constraints shape how the predictor is trained or constructed; the model directly returns y.'
        else:
            middle={'layer':'Layer','coordinates':'Decode','post':'Correct'}[slug]
            detail={'layer':'in the model','coordinates':'D(u)','post':'after the model'}[slug]
            kind='map' if slug=='coordinates' else 'constraint'
            b += [line(34,62,50,62,TEAL,2.1,arrow=True),
                  *operation(57,30,109,'Model','fθ(x)'),
                  line(173,62,243,62,TEAL,2.1,arrow=True),
                  t(207,42,'u' if slug=='coordinates' else 'c',24,anchor='middle',serif=True),
                  *operation(251,30,161,middle,detail,kind=kind),
                  line(419,62,434,62,TEAL,2.1,arrow=True),t(447,71,'y',29,serif=True),
                  t(240,137,{'layer':'Training includes the operation','coordinates':'Coordinates construct a feasible output','post':'Recovery runs at inference'}[slug],23,MUTED,anchor='middle')]
            title={'layer':'Structured layers','coordinates':'Constraint parameterization','post':'Post-processing'}[slug]
            desc={'layer':'Classification schematic: a structured output operation participates in training and remains in inference.','coordinates':'Classification schematic: reference coordinates u are mapped by a specified feasible decoder D to output y.','post':'Classification schematic: a downstream correction acts after the fitted predictor; training need not include it.'}[slug]
        svg('roles-'+slug+'.svg',480,160,title,desc,b)
        specs.append((title,b))
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


def generation_interventions():
    specs=[
      ('guidance-overview','Guidance','State','Guide','the update','Next','constraint','Use an objective to steer sampling. This schematic does not prescribe a universal gradient formula or guarantee feasibility.'),
      ('correction-overview','Correction','Candidate','Correct','or solve','Output','constraint','Apply a correction to a specified state, output estimate or final sample. Intermediate corrections need a method-specific connection to continued sampling.'),
      ('coordinates-overview','Parameterization','u ∈ U','Decode','D(u)','y ∈ K','map','Generate valid reference coordinates and use a specified decoder whose image lies in the feasible set. This is distinct from intrinsic geometry.'),
      ('geometry-overview','Geometry-aware sampling','On M','Geometric','update','On M','map','Use dynamics and numerical operations appropriate to a domain or manifold. The diagram represents that geometry only, not arbitrary additional constraints.')]
    for name,title,left,middle,detail,right,kind,desc in specs:
        b=[rect(16,34,124,64,'#ffffff','#c8d3d5',9),t(78,74,left,24,anchor='middle'),
           *operation(189,34,136,middle,detail,kind=kind),
           rect(374,34,100,64,'#ffffff','#c8d3d5',9),t(424,74,right,22,anchor='middle'),
           line(148,66,181,66,TEAL,2.1,arrow=True),line(333,66,366,66,TEAL,2.1,arrow=True)]
        svg(name+'.svg',480,132,title,desc,b,{'scope':'classification schematic; algorithm details in companion repository'})


def general_illustrations():
    """Two original, static mechanism illustrations; neither is a trained result.

    The feedforward diagram expands a small MLP into weighted sums, ReLU
    operations, and a readout. The flow diagram uses an analytic monotone toy
    transport so every trajectory and marginal is internally consistent.
    Visual references: Colah's LSTM walkthrough (shape grammar and focus) and
    Diffusion Meets Flow Matching (trajectories linked to endpoint marginals).
    """
    from math import exp, pi, tanh
    from statistics import NormalDist

    # ---------- A real layer structure, with data drawn as feature vectors. ---
    x_values = [.8, .35, .6, .15]
    w1 = [[.6, -.2, .4, .1], [-.3, .8, .5, .2], [.2, .1, -.6, .9]]
    b1 = [.05, .1, .25]
    h_values = [max(0., sum(w*x for w, x in zip(row, x_values))+bias)
                for row, bias in zip(w1, b1)]
    w2 = [[.65, .4, -.1], [-.2, .5, .8]]
    b2 = [.05, .1]
    y_values = [sum(w*h for w, h in zip(row, h_values))+bias
                for row, bias in zip(w2, b2)]
    inputs, hidden, outputs = [120, 165, 210, 255], [130, 202, 274], [172, 234]
    nn = [t(46, 35, "Input", 26, weight=500, anchor="middle"),
          t(249, 35, "Learned layers", 26, weight=500, anchor="middle"),
          t(432, 35, "Output", 26, weight=500, anchor="middle"),
          rect(106, 57, 297, 248, "#f2f6f4", "#c7d9d4", 18),
          t(140, 88, "Mix", 26, TEAL, weight=500, anchor="middle"),
          t(229, 88, "ReLU", 26, TEAL, weight=500, anchor="middle"),
          t(366, 88, "Mix", 26, TEAL, weight=500, anchor="middle")]

    # Every input reaches every hidden weighted sum; every hidden activation
    # reaches both readout sums. The copper route is an explanatory focus.
    for yi in inputs:
        for yh in hidden:
            nn.append(line(78, yi, 122, yh, "#bfd2cd", 1.8))
    for value, yh in zip(h_values, hidden):
        right = 278+36*value
        for yo in outputs:
            nn.append(line(right, yh, 348, yo, "#bfd2cd", 1.8))
    nn += [line(78, inputs[1], 122, hidden[1], COPPER, 3),
           line(278+36*h_values[1], hidden[1], 348, outputs[0], COPPER, 3)]

    # Brackets distinguish the input/output vectors from learned operations.
    nn += [route("M29 106 H22 V269 H29", INK, arrow=False),
           route("M75 106 H82 V269 H75", INK, arrow=False),
           route("M422 154 H415 V252 H422", INK, arrow=False),
           route("M452 154 H459 V252 H452", INK, arrow=False)]
    for value, y in zip(x_values, inputs):
        nn.append(rect(32, y-8, 40*value, 16, TEAL, TEAL, 3))
    for index, (value, y) in enumerate(zip(h_values, hidden)):
        selected = index == 1
        color = COPPER if selected else TEAL
        # Weighted-sum unit. Bias is included in the affine operation.
        nn += [f'<circle cx="140" cy="{y}" r="18" fill="{INK}"/>',
               t(140, y+9, "Σ", 27, "#ffffff", anchor="middle", serif=True),
               line(160, y, 193, y, color, 2.7, arrow=True),
               rect(196, y-22, 67, 44, "#ffffff", "#a8c5bd", 8),
               line(208, y+11, 251, y+11, "#cbdad5", 1.6),
               line(228, y+15, 228, y-14, "#cbdad5", 1.6),
               route(f"M209 {y+10} H228 L248 {y-12}", color, arrow=False),
               line(263, y, 276, y, color, 2.7),
               rect(278, y-7, 36*value, 14, color, color, 3)]
    for index, (value, y) in enumerate(zip(y_values, outputs)):
        color = COPPER if index == 0 else TEAL
        nn += [f'<circle cx="366" cy="{y}" r="18" fill="{INK}"/>',
               t(366, y+9, "Σ", 27, "#ffffff", anchor="middle", serif=True),
               line(386, y, 411, y, color, 2.7, arrow=True),
               rect(428, y-8, 35*value, 16, color, color, 3)]
    nn += [t(52, 306, "x", 29, anchor="middle", serif=True),
           t(437, 306, "ŷ", 29, anchor="middle", serif=True),
           t(240, 346, "Affine → ReLU → Affine", 26, MUTED, anchor="middle"),
           t(240, 387, "ŷ = fθ(x)", 32, anchor="middle", serif=True)]
    svg("neural-network-prediction.svg", 480, 404,
        "A feedforward neural network maps a feature vector to a prediction",
        "A small multilayer perceptron is expanded into its actual computation. "
        "Four input features enter three affine weighted-sum units, each followed "
        "by a ReLU activation, before two affine readout units form the output "
        "vector. Bars represent feature values, dark sum nodes are learned affine "
        "operations, and the plotted kink denotes ReLU. The copper route helps "
        "follow one contribution; all connections remain active. Values come "
        "from a hand-specified toy network, not training or experimental data. "
        "This unconstrained network does not itself encode feasibility.", nn,
        {"kind": "original architecture illustration; hand-specified toy MLP",
         "architecture": "4 inputs, 3 ReLU units, 2 affine outputs",
         "input": x_values, "W1": w1, "b1": b1, "W2": w2, "b2": b2,
         "hidden": h_values, "output": y_values,
         "visual_reference": "https://colah.github.io/posts/2015-08-Understanding-LSTMs/"})

    # ---------- Continuous flow: coherent particles + coherent marginals. ---
    # X_t(z) interpolates between a standard normal prior and a smooth monotone
    # target map T. Since dT/dz > 0, this gives a well-defined 1D velocity field.
    # The plot is not a fitted v_theta or a feasibility result.
    normal = NormalDist()
    target = lambda z: 1.15*tanh(1.8*z)+.32*z
    target_derivative = lambda z: 2.07*(1-tanh(1.8*z)**2)+.32
    blend = lambda tm: 3*tm*tm-2*tm*tm*tm
    position = lambda z, tm: (1-blend(tm))*z+blend(tm)*target(z)
    quantiles = [normal.inv_cdf((i+.5)/44) for i in range(44)]
    left, right, top, bottom = 120, 398, 78, 278
    py = lambda value: (top+bottom)/2-value*(bottom-top)/5.2
    px = lambda tm: left+(right-left)*tm
    ff = [t(77, 35, "Prior", 26, weight=500, anchor="middle"),
          t(260, 35, "Transport", 26, weight=500, anchor="middle"),
          t(441, 35, "Target", 24, weight=500, anchor="middle"),
          # One shared state scale throughout, rather than separate clouds.
          line(left, top-10, left, bottom+5, LINE, 1.4),
          line(px(.5), top-10, px(.5), bottom+5, LINE, 1.4, dashed=True),
          line(right, top-10, right, bottom+5, LINE, 1.4),
          '<g transform="translate(32 178) rotate(-90)">'
          +t(0, 0, "sample value xₜ", 25, MUTED, anchor="middle")+'</g>']

    # Actual analytic marginal silhouettes, in a common horizontal density
    # scale: p_1(T(z)) = p_0(z)/T'(z). Use dense z values only for the silhouettes.
    z_grid = [-2.6+i*5.2/200 for i in range(201)]
    prior_density = lambda z: exp(-z*z/2)/(2*pi)**.5
    prior_path = "M104 "+f"{py(-2.6):.3f} "
    prior_path += " ".join(f"L{104-72*prior_density(z):.3f} {py(z):.3f}" for z in z_grid)
    prior_path += f" L104 {py(2.6):.3f} Z"
    target_path = f"M414 {py(target(-2.6)):.3f} "
    target_path += " ".join(f"L{414+72*prior_density(z)/target_derivative(z):.3f} "
                            f"{py(target(z)):.3f}" for z in z_grid)
    target_path += f" L414 {py(target(2.6)):.3f} Z"
    ff += [f'<path d="{prior_path}" fill="{FILL}" stroke="{TEAL}" stroke-width="2.2"/>',
           f'<path d="{target_path}" fill="{FILL}" stroke="{TEAL}" stroke-width="2.2"/>']

    # Continuous trajectories make transport visible in a static image.
    for z in quantiles:
        d = " ".join(("M" if j == 0 else "L")
                     +f"{px(j/80):.3f} {py(position(z,j/80)):.3f}"
                     for j in range(81))
        ff.append(f'<path d="{d}" fill="none" stroke="{TEAL}" '
                  'stroke-opacity=".32" stroke-width="1.45"/>')
        for tm in (0., .5, 1.):
            ff.append(f'<circle cx="{px(tm):.3f}" cy="{py(position(z,tm)):.3f}" '
                      f'r="2.5" fill="{TEAL}" fill-opacity=".75"/>')

    # A focused particle with tangent arrows conveys direction without motion.
    focus_quantile = (32+.5)/44
    focus = normal.inv_cdf(focus_quantile)
    focus_path = " ".join(("M" if j == 0 else "L")
                          +f"{px(j/80):.3f} {py(position(focus,j/80)):.3f}"
                          for j in range(81))
    ff.append(route(focus_path, COPPER, arrow=False))
    for a, c in ((.25, .32), (.64, .71)):
        ff.append(line(px(a), py(position(focus,a)), px(c), py(position(focus,c)),
                       COPPER, 2.8, arrow=True))
    for tm in (0., .5, 1.):
        ff.append(point(px(tm), py(position(focus,tm)), "circle", COPPER, 5.5))
    ff += [line(left, 295, right+8, 295, TEAL, 2.2, arrow=True),
           t(left, 328, "0", 26, MUTED, anchor="middle"),
           t(px(.5), 328, "0.5", 26, MUTED, anchor="middle"),
           t(right, 328, "1", 26, MUTED, anchor="middle"),
           t(260, 363, "generation time t", 26, MUTED, anchor="middle"),
           # Use tspan subscripts: Georgia has no reliable Unicode subscript t.
           t(240, 404, "dxₜ/dt = vθ(xₜ, t)", 31, anchor="middle", serif=True)
           .replace("dxₜ/dt", 'dx<tspan dy="7.44" font-size="21.7">t</tspan>'
                    '<tspan dy="-7.44">/dt</tspan>')
           .replace("(xₜ, t)", '(x<tspan dy="7.44" font-size="21.7">t</tspan>'
                    '<tspan dy="-7.44">, t)</tspan>')]
    svg("flow-generation-general.svg", 480, 420,
        "A flow transports particles from a prior toward a data distribution",
        "In one shared coordinate system, continuous curves follow particles "
        "from a normal prior at generation time zero toward an illustrative "
        "bimodal target at time one. The copper curve identifies one particle "
        "and its tangent arrows show its motion. Dots mark the same particles "
        "at times zero, one-half, and one. Endpoint silhouettes show the exact "
        "analytic marginal densities on the same density scale. The hand-specified "
        "smooth transport represents the role played by a learned velocity field "
        "v_theta in a flow model; no velocity field was trained here. Generation "
        "time t is not the physical time along a robot trajectory, and no output "
        "constraint is encoded in this general illustration.", ff,
        {"kind": "original analytic toy transport, not learned model samples",
         "particles": 44,
         "quantiles": "(i+0.5)/44, i=0,...,43, of standard normal",
         "map": "T(z)=1.15 tanh(1.8z)+0.32z",
         "schedule": "s(t)=3t^2-2t^3",
         "transport": "X_t(z)=(1-s(t))z+s(t)T(z)",
         "density": "p_1(T(z))=p_0(z)/T'(z)",
         "focus_quantile": focus_quantile,
         "visual_reference": "https://diffusionflow.github.io/"})


def tri(b,x,bottom,s):
    b+=[f'<path d="M{x} {bottom} L{x+s} {bottom} L{x} {bottom-s} Z" fill="{FILL}" stroke="{TEAL}" stroke-width="2.5"/>',line(x-16,bottom,x+s+30,bottom,MUTED,2),line(x,bottom+16,x,bottom-s-22,MUTED,2),t(x-14,bottom+34,"0",22,MUTED,anchor="end"),t(x+s,bottom+34,"1",22,MUTED,anchor="middle"),t(x-14,bottom-s+8,"1",22,MUTED,anchor="end"),t(x+s+37,bottom+8,"y₁",24,MUTED),t(x-8,bottom-s-29,"y₂",24,MUTED)]


def geometry():
    b=[];x,bottom,s=46,299,221
    tri(b,x,bottom,s)
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
          t(68,284,"K",26,TEAL,serif=True)]
    svg("mechanism-poster.svg",480,380,"Three mechanisms on a triangular feasible set","Synthetic geometry, not neural-network training. Candidate (0.8,0.8) violates the nonnegative total-budget set K. The quadratic penalty with lambda=1 returns (0.6,0.6); projection returns (0.5,0.5); b=0.6,q=0.7 construct (0.42,0.18). Formula and mechanism meaning belong in the HTML caption.",b,{"B":1,"candidate":[.8,.8],"quadratic_penalty_lambda":1,"penalty_output":[.6,.6],"projection_output":[.5,.5],"parameterization":{"b":.6,"q":.7,"output":[.42,.18]}})
    b=[];x,bottom,s=45,250,190
    tri(b,x,bottom,s);xy=lambda a,c:(x+s*a,bottom-s*c);c,q=xy(.8,.8),xy(.5,.5)
    b+=[line(*c,*q,COPPER,3,dashed=True),point(*c,"open",COPPER,7),point(*q,"diamond",TEAL,7),line(c[0]+14,c[1],262,c[1],COPPER,2),t(278,c[1]+2,"candidate",24,COPPER,weight=600),t(278,c[1]+34,"(0.8, 0.8)",23,COPPER),line(q[0]+14,q[1],262,q[1],TEAL,2),t(278,q[1]+8,"projection",24,TEAL,weight=600),t(278,q[1]+40,"(0.5, 0.5)",23,TEAL),t(82,234,"K",28,TEAL,serif=True)]
    svg("allocation-teaser.svg",480,300,"An allocation candidate exceeds the budget","Nonnegative allocations with total at most one form K. Candidate (0.8,0.8) lies outside; projection returns (0.5,0.5). Axes have the same scale.",b,{"B":1,"candidate":[.8,.8],"projection":[.5,.5]})


def scatter():
    record=json.loads((OUT/"illustrative-samples.json").read_text())
    actual=samples()
    assert actual[0]==list(map(tuple,record["rejection"]["returned_samples"]))
    assert actual[1]==list(map(tuple,record["projection"]["returned_samples"]))
    assert actual[2]==record["rejection"]["candidates_tested"] and actual[3]==record["projection"]["boundary_count"]
    def panel(title,data,draws,projection):
        b=[t(24,36,title,27,weight=600)];x,bottom,s=50,327,233
        tri(b,x,bottom,s)
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
    svg("generation-rejection.svg",480,410,"Conditional samples by rejection",desc,rb,meta)
    svg("generation-projection.svg",480,410,"Feasible samples by projection",desc,pb,meta)
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
