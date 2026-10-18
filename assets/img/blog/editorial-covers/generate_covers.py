"""Deterministic, conceptual covers; not experimental results or method guarantees.

Run this file to rebuild all four sibling SVGs.  Desktop and mobile versions
share marks and colours, but recompose the geometry for their own aspect ratio.
Only the Python standard library is required.
"""

from html import escape
from math import cos, hypot, pi, sin
from pathlib import Path
import xml.etree.ElementTree as ET


OUT = Path(__file__).resolve().parent
IVORY = "#fbfaf8"
INK = "#243b3e"
TEAL = "#2c6d77"
COPPER = "#a66b50"
BLUE = "#567aa8"
GRID = "#d9dfdb"
MINT = "#e8f1ec"
PALE_BLUE = "#edf1f6"


def number(value):
    return f"{value:.2f}".rstrip("0").rstrip(".")


def path(points, close=False):
    return "M " + " L ".join(f"{number(x)},{number(y)}" for x, y in points) + (" Z" if close else "")


def line(a, b, color, width=1.5, **attrs):
    extras = " ".join(f'{key.replace("_", "-")}="{value}"' for key, value in attrs.items())
    return f'<path d="{path([a, b])}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" {extras}/>'


def dot(point, radius, color, hollow=False):
    x, y = point
    return f'<circle cx="{number(x)}" cy="{number(y)}" r="{radius}" fill="{IVORY if hollow else color}" stroke="{color if hollow else IVORY}" stroke-width="{2.8 if hollow else 2.5}"/>'


def label(x, y, content, size=27, color=INK, anchor="start", serif=False):
    family = "Georgia,Times New Roman,serif" if serif else "Arial,Helvetica,sans-serif"
    italic = ' font-style="italic"' if serif else ""
    return f'<text x="{number(x)}" y="{number(y)}" text-anchor="{anchor}" font-family="{family}" font-size="{size}" fill="{color}"{italic}>{escape(content)}</text>'


def grid(width, height, mobile):
    """A quiet field rather than a chart frame or implied physical axes."""
    step = 30 if mobile else 36
    inset = 24 if mobile else 38
    body = [f'<g stroke="{GRID}" stroke-width=".75" opacity=".56">']
    for x in range(inset, width - inset + 1, step):
        body.append(line((x, inset), (x, height - inset), GRID, .75))
    for y in range(inset, height - inset + 1, step):
        body.append(line((inset, y), (width - inset, y), GRID, .75))
    body.append("</g>")
    return "".join(body)


def document(name, width, height, title, description, metadata, body, mobile):
    content = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
  <title id="title">{escape(title)}</title>
  <desc id="desc">{escape(description)}</desc>
  <metadata>{escape(metadata)}</metadata>
  <defs>
    <marker id="return-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M2 2 L10 6 L2 10" fill="none" stroke="{COPPER}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></marker>
    <marker id="map-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto"><path d="M2 2 L10 6 L2 10" fill="none" stroke="{TEAL}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></marker>
  </defs>
  <rect width="{width}" height="{height}" fill="{IVORY}"/>
  {grid(width, height, mobile)}
  <g stroke-linejoin="round">{''.join(body)}</g>
</svg>
'''
    destination = OUT / name
    destination.write_text(content, encoding="utf-8")
    root = ET.fromstring(content)
    assert root.attrib["viewBox"] == f"0 0 {width} {height}"
    assert root.find("{http://www.w3.org/2000/svg}title") is not None
    assert root.find("{http://www.w3.org/2000/svg}desc") is not None
    assert "<image" not in content and "<script" not in content
    return destination


def hard_constraints(mobile=False):
    width, height = (600, 360) if mobile else (1100, 400)
    origin, scale = ((83, 302), 240) if mobile else ((294, 340), 292)

    def point(x, y):
        return origin[0] + x * scale, origin[1] - y * scale

    vertices = [point(0, 0), point(1, 0), point(0, 1)]
    candidate, returned = point(.8, .8), point(.5, .5)
    body = [f'<path d="{path(vertices, True)}" fill="{MINT}" stroke="{TEAL}" stroke-width="2.7"/>']

    # A few interior budget contours give the set depth without another layer
    # of explanation.  All are parallel to the actual budget boundary.
    for total in (.25, .5, .75):
        body.append(line(point(0, total), point(total, 0), "#bdd2ca", 1.1))
    body.append(label(origin[0] + scale * .17, origin[1] - scale * .16, "K", 37 if mobile else 43, TEAL, serif=True))

    # Projection is Euclidean: (0.8,0.8) -> (0.5,0.5), perpendicular to x+y=1.
    direction = ((returned[0] - candidate[0]), (returned[1] - candidate[1]))
    length = hypot(*direction)
    unit = (direction[0] / length, direction[1] / length)
    a = (candidate[0] + unit[0] * 14, candidate[1] + unit[1] * 14)
    b = (returned[0] - unit[0] * 15, returned[1] - unit[1] * 15)
    body.append(line(a, b, COPPER, 2.8, marker_end="url(#return-arrow)"))

    # The small right-angle mark distinguishes a return to the nearest point
    # from an arbitrary, visually attractive path.
    corner = 8 if mobile else 9
    normal = (2 ** -.5, -(2 ** -.5))
    tangent = (2 ** -.5, 2 ** -.5)
    corner_points = [
        (returned[0] + tangent[0] * corner, returned[1] + tangent[1] * corner),
        (returned[0] + (tangent[0] + normal[0]) * corner, returned[1] + (tangent[1] + normal[1]) * corner),
        (returned[0] + normal[0] * corner, returned[1] + normal[1] * corner),
    ]
    body.append(f'<path d="{path(corner_points)}" fill="none" stroke="{COPPER}" stroke-width="1.4" opacity=".8"/>')
    body.append(dot(candidate, 8.5 if mobile else 9, COPPER, hollow=True))
    diamond = 9 if mobile else 10
    body.append(f'<path d="{path([(returned[0], returned[1]-diamond), (returned[0]+diamond, returned[1]), (returned[0], returned[1]+diamond), (returned[0]-diamond, returned[1])], True)}" fill="{TEAL}" stroke="{IVORY}" stroke-width="2.5"/>')

    if mobile:
        candidate_label, feasible_label = (344, 119), (344, 246)
        candidate_elbow, feasible_elbow = (321, candidate[1]), (304, 237)
        font_size = 26
    else:
        candidate_label, feasible_label = (676, 117), (676, 278)
        candidate_elbow, feasible_elbow = (649, candidate[1]), (635, 269)
        font_size = 28
    body.append(line((candidate[0] + 19, candidate[1]), candidate_elbow, COPPER, 1.2))
    body.append(label(*candidate_label, "Candidate", font_size, COPPER))
    # The feasible label is below the candidate and outside the triangle.
    # A short elbow keeps the two labels from implying a second flow arrow.
    leader_start = (returned[0] + 17, returned[1] + 5)
    leader_points = [leader_start, (feasible_elbow[0] - 33, feasible_elbow[1]), feasible_elbow]
    body.append(f'<path d="{path(leader_points)}" fill="none" stroke="{TEAL}" stroke-width="1.2"/>')
    body.append(label(*feasible_label, "Feasible", font_size, TEAL))
    return document(
        f'hard-constrained-{"mobile" if mobile else "wide"}.svg', width, height,
        "From a candidate to a feasible output",
        "A copper candidate lies outside a green triangular feasible set. A perpendicular arrow returns it to the budget boundary, where a green diamond marks the feasible output.",
        "Conceptual cover. K={(x,y): x>=0, y>=0, x+y<=1}. Candidate=(0.8,0.8); Euclidean projection=(0.5,0.5). The coordinate axes have equal scale. This illustrates output correction, not a guarantee shared by all constrained-learning methods.",
        body, mobile,
    )


def support(angle):
    return 1 + .12 * cos(2 * angle) + .04 * sin(3 * angle)


def support_derivative(angle):
    return -.24 * sin(2 * angle) + .12 * cos(3 * angle)


def boundary(angle):
    """Boundary by outward-normal angle; h+h'' >= .32 proves convexity."""
    h, derivative = support(angle), support_derivative(angle)
    return h * cos(angle) - derivative * sin(angle), h * sin(angle) + derivative * cos(angle)


def radius(angle):
    """Intersect a ray with the smooth convex support-function boundary."""
    lower, upper = angle - pi / 2, angle + pi / 2
    for _ in range(58):
        middle = (lower + upper) / 2
        cross = support(middle) * sin(middle - angle) + support_derivative(middle) * cos(middle - angle)
        if cross > 0:
            upper = middle
        else:
            lower = middle
    x, y = boundary((lower + upper) / 2)
    return x * cos(angle) + y * sin(angle)


def homeomorphism(mobile=False):
    width, height = (600, 360) if mobile else (1100, 400)
    centers = [(145, 173), (452, 173)] if mobile else [(298, 192), (802, 192)]
    scale = 100 if mobile else 131
    samples = 240
    body = []

    def point(radial_fraction, angle, mapped, center):
        distance = radial_fraction * scale * (radius(angle) if mapped else 1)
        return center[0] + distance * cos(angle), center[1] - distance * sin(angle)

    for mapped, center in zip((False, True), centers):
        color, fill, guide = (TEAL, MINT, "#bad0c9") if mapped else (BLUE, PALE_BLUE, "#becbdd")
        outline = [point(1, 2 * pi * j / samples, mapped, center) for j in range(samples)]
        body.append(f'<path d="{path(outline, True)}" fill="{fill}"/>')
        for fraction in (.36, .7):
            contour = [point(fraction, 2 * pi * j / samples, mapped, center) for j in range(samples)]
            body.append(f'<path d="{path(contour, True)}" fill="none" stroke="{guide}" stroke-width="1.1"/>')
        for angle in (0, pi / 2, pi, 3 * pi / 2):
            body.append(line(center, point(1, angle, mapped, center), guide, 1.1))
        body.append(f'<path d="{path(outline, True)}" fill="none" stroke="{color}" stroke-width="2.6"/>')
        # Identical radial fractions and angles on both sides show an actual
        # correspondence under Phi(r u)=r R(u)u.  They do not imply uniformity.
        for fraction, angle in ((.53, 2.54), (.73, 4.25)):
            body.append(dot(point(fraction, angle, mapped, center), 4.5 if mobile else 5, color))
        selected_angle = .56
        body.append(line(center, point(1, selected_angle, mapped, center), COPPER, 1.8))
        body.append(dot(point(.66, selected_angle, mapped, center), 8.5 if mobile else 10, COPPER))
        body.append(dot(center, 3, INK))
        body.append(label(center[0], 320 if mobile else 373, "K" if mapped else "B", 35 if mobile else 42, color, "middle", serif=True))

    if mobile:
        a, b, phi = (269, 173), (321, 173), (295, 146)
    else:
        a, b, phi = (473, 192), (621, 192), (547, 162)
    body.append(line(a, b, TEAL, 2.1, marker_end="url(#map-arrow)"))
    body.append(label(*phi, "Φ", 34 if mobile else 39, TEAL, "middle", serif=True))
    return document(
        f'homeomorphism-{"mobile" if mobile else "wide"}.svg', width, height,
        "The same coordinates, a different domain",
        "A pale blue disk and a gently asymmetric green convex domain have matching radial grids. Copper points lie at the same fraction of corresponding rays, linked by the map Phi.",
        "Conceptual cover. Phi(r u)=r R(u)u, Phi(0)=0. The disk maps bijectively to a smooth convex domain containing the origin. Its support function h(a)=1+0.12 cos(2a)+0.04 sin(3a) satisfies h+h''>=0.32; its boundary is h n+h' t. R(u) is the unique positive ray-boundary intersection. The map preserves a radial fraction, not area or probability density.",
        body, mobile,
    )


def main():
    generated = []
    for compact in (False, True):
        generated.extend([hard_constraints(compact), homeomorphism(compact)])
    # Scientific construction checks accompany the declarative SVG validation.
    assert .8 + .8 > 1 and .5 + .5 == 1
    for j in range(720):
        angle = j * pi / 360
        assert support(angle) > 0
        assert 1 - .36 * cos(2 * angle) - .32 * sin(3 * angle) > 0
        assert radius(angle) > 0
    print("Generated and validated " + ", ".join(asset.name for asset in generated))


if __name__ == "__main__":
    main()
