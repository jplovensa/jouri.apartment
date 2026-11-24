"""Build the original fitted furniture meshes modelled from Interiola's drawing set."""
import math
import sys
from array import array
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/models"
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
requested = set(sys.argv[sys.argv.index("--") + 1:]) if "--" in sys.argv else set()


def material(name, rgb, rough=.55, metal=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Metallic"].default_value = metal
    return mat


teak = material("TACO TH 356 | Baltimore teak", (.087, .024, .013), .48)
end_grain = material("Teak edge band", (.073, .020, .011), .48)
olive = material("TACO TH 076 | Thyme Rhythm", (.080, .093, .042))
rust = material("TACO TH 059 | South Terracotta", (.227, .025, .006))
stone = material("Sandimas Amarillo | Honed granite", (.434, .386, .337), .44)
white = material("Ivory linen", (.81, .79, .73), .85)
fabric = material("TACO TH 1239 | Avena Linen", (.775, .720, .645), .82)
ochre = material("Cognac upholstery", (.43, .193, .067), .66)
ceramic = material("Glazed ivory ceramic", (.87, .86, .80), .19)
dark = material("Dark powder coated metal", (.032, .028, .024), .43, .4)
brass = material("Satin brass", (.58, .38, .15), .30, .76)
mirror = material("Mirror and brushed steel", (.52, .57, .56), .21, .83)
green_tile = material("Olive glazed mosaic", (.073, .109, .055), .27)
grout = material("Warm grey grout", (.32, .32, .25))
led = material("Warm integrated lighting", (.91, .55, .24), .32)
shader = led.node_tree.nodes.get("Principled BSDF")
shader.inputs["Emission Color"].default_value = (1, .50, .16, 1)
shader.inputs["Emission Strength"].default_value = 1.4
glass = material("Clear shower glass", (.72, .86, .83), .11)
glass.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = .29
glass.surface_render_method = "DITHERED"

# Swatch textures cropped from the supplied Interiola materials sheet, page 15.
for mat, filename in ((teak, "baltimore-teak.png"), (stone, "amarillo-granite.png")):
    image = bpy.data.images.load(str(ROOT / "assets/materials" / filename), check_existing=True)
    image.pack()
    nodes = mat.node_tree.nodes
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    mat.node_tree.links.new(tex.outputs["Color"], nodes.get("Principled BSDF").inputs["Base Color"])

almond_burl = material("F07 Almond burl veneer", (.46, .327, .206), .53)
marshmallow = material("TACO TH 057 DB | Marshmallow White", (.874, .852, .803), .57)

room_nodes = {}
parent = None


def asset(room, name, x, z):
    global parent
    parent = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(parent)
    parent.location = (x, -z, 0)
    room_nodes.setdefault(room, []).append(parent)


def surface(obj, name, mat):
    obj.name = name
    obj.parent = parent
    obj.data.materials.append(mat)
    return obj


def xyz(x, y, z):
    return (x, -z, y)


def panel(name, w, h, d, x, y, z, mat, edge=.006):
    bpy.ops.mesh.primitive_cube_add(size=2, location=xyz(x, y, z))
    obj = surface(bpy.context.object, name, mat)
    for vertex in obj.data.vertices:
        vertex.co.x *= w / 2
        vertex.co.y *= d / 2
        vertex.co.z *= h / 2
    if edge:
        bevel = obj.modifiers.new("Rounded joinery edges", 'BEVEL')
        bevel.width = min(edge, w / 3, h / 3, d / 3)
        bevel.segments = 2
        obj.modifiers.new("Weighted face normals", 'WEIGHTED_NORMAL')
    return obj


def rod(name, a, b, radius, mat, tip_radius=None):
    start, end = (Vector(xyz(*point)) for point in (a, b))
    axis = end - start
    if tip_radius is None:
        tip_radius = radius
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=radius, radius2=tip_radius,
                                    depth=axis.length, location=(start + end) / 2)
    obj = surface(bpy.context.object, name, mat)
    obj.rotation_euler = axis.to_track_quat("Z", "Y").to_euler()
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def rings(name, center, sections, mat, sides=24, waves=0):
    """Sculpt upholstery or a ceramic rim with ellipsoidal rings of changing profile."""
    vertices = []
    for i, (height, rx, rz) in enumerate(sections):
        for segment in range(sides):
            angle = math.tau * segment / sides
            ripple = waves * math.sin(7 * angle + i * .6)
            x = center[0] + rx * math.cos(angle)
            z = center[2] + rz * math.sin(angle)
            vertices.append(xyz(x, center[1] + height + ripple, z))
    faces = [tuple(range(sides - 1, -1, -1))]
    for i in range(len(sections) - 1):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(range(len(vertices) - sides, len(vertices))))
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    surface(obj, name, mat)
    for face in data.polygons:
        face.use_smooth = True
    return obj


def cushion(name, w, d, h, x, y, z, mat, ripple=.002):
    # Superellipse gives straight sides with soft, inflated corners.
    obj = rings(name, (x, y, z), [
        (-h * .48, w * .40, d * .40), (-h * .27, w * .49, d * .48),
        (0, w * .50, d * .50), (h * .32, w * .45, d * .44), (h * .50, w * .23, d * .27),
    ], mat, 28, ripple)
    for vert in obj.data.vertices:
        px = (vert.co.x - x) / (w / 2)
        pz = (-vert.co.y - z) / (d / 2)
        vert.co.x = x + math.copysign(abs(px) ** .61, px) * w / 2
        vert.co.y = -z - math.copysign(abs(pz) ** .61, pz) * d / 2


cotton = material("Ivory cotton percale bedding", (.85, .839, .815), .91)
cotton_thread = material("Ivory stitching", (.67, .655, .623), .89)
olive_cloth = material("Olive woven accent pillow", (.105, .128, .073), .94)
olive_thread = material("Olive piping", (.075, .095, .046), .92)


def fabric_grid(name, rows, cols, point, mat, thickness=0):
    vertices = [xyz(*point(i / cols, j / rows)) for j in range(rows + 1) for i in range(cols + 1)]
    faces = []
    for j in range(rows):
        for i in range(cols):
            a = j * (cols + 1) + i
            faces.append((a, a + cols + 1, a + cols + 2, a + 1))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name="Fabric UV")
    for loop in mesh.loops:
        j, i = divmod(loop.vertex_index, cols + 1)
        uv.data[loop.index].uv = (i / cols, j / rows)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    surface(obj, name, mat)
    for face in mesh.polygons:
        face.use_smooth = True
    if thickness:
        seam = obj.modifiers.new("Closed fabric hem", 'SOLIDIFY')
        seam.thickness = thickness
        seam.offset = -1
    return obj


def seam_line(name, points, mat, radius=.0018):
    centers = [Vector(xyz(*point)) for point in points]
    vertices = []
    sides = 6
    for i, center in enumerate(centers):
        forward = (centers[min(i + 1, len(centers) - 1)] - centers[max(0, i - 1)]).normalized()
        across = forward.cross(Vector((0, 0, 1)))
        if across.length < .001:
            across = forward.cross(Vector((0, 1, 0)))
        across.normalize()
        up = across.cross(forward).normalized()
        for side in range(sides):
            theta = math.tau * side / sides
            vertices.append(center + radius * (math.cos(theta) * across + math.sin(theta) * up))
    faces = [
        (i * sides + j, (i + 1) * sides + j, (i + 1) * sides + (j + 1) % sides, i * sides + (j + 1) % sides)
        for i in range(len(centers) - 1) for j in range(sides)
    ]
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    surface(obj, name, mat)
    for face in data.polygons:
        face.use_smooth = True


def drape(name, width, z_start, z_end, mattress_width, mattress_foot, top, fall, mat=cotton):
    def point(u, v):
        local_x = (u - .5) * width
        local_z = z_start + (z_end - z_start) * v
        edge_side = max(0, (abs(local_x) - (mattress_width / 2 - .035)) / (width / 2 - mattress_width / 2 + .035))
        edge_foot = max(0, (local_z - (mattress_foot - .04)) / (z_end - mattress_foot + .04)) if z_end > mattress_foot else 0
        drop = min(1, max(edge_side, edge_foot))
        fold = (math.sin(26 * local_z + local_x * 10) + .37 * math.sin(54 * local_z - 9 * local_x))
        valleys = math.sin(7 * math.pi * v + .25 * math.sin(5 * math.pi * u))
        batting = .012 + .010 * math.sin(math.pi * u)**2 * math.sin(math.pi * v)
        y = top + batting + .006 * valleys + .006 * math.sin(34 * u + 18 * v) * math.sin(math.pi * v)
        y += (.008 + .013 * drop) * fold * min(1, drop * 1.4)
        y -= fall * drop**1.58
        # Tuck the shoulders under at the foot so the quilt reads as a curved volume.
        x = local_x - math.copysign(.019 * edge_side**2, local_x) * (.6 + .4 * v)
        z = local_z - .017 * edge_foot**2 + .007 * drop * math.sin(32 * u + 11 * v)
        return x, y, z

    fabric_grid(name, 42, 36, point, mat, .003)
    for u in (0, 1):
        seam_line(f"{name} sewn side hem", [point(u, i/42) for i in range(43)], cotton_thread)
    for v in (0, 1):
        seam_line(f"{name} stitched binding", [point(i/36, v) for i in range(37)], cotton_thread)
    if mat == cotton:
        for v in (.17, .36, .55, .74):
            seam_line("Subtle quilt stitching", [(x, y + .0009, z) for x, y, z in (point(i/34, v) for i in range(2,33))],
                      cotton_thread, .00075)


def sewn_pillow(name, w, depth, height, x, y, z, angle, lean, mat, trim):
    cos_yaw, sin_yaw = math.cos(angle), math.sin(angle)

    def point(u, v, lid):
        a, b = 2*u-1, 2*v-1
        envelope = max(0, (1-a*a) * (1-b*b))
        side = (2*u-1) * w/2 * (1-.062*abs(b)**8)
        fore = (2*v-1) * depth/2 * (1-.075*abs(a)**8)
        puff = height * (.46 if lid else -.29) * envelope**.74
        pinch = .008 * math.sin(17*a+5*b) * (abs(b)**3 + abs(a)**3) * envelope**.6
        return (x + side*cos_yaw - fore*sin_yaw, y + puff + pinch - fore*lean,
                z + side*sin_yaw + fore*cos_yaw)

    fabric_grid(name, 20, 24, lambda u, v: point(u, v, True), mat)
    fabric_grid(f"{name} reverse", 20, 24, lambda u, v: point(1-u, v, False), mat)
    edge = [(i/24,0) for i in range(25)] + [(1,i/20) for i in range(1,21)]
    edge += [(1-i/24,1) for i in range(1,25)] + [(0,1-i/20) for i in range(1,21)]
    seam_line(f"{name} corded seam", [point(u,v,True) for u,v in edge], trim, .0028)


def cabinet(w, h, d, count=2, front=teak, open_shelves=False, base=.08):
    t = .018
    panel("Recessed toe kick", w - .04, base, d - .06, 0, base / 2, -.018, end_grain)
    for x in (-w / 2 + t / 2, w / 2 - t / 2):
        panel("Veneered side", t, h - base, d, x, (h + base) / 2, 0, teak)
    for y in (base + t / 2, h - t / 2):
        panel("Cabinet horizontal", w - 2 * t, t, d, 0, y, 0, teak)
    panel("Recessed cabinet back", w - 2*t, h - base - 2*t, .014, 0, (h + base)/2, -d/2 + .009, end_grain)
    if open_shelves:
        for i in range(1, count):
            panel("Display shelf", w - 2 * t, t, d - .023, 0, base + (h - base) * i / count, 0, teak)
            panel("Integrated LED strip", w - 2*t - .021, .007, .007, 0, base + (h-base)*i/count - .012, d/2 - .03, led, .002)
    else:
        step = (w - 2 * t) / count
        for i in range(count):
            x = -w / 2 + t + step * (i + .5)
            panel("Inset cabinet door", step - .004, h - base - 2*t - .009, .018, x, (h + base)/2, d/2 - .003, front)
            rod("Satin pull", (x - .035, h - .068, d / 2 + .011),
                (x + .035, h - .068, d / 2 + .011), .006, brass)


def rotate(degrees):
    parent.rotation_euler.z = math.radians(degrees)


# F03 kitchen along the east wall. Local x runs from the bathroom toward dining.
# Sheets 13 and 24–37: 2,262 mm base run, followed by the 400 mm dispenser,
# 589 mm refrigerator bay and 350 mm chamfered display cabinet.
def joinery_prism(name, footprint, base, height, mat):
    count = len(footprint)
    vertices = [xyz(x, y, z) for y in (base, base + height) for x, z in footprint]
    faces = [tuple(range(count)), tuple(range(2 * count - 1, count - 1, -1))]
    faces.extend((i, i + count, (i + 1) % count + count, (i + 1) % count) for i in range(count))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name="Joinery UV")
    for face in mesh.polygons:
        for loop_index in face.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv = (vertex.x / .6, -vertex.y / .6 if face.index < 2 else vertex.z / 1.2)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    surface(obj, name, mat)


def framed_front(name, w, h, x, y, z, mat, trim):
    panel(name, w, h, .018, x, y, z, mat, .003)
    for edge in (-1, 1):
        panel(f"{name} vertical frame", .017, h, .006, x + edge * (w - .017)/2, y, z + .011, trim, .002)
        panel(f"{name} horizontal frame", w - .034, .017, .006, x, y + edge * (h - .017)/2, z + .011, trim, .002)


asset("social", "F03 Olive and teak kitchen", 6.166, 2.25)
rotate(-90)
panel("Recessed Thyme Rhythm plinth", 2.258, .08, .664, 1.131, .04, .343, olive)
panel("Lower cabinet carcass", 2.258, .615, .699, 1.131, .3875, .36, olive)
door_start = .007
for w in (.345, .345, .372, .349, .349, .488):
    x = door_start + w / 2
    framed_front("Thyme Rhythm framed base door", w - .005, .718, x, .441, .719, olive, olive)
    for y in (.173, .190):
        panel("Black base door vent", min(.16, w * .36), .007, .004, x, y, .733, dark, .002)
    door_start += w

# Existing Amarillo stone wraps the rectangular client sink opening.
for left, right, back, front in ((0, .245, 0, .74), (.690, 2.262, 0, .74),
                                 (.245, .690, 0, .185), (.245, .690, .566, .74)):
    panel("Sandimas Amarillo counter", right - left, .03, front - back,
          (left + right) / 2, .815, (back + front) / 2, stone, .0012)
panel("Stone backsplash", 2.261, .609, .014, 1.131, 1.1345, .015, stone, .001)
sink_x, sink_z = .4675, .3755
panel("Brushed sink basin", .415, .012, .349, sink_x, .699, sink_z, mirror, .014)
for edge in (-1, 1):
    panel("Sink side rim", .039, .010, .426, sink_x + edge * .222, .832, sink_z, mirror, .003)
    panel("Sink end rim", .406, .010, .024, sink_x, .832, sink_z + edge * .199, mirror, .003)
    panel("Sink polished side", .011, .128, .369, sink_x + edge * .208, .765, sink_z, mirror, .006)
    panel("Sink polished end", .41, .128, .011, sink_x, .765, sink_z + edge * .18, mirror, .006)
rings("Sink drain", (sink_x, .708, sink_z), [(0, .029, .029), (.004, .027, .027)], dark)
spout = [(sink_x, .835, .133), (sink_x, 1.041, .133), (sink_x, 1.106, .153),
         (sink_x, 1.130, .194), (sink_x, 1.107, .246), (sink_x, 1.051, .267)]
seam_line("Curved black sink tap", spout, dark, .014)
panel("Existing two-ring gas cooktop", .663, .021, .405, 1.430, .843, .411, dark, .019)
for x in (1.24, 1.62):
    rings("Gas burner rings", (x, .856, .411), [(0, .103, .103), (.008, .101, .101), (.012, .074, .074)],
          dark)
    for offset in (-.067, .067):
        panel("Cast burner support", .017, .015, .153, x + offset, .875, .411, dark, .003)
    panel("Gas control", .032, .016, .026, x, .861, .571, dark, .005)

panel("F03 upper carcass", 2.260, 1.005, .390, 1.131, 2.055, .201, teak)
for x, w, bottom in ((.1775, .35, 1.432), (.531, .352, 1.432), (.885, .352, 1.432),
                     (1.236, .346, 1.555), (1.584, .346, 1.555), (2.0125, .495, 1.76), (2.0125, .495, 1.432)):
    top = 1.756 if x > 2 and bottom < 1.5 else 2.558
    framed_front("Baltimore teak upper door", w, top - bottom, x, (top + bottom)/2, .409, teak, end_grain)
    rod("Round gold cabinet knob", (x - w/2 + .042, bottom + .042, .421),
        (x - w/2 + .042, bottom + .042, .448), .010, brass)
panel("Fitted extractor hood", .660, .093, .404, 1.41, 1.498, .228, dark, .018)
panel("Extractor front lip", .656, .029, .096, 1.41, 1.455, .429, dark)
panel("Teak overhead adjuster", 2.262, .050, .615, 1.131, 2.584, .308, teak, .004)
for x, width in ((.529, 1.049), (2.0105, .486)):
    panel("3500 K worktop LED", width, .008, .015, x, 1.424, .348, led, .001)
panel("3500 K upper wash LED", 2.248, .008, .015, 1.131, 2.555, .465, led, .001)

asset("social", "F03 Side cabinetry and refrigerator", 6.166, 2.25)
rotate(-90)
bay_left, bay_right, end = 2.662, 3.251, 3.601
end_shape = [(bay_right, .005), (3.334, .005), (end, .370), (end, .600), (bay_right, .600)]
canopy_shape = [(2.264, .002), (3.334, .002), (end, .370), (end, .615), (2.264, .615)]
joinery_prism("Chamfered cabinet canopy", canopy_shape, 2.559, .050, teak)
joinery_prism("Existing Amarillo plinth", canopy_shape, .001, .079, stone)
panel("Dispenser side cabinet", .397, 2.477, .561, 2.463, 1.3195, .289, teak)
# The low dispenser door has a dark, inset access opening.
for x, w, y, h in ((2.331, .128, .5945, 1.029), (2.596, .128, .5945, 1.029),
                   (2.464, .137, .413, .665), (2.464, .137, .995, .225)):
    panel("Framed dispenser access door", w, h, .020, x, y, .580, teak)
panel("Recessed dispenser tap", .135, .158, .016, 2.464, .855, .567, dark)
for y, h in ((1.432, .64), (2.147, .78)):
    framed_front("Baltimore teak side door", .393, h, 2.463, y, .587, teak, end_grain)

fridge = material("Graphite refrigerator enamel", (.021, .027, .033), .29, .17)
fridge_edge = material("Refrigerator door gasket", (.009, .011, .012), .56)
fridge_x = (bay_left + bay_right) / 2
panel("Top cabinet over refrigerator", .584, .850, .565, fridge_x, 2.132, .289, teak)
framed_front("Over-fridge teak door", .584, .837, fridge_x, 2.137, .588, teak, end_grain)
panel("Refrigerator cabinet shell", .548, 1.563, .500, fridge_x, .8695, .297, fridge_edge, .016)
panel("Refrigerator lower door", .556, .985, .054, fridge_x, .5875, .561, fridge, .020)
panel("Refrigerator upper freezer door", .556, .561, .054, fridge_x, 1.371, .561, fridge, .021)
panel("Recessed refrigerator grip", .490, .020, .017, fridge_x, 1.091, .587, fridge_edge, .007)
panel("Freezer badge", .025, .021, .002, fridge_x + .215, 1.553, .589, mirror, .002)

joinery_prism("Chamfered cabinet base", end_shape, .081, .021, teak)
panel("End shelving left panel", .019, 2.455, .594, bay_right + .010, 1.3295, .302, teak)
joinery_prism("Angled return at entry", [(3.320, .007), (3.333, .007), (end, .370), (end, .599),
                                      (end - .018, .599), (end - .018, .372)], .081, 2.476, teak)
for y in (1.268, 1.751, 2.143, 2.523):
    joinery_prism("Chamfered display shelf", end_shape, y, .023, teak)
    if y > 1.3:
        panel("3500 K shelf LED", .273, .008, .009, 3.427, y - .008, .463, led, .001)
panel("Shelf recess back", .304, 1.265, .017, 3.421, 1.899, .377, end_grain)
framed_front("Dining-end tall cabinet door", .333, 1.177, 3.425, .6745, .600, teak, end_grain)

# F01 shop sheet 21: 1,500 x 550 mm, counter at 950 mm, 810 mm raised pass.
asset("social", "F01 Two-tier tiled island", 4.66, 5.45)
rotate(-90)
for part in (-1, 1):
    x = -.665 if part == -1 else .145
    w = .175 if part == -1 else .95
    panel("Teak island support", w, .91, .45, x, .455, .014, teak)
panel("Tiled service counter", 1.50, .04, .55, 0, .930, 0, green_tile)
for col in range(24):
    for row in range(5):
        x = -.716 + col * .062
        z = -.215 + row * .106
        if x < .06 and z < -.025:
            continue
        panel("Glossy green island tile", .060, .0025, .103, x, .951, z, green_tile, 0)
panel("Raised teak pass", .810, .22, .25, -.345, 1.060, -.15, teak)
panel("Raised Amarillo stone cap", .810, .03, .25, -.345, 1.185, -.15, stone, .007)
for j in range(3):
    for i in range(3):
        panel("Grid-panel island face", .311, .257, .016,
              -.163 + i * .316, .228 + j * .269, .244, teak)

for i, z in enumerate((4.96, 5.66), 1):
    asset("social", f"F02 Sculpted cognac stool {i}", 4.16, z)
    cushion("Contour saddle", .351, .326, .083, 0, .676, 0, ochre)
    shell = panel("Curved wrap backrest", .055, .25, .30, -.134, .791, 0, ochre, .026)
    shell.rotation_euler.y = .11
    for x in (-.115, .115):
        for z_leg in (-.108, .108):
            rod("Tapered steel leg", (x * 1.35, .012, z_leg * 1.32), (x, .644, z_leg), .011, dark, .018)
    rod("Footrest", (-.138, .26, -.134), (.139, .26, -.134), .012, dark)

asset("social", "F05 Full-height bicycle joinery", .331, 4.225)
rotate(90)
panel("Bicycle cabinet frame", .840, 2.610, .494, 0, 1.305, -.010, teak)
for x in (-.199, .199):
    for low, high in ((.014, .820), (.838, 1.653), (1.671, 2.578)):
        framed_front("Baltimore teak bicycle door", .391, high - low, x, (high + low)/2, .243, teak, end_grain)
    panel("Lower dark ventilation grille", .346, .73, .004, x, .418, .258, dark)
    for i in range(10):
        panel("Vertical bicycle ventilation slat", .014, .726, .008, x - .154 + i * .034, .418, .262, teak)

asset("social", "F04 Slatted floating media credenza", 2.096, 3.952)
panel("2300 mm media cabinet carcass", 2.3, .48, .274, 0, .24, -.013, teak)
for x, w in ((-.785, .722), (0, .832), (.785, .722)):
    framed_front("Teak media front", w, .363, x, .255, .138, teak, end_grain)
    if x:
        for y in (.185, .215):
            panel("Side media vent", .447, .010, .004, x, y, .153, dark, .002)
    else:
        for y in (.183, .261, .338):
            panel("Centre drawer reveal", .811, .006, .007, x, y, .155, end_grain, .001)

asset("social", "F06 Teak backdrop at living-room return", .517, 7.153)
rotate(180)
panel("Full-height teak backdrop backing", .895, 2.610, .021, 0, 1.305, 0, end_grain)
for col in range(3):
    for row in range(9):
        panel("Alternating teak veneer panel", .294, .286, .011,
              (col - 1) * .298, .145 + row*.290, .012, teak, .001)
asset("social", "Two-seat linen sofa outside guestroom", 1.98, 6.97)
rotate(180)
sofa_linen = material("Ivory woven sofa upholstery", (.66, .616, .541), .87)
sofa_thread = material("Sofa linen piping", (.52, .486, .411), .90)
panel("Recessed teak sofa plinth", 1.74, .083, .60, 0, .043, -.006, teak, .016)
panel("Upholstered sofa base", 1.91, .226, .744, 0, .207, 0, sofa_linen, .055)
panel("Soft upholstered sofa back", 1.89, .508, .128, 0, .522, -.297, sofa_linen, .042)
for x in (-.864, .864):
    panel("Rounded low sofa arm", .183, .318, .678, x, .434, -.002, sofa_linen, .067)
for x, angle in ((-.378, -.03), (.378, .026)):
    cushion("Padded sofa seat", .736, .524, .126, x, .348, .059, sofa_linen, .004)
    sewn_pillow("Plump back cushion", .734, .336, .153, x, .582, -.151, angle, .78, sofa_linen, sofa_thread)
sewn_pillow("Olive toss cushion", .336, .239, .125, -.638, .565, -.041, -.21, .78, olive_cloth, olive_thread)

# Interiola P01/P02, sheets 53-58. Face the living room and occupy the traced openings.
def door_frame(w, leaf, reverse):
    side = (w - leaf) / 2
    for x in (-(w-side)/2, (w-side)/2):
        panel("Concealed jamb", side - .003, 2.168, .09, x, 1.084, 0, teak)
        panel("Reverse jamb lining", side - .004, 2.168, .008, x, 1.084, -.05, reverse)
    panel("Concealed transom", w - .004, .483, .087, 0, 2.3695, 0, teak)
    panel("Reverse transom lining", w - .004, .483, .009, 0, 2.3695, -.05, reverse)

asset("doors", "P1 Ribbed concealed WIC door", 4.515, 7.514)
rotate(180)
door_frame(.806, .726, teak)
panel("P1 swing leaf", .720, 2.128, .044, 0, 1.077, .012, teak)
for z_min, top in ((.013, 2.141), (2.168, 2.611)):
    for i in range(19):
        x = -.36 + i * .04
        if abs(x) > .352 and top < 2.5:
            continue
        panel("Baltimore teak vertical batten", .020, top - z_min, .020, x,
              (z_min + top) / 2, .052, teak, .002)

asset("doors", "P2 Concealed display-shelf door", 3.4355, 7.568)
rotate(180)
door_frame(.935, .854, marshmallow)
panel("P2 reinforced leaf", .848, 2.128, .045, 0, 1.077, -.009, teak)
panel("Marshmallow White reverse", .843, 2.121, .008, 0, 1.077, -.036, marshmallow)
for x in (-.415, .415):
    panel("Teak display return", .019, 2.107, .092, x, 1.075, .038, teak)
for y in (.44, .982, 1.524, 2.109):
    panel("Teak inset display shelf", .814, .019, .104, 0, y, .055, teak)
    if y > 2:
        continue
    for x in (-.344, .344):
        rod("Display rail upright", (x, y+.013, .095), (x, y+.10, .095), .005, brass)
    rod("10 mm gold retaining rod", (-.350, y+.076, .095), (.350, y+.076, .095), .005, brass)

def imported_bedding():
    """Adapt the CC0 Innerscene queen bedding to the Interiola platform and textiles."""
    previous = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "assets/vendor/innerscene-queen.glb"))
    bpy.context.view_layer.update()
    imports = [ob for ob in bpy.data.objects if ob not in previous]
    adapt = Matrix.Translation((0, -.018, .28 - .38 * .85)) @ Matrix.Diagonal((1.175, .952, .85, 1))
    specs = {
        "Nominal dimensioned mattress": ("Ivory cotton fitted mattress", (.84, .82, .77)),
        "Plump pillow with closed seams": ("Cotton percale tailored sham", (.88, .86, .82)),
        "Quilted closed duvet": ("Ivory cotton percale quilted duvet", (.83, .82, .79)),
    }
    finishes = {}
    keep = set()
    for obj in imports:
        kind = next((key for key in specs if obj.name.startswith(key)), None)
        if obj.type != 'MESH' or kind is None:
            continue
        keep.add(obj)
        obj_transform = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_basis = adapt @ obj_transform
        if kind not in finishes:
            name, rgb = specs[kind]
            mat = obj.data.materials[0].copy()
            mat.name = name
            shader = mat.node_tree.nodes.get("Principled BSDF")
            node = next((link.from_node for link in shader.inputs["Base Color"].links
                         if link.from_node.type == 'TEX_IMAGE'), None)
            if node is not None:
                old_image = node.image
                pixel_count = old_image.size[0] * old_image.size[1] * 4
                pixels = array('f', [0.0]) * pixel_count
                old_image.pixels.foreach_get(pixels)
                lum = lambda i: .2126 * pixels[i] + .7152 * pixels[i+1] + .0722 * pixels[i+2]
                mean = sum(lum(i) for i in range(0, pixel_count, 4)) / (pixel_count / 4)
                for i in range(0, pixel_count, 4):
                    shade = max(.78, min(1.08, 1 + (lum(i) / max(mean, .01) - 1) * .38))
                    for channel in range(3):
                        pixels[i+channel] = rgb[channel] * shade
                new_image = bpy.data.images.new(name, old_image.size[0], old_image.size[1], alpha=False)
                new_image.pixels.foreach_set(pixels)
                new_image.pack()
                node.image = new_image
            else:
                shader.inputs["Base Color"].default_value = (*rgb, 1)
            shader.inputs["Roughness"].default_value = .88
            finishes[kind] = mat
        obj.data.materials[0] = finishes[kind]
    for obj in imports:
        if obj not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)
    if len(keep) != 4:
        raise RuntimeError(f"Expected four source bedding meshes, found {len(keep)}")


# Main bedroom. Furniture set-out on sheet 92 and sizes on sheets 98–113.
asset("bedroom", "F15–F16 Main bedroom upholstered platform", 2.18, .951)
main_bed = parent
panel("2080 by 2040 mm teak platform", 2.080, .252, 2.040, 0, .154, 0, teak, .014)
panel("Shadow reveal plinth", 2.045, .064, 2.0, 0, .032, 0, end_grain, .010)
for i in range(4):
    panel("Push-release platform drawer front", .487, .182, .010, -.739 + i * .493, .147, 1.019, teak, .003)
if not requested or "bedroom" in requested:
    imported_bedding()
for x, yaw in ((-.45,-.10), (.45,.06)):
    sewn_pillow("Olive accent cushion", .45, .245, .136, x + .012, .601, -.481, -yaw, .38, olive_cloth, olive_thread)
panel("Baltimore teak headboard backing", 2.625, 1.200, .054, .117, .600, -1.071, teak, .008)
for i in range(4):
    panel("Avena Linen headboard panel", .562, .849, .018, -.867 + .566*i, .456, -1.038, fabric, .005)
for x in (-.586, -.020, .546):
    panel("Headboard gold T-section", .003, .848, .005, x, .456, -1.027, brass, .001)
panel("Headboard teak cap", 2.625, .041, .072, .117, 1.181, -1.062, teak)
panel("Recessed 3500 K headboard lighting", 2.55, .009, .015, .117, .899, -1.038, led)

asset("bedroom", "F17 Accessory cabinet", .382, .4475)
rotate(90)
panel("Full-height accessory cabinet frame", .789, 2.610, .372, 0, 1.305, -.014, teak)
for x in (-.191, .191):
    for y, h in ((.412, .720), (1.692, 1.761)):
        framed_front("Accessory cabinet teak door", .378, h, x, y, .187, teak, end_grain)
    rod("Gold accessory cabinet knob", (x*.2, .738, .202), (x*.2, .738, .218), .010, brass)

asset("bedroom", "F18–F19 Side vanity and sliding mirror", .382, 1.429)
rotate(90)
for x in (-.561, .561):
    panel("Vanity side support", .043, .780, .382, x, .390, -.003, teak)
    panel("Vanity brass toe strip", .039, .013, .358, x, .011, .012, brass, .002)
for x in (-.291, .291):
    panel("Teak vanity drawer", .573, .185, .356, x, .684, .002, teak)
    rod("Gold vanity pull", (x-.032, .738, .183), (x+.032, .738, .183), .009, brass)
panel("1165 mm Avena Linen vanity surface", 1.165, .022, .400, 0, .789, 0, fabric, .006)
panel("Slim sliding mirror frame", .700, 1.618, .030, -.19, 1.614, -.270, dark, .006)
panel("Sliding mirror inset", .674, 1.589, .006, -.19, 1.614, -.253, mirror, .004)
panel("Sliding mirror rail", 1.165, .020, .027, 0, 2.435, -.270, dark, .003)

asset("bedroom", "F20 Illuminated bag cabinet", .680, 3.425)
rotate(180)
panel("1000 mm bag cabinet back", 1.000, 2.610, .024, 0, 1.305, -.178, teak)
for x in (-.489, .489):
    panel("Bag cabinet teak side", .022, 2.610, .38, x, 1.305, 0, teak)
panel("Bag cabinet teak lower doors", .950, .48, .035, 0, .292, .173, teak)
panel("Terracotta display niche", .952, .227, .015, 0, .65, -.139, rust)
for y in (.525, .772, 1.195, 1.632, 2.07, 2.568):
    panel("Lit bag shelf", .953, .028, .368, 0, y, -.003, teak)
    if y > 1:
        panel("3500 K bag shelf LED", .944, .007, .012, 0, y - .019, .093, led, .001)
for x in (-.242, .242):
    panel("Tempered bag cupboard glazing", .460, 1.747, .008, x, 1.672, .186, glass, .001)
    for dx in (-.232, .232):
        panel("Gold cabinet door stile", .012, 1.762, .015, x+dx, 1.671, .192, brass, .002)
    for y in (.793, 2.548):
        panel("Gold cabinet door rail", .474, .012, .015, x, y, .192, brass, .002)

asset("bedroom", "F21 Display and low media cabinetry", 2.083, 3.404)
rotate(180)
cabinet(1.800, .769, .422, 4, base=.050)
panel("1800 mm Avena Linen display cabinet top", 1.8, .03, .45, 0, .785, 0, fabric, .009)
for x in (-.882, .882):
    panel("Full-height display framing", .035, 1.781, .25, x, 1.6905, -.094, teak)
for y in (1.829, 2.196, 2.563):
    panel("Upper cabinet shelf", 1.730, .043, .250, 0, y, -.094, teak)
    panel("Concealed warm upper shelf strip", 1.714, .007, .009, 0, y - .026, .004, led, .001)
    panel("Gold upper cabinet shelf edge", 1.730, .006, .007, 0, y, .033, brass, .001)
panel("Display cabinet teak back", 1.73, .751, .016, 0, 2.201, -.212, teak)
for x in (-.438, .438):
    panel("Teak display divider", .020, .701, .233, x, 2.197, -.094, teak)

# Working room, sheets 60–78. The wall opposite the bed stays plain.
moccasin = material("TACO TH 009 D | Moccasin Ivory matte", (.835, .791, .719), .56)
asset("work", "F09 Storage daybed", 2.916, 9.873)
rotate(-90)
panel("2040 by 1240 mm teak daybed platform", 1.240, .300, 2.040, 0, .150, 0, teak, .012)
for x in (-.411, 0, .411):
    panel("Teak storage drawer", .018, .232, .647, -.622, .151, x * 1.60, teak, .004)
panel("Daybed mattress with fitted sheet", 1.19, .163, 1.959, 0, .378, -.006, cotton, .031)
drape("White tailored daybed coverlet", 1.235, -.393, .986, 1.184, .956, .470, .123)
for x, angle in ((-.295, -.10), (.284, .07)):
    sewn_pillow("Daybed white sham", .56, .381, .155, x, .559, -.735, angle, .56, cotton, cotton_thread)
sewn_pillow("Daybed olive sham", .393, .284, .129, -.25, .562, -.519, -.16, .47, olive_cloth, olive_thread)
sewn_pillow("Daybed olive cushion", .42, .273, .12, .174, .563, -.501, .12, .34, olive_cloth, olive_thread)
asset("work", "F08 Full-height daybed backdrop", 2.916, 9.873)
rotate(-90)
for i in range(3):
    panel("Full-height teak headboard backdrop", .563, 2.609, .022, -.835 + i*.565, 1.3045, -1.033, teak, .004)
    for y in (.693, 1.958):
        panel("Recessed square frame joint", .558, .009, .004, -.835 + i*.565, y, -1.021, end_grain, .001)

# F10 is the fitted end of the desk corner, on the angled return.
asset("work", "F10 Fitted corner cabinet beside desk", .983, 9.778)
corner_shape = [(0, 0), (.895, 0), (.895, .850), (.012, .012)]
for base, height in ((.006, .103), (.721, .031), (1.357, .032), (1.558, .029), (2.570, .039)):
    joinery_prism("Angled fitted cabinet shelf", corner_shape, base, height, olive)
joinery_prism("Teak cabinet angled back", [(0, 0), (.895, .826), (.895, .850), (.012, .012)],
              .109, 2.462, teak)
panel("Deep teak bedside cabinet cheek", .019, 2.499, .833, .885, 1.354, .419, teak)
panel("Desk-side cabinet edge", .051, 2.500, .027, .822, 1.352, .010, teak)
for x in (.203, .609):
    for y, h in ((.372, .456), (2.099, .925)):
        panel("Flush Moccasin Ivory cabinet door", .397, h, .020, x, y, -.008, moccasin, .003)
    rod("Small brass cabinet knob", (.406 + (-.029 if x < .4 else .029), 1.690, -.014),
        (.406 + (-.029 if x < .4 else .029), 1.690, -.035), .009, brass)
panel("Ivory cabinet flap below Thyme Rhythm shelf", .794, .164, .021, .407, .623, -.008, moccasin, .003)
for y in (1.345, 1.541):
    panel("Recessed 3500 K cabinet lighting", .779, .008, .013, .407, y, .043, led, .001)

asset("work", "F11 Wall-mounted work desk", 1.180, 9.258)
rotate(90)
panel("980 by 400 mm Thyme Rhythm desktop", .980, .040, .400, 0, .783, 0, olive, .006)
for x in (-.245, .245):
    panel("Moccasin Ivory desk drawer", .485, .158, .385, x, .684, -.002, moccasin, .004)
panel("Recessed desk cable upstand", .65, .10, .013, -.115, .851, -.191, teak)

asset("work", "F12 Scarlet Kitkat mosaic reveal", .967, 9.591)
rotate(90)
panel("Full-height mosaic backing", .330, 2.610, .013, 0, 1.305, 0, grout, .001)
for col in range(8):
    for row in range(16):
        panel("Scarlet Kitkat mosaic tile", .039, .158, .004,
              -.144 + .041*col, .0815 + .163*row, .008, rust, 0)

# P3 sits on the continuous teak box beside the long edge of the mattress.
asset("work", "P03 Fitted teak box and ivory sliding panels", 1.896, 10.517)
box_outline = [(0, 0), (2.027, 0), (1.657, .401), (.289, .401)]
joinery_prism("Teak box fitted to the angled alcove", box_outline, .003, .712, teak)
joinery_prism("Continuous teak sill cap", box_outline, .715, .028, teak)
panel("Concealed sliding panel backing", 1.842, 1.864, .025, .988, 1.675, .158, moccasin, .001)
panel("Slim ivory top track", 1.862, .049, .106, .988, 2.585, .106, moccasin, .002)
for x in (.073, 1.902):
    panel("Ivory sliding panel jamb", .027, 1.816, .102, x, 1.651, .106, moccasin, .002)
start = .088
for index, width in enumerate((.449, .452, .451, .453)):
    x = start + width / 2
    panel("Flush sliding leaf in Moccasin Ivory", width - .003, 1.808, .026,
          x, 1.651, .064 + .009 * (index % 2), moccasin, .001)
    if index:
        panel("Recessed vertical sliding pull", .009, .50, .003, start + .008, 1.299, .049, brass, .001)
    start += width

# Bathroom set-out from sheet 80. The F14 vertical rack is on the F13 vanity's left.
asset("bath", "F13–F14 Wall vanity and shelf", 4.170, .318)
panel("758 mm floating vanity carcass", .738, .598, .469, 0, .399, -.012, teak)
panel("758 by 500 mm Amarillo vanity top", .758, .102, .500, 0, .75, 0, stone, .006)
panel("Amarillo upstand", .758, .15, .019, 0, .875, -.239, stone, .004)
panel("Teak vanity door", .411, .582, .026, .164, .399, .226, teak)
rod("Half-moon brass vanity pull", (.134, .668, .245), (.194, .668, .245), .012, brass)
for y in (.115, .397, .671):
    panel("Inset vanity towel shelf", .222, .024, .065, -.192, y, .225, teak)
rings("Shaped ceramic vanity basin", (.095, .803, .018), [
    (0, .16, .104), (.038, .218, .14), (.054, .217, .139), (.054, .187, .117), (.015, .144, .095),
], ceramic)
rod("Basin tap", (.095, .801, -.168), (.095, .982, -.168), .013, brass)
rod("Basin spout", (.095, .979, -.168), (.095, .961, -.080), .011, brass)
panel("49 cm F14 wall shelf back", .022, 1.63, .490, -.363, 1.622, -.002, teak)
for z in (-.237, .235):
    panel("F14 slim teak shelf frame", .115, 1.63, .019, -.316, 1.622, z, teak)
for i in range(5):
    y = .817 + i*.402
    panel("F14 recessed shelf", .115, .020, .450, -.316, y, -.002, teak)
    if i:
        rod("F14 slim brass retainer", (-.264, y-.338, -.225), (-.264, y-.338, .223), .005, brass)

asset("bath", "Tiled shower and glass screen", 5.183, .815)
panel("Stone shower tray", .917, .048, .838, 0, .024, 0, stone, .009)
panel("Shower mosaic back", .923, 2.355, .025, 0, 1.18, -.425, grout)
for x in range(15):
    for y in range(12):
        panel("Vertical glazed shower mosaic", .057, .191, .009,
              -.429 + .061*x, .099 + .196*y, -.409, green_tile, 0)
panel("Clear front shower screen", .386, 2.18, .011, -.272, 1.101, .420, glass, .003)
rod("Shower brass profile", (-.079, .014, .421), (-.079, 2.185, .421), .009, brass)
rod("Shower riser", (.217, .824, -.381), (.217, 2.002, -.381), .012, brass)
rod("Shower arm", (.217, 2.002, -.381), (.217, 2.002, -.201), .012, brass)
rings("Rain head", (.217, 1.984, -.198), [(0, .096, .096), (.018, .089, .089)], brass)
# Sheet 80 locates the 150 mm ledge behind the WC. Heights and heater finish
# are modelled from Preview 8, as the appliance itself is an existing fixture.
asset("bath", "Toilet alcove and existing water heater", 5.727, 1.718)
alcove_grout = material("Muted grout behind WC tile", (.112, .123, .090))
heater_enamel = material("Warm white heater enamel", (.83, .84, .805), .38)
heater_control = material("Smoked heater controls", (.049, .037, .025), .33)
cold = material("Cold blue water port", (.018, .072, .23))
hot = material("Hot red water port", (.35, .024, .027))
panel("150 mm concealed cistern wall", .151, .955, .779, .316, .4775, -.009, alcove_grout, .002)
panel("Dark olive tile cap behind toilet", .152, .018, .779, .316, .964, -.009, green_tile, .002)
for col in range(29):
    for row in range(8):
        panel("Vertical olive mosaic behind WC", .008, .117, .024, .239,
              .059 + row * .119, -.386 + col * .027, green_tile, 0)
panel("Concealed WC flush plate", .009, .09, .151, .230, .787, 0, mirror, .004)
for z in (-.034, .028):
    panel("Flush plate inset", .007, .055, .043, .224, .787, z, dark, .004)

panel("Rounded existing water heater", .282, .382, .523, .244, 2.145, -.007, heater_enamel, .084)
panel("Wall-mounted heater cradle", .034, .255, .377, .373, 2.146, -.007, heater_enamel, .012)
panel("Smoked heater control fascia", .014, .112, .190, .103, 2.151, -.007, heater_control, .007)
rod("Heat setting dial", (.089, 2.148, -.022), (.099, 2.148, -.022), .024, mirror)
for z, port in ((-.127, hot), (.121, cold)):
    rod("Water heater brass union", (.243, 1.963, z), (.243, 1.929, z), .017, brass)
    rod("Water heater valve cap", (.222, 1.941, z), (.195, 1.941, z), .017, port)
    seam_line("Existing water supply connection", [
        (.243, 1.932, z), (.243, 1.824, z), (.253, 1.789, z),
        (.280, 1.765, z), (.315, 1.754, z), (.374, 1.754, z),
    ], heater_enamel, .010)
    rod("Water connection wall collar", (.373, 1.754, z), (.392, 1.754, z), .025, heater_enamel)

plant = material("Olive foliage at WC ledge", (.061, .102, .021), .84)
amber = material("Amber glass wash bottle", (.121, .058, .019), .31)
rings("Pale ceramic planter", (.316, .973, -.236),
      [(0, .048, .048), (.10, .063, .063), (.103, .058, .058), (.092, .052, .052)], ceramic)
for i in range(11):
    angle = i * 2.4
    spread = .034 + .019 * (i % 3)
    rod("Slender green planter leaf", (.316, 1.071, -.236),
        (.316 + math.cos(angle)*spread, 1.217 + .029*(i % 3), -.236 + math.sin(angle)*spread),
        .007, plant, .001)
for z, size in ((.123, 1), (.235, .80)):
    rings("Amber pump bottle", (.316, .974, z),
          [(0, .032*size, .032*size), (.092*size, .033*size, .033*size),
           (.110*size, .016*size, .016*size), (.122*size, .016*size, .016*size)], amber)
    rod("Black bottle pump", (.315, .974 + .12*size, z), (.315, .986 + .135*size, z), .011, dark)
    panel("Cream wash bottle label", .002, .037*size, .033*size, .282, 1.032, z, heater_enamel, .001)
rings("Sculpted pedestal and bowl", (-.075, .028, 0), [
    (0, .167, .105), (.09, .186, .112), (.19, .191, .124), (.27, .255, .178),
    (.335, .272, .184), (.367, .266, .181), (.367, .177, .133), (.238, .123, .081),
], ceramic)
rings("Rounded seat ring", (-.080, .396, 0), [(0, .257, .180), (.027, .251, .175), (.027, .183, .138), (0, .183, .135)], white)
panel("WC connection to concealed cistern", .133, .285, .345, .179, .220, 0, ceramic, .035)
panel("Closed WC lid", .558, .033, .349, -.045, .427, 0, heater_enamel, .093)

# Bake modifiers and batch same-material meshes per assembly so WebGL can render efficiently.
bpy.context.view_layer.update()
for room, assemblies in room_nodes.items():
    if requested and room not in requested:
        continue
    bpy.ops.object.select_all(action="DESELECT")
    for assembly in assemblies:
        by_material = {}
        for obj in list(assembly.children):
            if obj.modifiers:
                bpy.context.view_layer.objects.active = obj
                obj.select_set(True)
                for modifier in list(obj.modifiers):
                    bpy.ops.object.modifier_apply(modifier=modifier.name)
                obj.select_set(False)
            by_material.setdefault(obj.data.materials[0].name, []).append(obj)
        for same_material in by_material.values():
            if len(same_material) < 2:
                continue
            bpy.ops.object.select_all(action="DESELECT")
            for obj in same_material:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = same_material[0]
            bpy.ops.object.join()
    bpy.ops.object.select_all(action="DESELECT")
    for assembly in assemblies:
        assembly.select_set(True)
        for obj in assembly.children:
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / f"{room}.glb"), export_format="GLB",
                             use_selection=True, export_animations=False, export_cameras=False,
                             export_lights=False, export_yup=True)
    if room == "bedroom":
        bpy.ops.object.select_all(action="DESELECT")
        original = main_bed.location.copy()
        main_bed.location = (0, 0, 0)
        bpy.context.view_layer.update()
        main_bed.select_set(True)
        for obj in main_bed.children:
            obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(OUT / "main-bed.glb"), export_format="GLB",
                                 use_selection=True, export_animations=False, export_cameras=False,
                                 export_lights=False, export_yup=True)
        main_bed.location = original
print("Furniture GLBs exported.")

