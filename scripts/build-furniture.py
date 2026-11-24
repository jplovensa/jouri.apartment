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
    obj.scale = (w / 2, d / 2, h / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
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


# Living, kitchen and dining, sheets F01-F07.
asset("social", "F03 Olive and teak kitchen", 5.91, 3.86)
rotate(-90)
cabinet(2.82, .825, .52, 6, olive, base=.083)
panel("Honed counter", 2.87, .041, .57, 0, .847, .01, stone, .012)
panel("Stone backsplash", 2.81, .50, .018, 0, 1.113, -.248, stone)
for i in range(6):
    x = -1.16 + .46 * i
    panel("Teak overhead door", .453, .51, .039, x, 1.65, -.012, teak)
panel("Upper carcass", 2.76, .53, .29, 0, 1.65, -.153, teak)
panel("Under-cabinet warm strip", 2.74, .012, .024, 0, 1.38, -.023, led)
rings("Brushed inset sink", (-1.06, .875, .015), [
    (0, .18, .155), (.014, .21, .172), (.017, .19, .153), (-.012, .142, .115),
], mirror)
rod("Raised faucet stem", (-1.07, .87, -.192), (-1.07, 1.055, -.192), .015, brass)
rod("Bent faucet outlet", (-1.07, 1.055, -.192), (-1.07, 1.038, -.095), .011, brass)
panel("Induction cooktop", .57, .015, .38, .54, .877, .045, dark, .022)
for x in (.39, .69):
    rings("Cooktop burner ring", (x, .887, .045), [(0, .104, .104), (.003, .102, .102), (.003, .096, .096), (0, .095, .095)], mirror)

asset("social", "Kitchen appliance tower", 5.81, 5.55)
cabinet(.37, 1.93, .24, 1, open_shelves=True)
panel("Recessed graphite appliance", .285, 1.37, .034, 0, .775, -.128, dark)
rod("Appliance handle", (-.079, 1.056, -.156), (.069, 1.056, -.156), .011, mirror)

# F01 shop sheet 21: 1,500 x 550 mm, counter at 950 mm, 810 mm raised pass.
asset("social", "F01 Two-tier tiled island", 4.92, 5)
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

for i, z in enumerate((4.65, 5.24), 1):
    asset("social", f"F02 Sculpted cognac stool {i}", 4.23, z)
    cushion("Contour saddle", .351, .326, .083, 0, .676, 0, ochre)
    shell = panel("Curved wrap backrest", .055, .25, .30, -.134, .791, 0, ochre, .026)
    shell.rotation_euler.y = .11
    for x in (-.115, .115):
        for z_leg in (-.108, .108):
            rod("Tapered steel leg", (x * 1.35, .012, z_leg * 1.32), (x, .644, z_leg), .011, dark, .018)
    rod("Footrest", (-.138, .26, -.134), (.139, .26, -.134), .012, dark)

asset("social", "F05 Full-height bicycle joinery", .37, 4.19)
rotate(90)
cabinet(.86, 2.01, .46, 2)
asset("social", "F04 Slatted floating media credenza", 1.88, 4.06)
cabinet(2.29, .34, .302, 3, base=.046)
for i in range(6):
    panel("Horizontal media ventilation slat", .64, .013, .018, 0, .14 + .021 * i, .165, end_grain, .002)
asset("social", "F06 Teak panel beside living window", .190, 6.91)
rotate(90)
parent.scale.x = .72
panel("Reeded timber backing", .88, 1.48, .033, 0, .74, -.048, teak)
for x in (-.4, .4):
    panel("Niche side return", .051, 1.48, .113, x, .74, .018, end_grain)
for y in (.29, .66, 1.05):
    panel("Display niche shelf", .76, .027, .13, 0, y, .023, teak)
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
    adapt = Matrix.Translation((0, -.018, .258 - .38 * .85)) @ Matrix.Diagonal((1.08, .952, .85, 1))
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


# Main bedroom, headboard, upholstered bed and six custom joinery components.
asset("bedroom", "F15–F16 Main bedroom upholstered platform", 2.22, 1.18)
main_bed = parent
panel("Chamfered platform", 1.83, .208, 2.015, 0, .147, .01, teak, .026)
panel("Shadow reveal plinth", 1.73, .08, 1.91, 0, .04, .012, end_grain, .012)
if not requested or "bedroom" in requested:
    imported_bedding()
for x, yaw in ((-.42,-.10), (.42,.06)):
    sewn_pillow("Olive accent cushion", .45, .245, .136, x + .012, .579, -.481, -yaw, .38, olive_cloth, olive_thread)
panel("Terracotta headboard backing", 2.16, .557, .067, .165, .326, -1.081, rust, .01)
for i in range(7):
    panel("Upholstered headboard panel", .299, .376, .036, -.755 + .307 * i, .34, -1.038, fabric, .018)
panel("Headboard cap", 2.16, .036, .092, .165, .616, -1.071, teak)
panel("Recessed terracotta accent", 2.05, .110, .016, .165, .543, -1.017, rust)
panel("Recessed warm lighting", 2.09, .009, .015, .165, .591, -1.025, led)
asset("bedroom", "F17 Accessory cabinet", .65, .48)
rotate(90)
cabinet(.555, 1.62, .403, 1)
asset("bedroom", "F18–F19 Side vanity and sliding mirror", .65, 1.35)
rotate(90)
cabinet(.875, .66, .412, 2, base=.076)
panel("Vanity surface", .913, .039, .446, 0, .68, .005, stone, .009)
panel("Slim mirror frame", .67, .591, .036, 0, 1.031, -.182, brass, .009)
panel("Sliding mirror inset", .636, .557, .013, 0, 1.031, -.16, mirror, .005)
asset("bedroom", "F20 Illuminated bag shelves", .59, 3.37)
rotate(180)
cabinet(.515, 1.80, .374, 6, open_shelves=True)
asset("bedroom", "F21 Display and low media cabinetry", 2.1, 3.36)
rotate(180)
cabinet(2.29, .414, .385, 5)
for y in (1.52, 1.78, 2.04):
    panel("Illuminated full-width upper display ledge", 2.22, .025, .288, 0, y, -.02, teak)
    panel("Concealed warm strip beneath display ledge", 2.15, .009, .009, 0, y-.017, .094, led)
panel("Granite cabinet top", 2.31, .029, .411, 0, .425, 0, stone)
for x in (-1.128, -.706):
    panel("Tall display tower side", .018, 1.11, .344, x, .978, 0, teak)
for i in range(4):
    y = .57 + .272 * i
    panel("Open display shelf", .403, .019, .343, -.917, y, 0, teak)
    panel("Warm shelf lighting", .393, .009, .008, -.917, y - .013, .149, led)
panel("Teak display back", .426, 1.11, .016, -.917, .978, -.165, end_grain)

# Working room, F08-F12.
asset("work", "F08–F09 Storage daybed", 2.82, 9.87)
rotate(-90)
cabinet(1.12, .307, 1.84, 2, base=.063)
panel("Daybed mattress with fitted sheet", 1.08, .147, 1.78, 0, .381, 0, cotton, .033)
drape("White tailored daybed coverlet", 1.174, -.375, .921, 1.08, .882, .459, .104)
sewn_pillow("Daybed white sham", .68, .345, .119, -.12, .51, -.66, -.11, .22, cotton, cotton_thread)
sewn_pillow("Daybed olive cushion", .42, .273, .12, .174, .558, -.493, .12, .34, olive_cloth, olive_thread)
panel("Headboard panel", 1.22, .76, .049, 0, .38, -.968, teak, .011)
asset("work", "F10 Olive working-room storage", 1.20, 8.88)
rotate(90)
cabinet(.567, 1.81, .36, 2, olive)
asset("work", "F11 Slim desk and task ledge", 1.40, 9.55)
rotate(90)
panel("Eased desk surface", .558, .046, .406, 0, .741, 0, teak, .014)
panel("Shallow stationery drawer", .483, .062, .350, 0, .679, -.008, end_grain)
for x in (-.233, .233):
    rod("Slim desk support", (x, .028, .145), (x, .712, .12), .012, dark)
asset("work", "F12 Scarlet Kitkat mosaic backdrop", 3.02, 10.77)
panel("Tile backing", .85, 1.04, .023, 0, .52, .003, grout)
for x in range(14):
    for y in range(4):
        panel("Glazed vertical Kitkat mosaic", .055, .239, .010,
              -.39 + .06*x, .132 + .254*y, -.015, rust, .003)

# Bathroom. Sculpted vitreous fixtures and tiled shower recess.
asset("bath", "F13–F14 Wall vanity and mirror", 4.18, .46)
panel("Floating vanity carcass", .647, .325, .402, 0, .553, 0, teak)
panel("Undermount vanity top", .657, .043, .431, 0, .735, 0, stone, .01)
for x in (-.159, .159):
    panel("Vanity doors", .304, .279, .015, x, .56, .203, teak)
    rod("Half-moon brass pull", (x - .025, .638, .221), (x + .025, .638, .221), .012, brass)
rings("Shaped ceramic basin", (0, .757, .02), [
    (0, .16, .108), (.038, .222, .145), (.060, .221, .145),
    (.060, .193, .125), (.018, .151, .103),
], ceramic)
rod("Basin tap", (.006, .76, -.147), (.006, .917, -.147), .013, brass)
rod("Basin spout", (.006, .915, -.145), (.006, .896, -.077), .011, brass)
panel("Mirror with metal surround", .385, .489, .022, .07, 1.116, -.178, brass, .009)
panel("Mirror face", .366, .47, .014, .07, 1.116, -.162, mirror, .008)
for y in (.943, 1.134):
    panel("Side display ledge", .111, .021, .182, -.250, y, -.058, teak)
asset("bath", "Tiled shower and glass screen", 5.25, .73)
panel("Stone shower tray", .766, .062, .68, 0, .031, 0, stone, .01)
panel("Tile backing", .748, 1.44, .021, 0, .72, -.326, grout)
for x in range(6):
    for y in range(8):
        panel("Green glazed shower tile", .119, .173, .013,
              -.305 + .122*x, .093 + .178*y, -.311, green_tile, .003)
panel("Bevelled glass screen", .011, 1.32, .587, .378, .704, -.008, glass, .003)
rod("Screen brass profile", (.386, .052, .279), (.386, 1.378, .279), .009, brass)
rod("Shower riser", (.207, .73, -.285), (.207, 1.344, -.285), .012, brass)
rod("Shower arm", (.207, 1.344, -.285), (.207, 1.344, -.178), .012, brass)
rings("Rain head", (.207, 1.327, -.172), [(0, .072, .072), (.018, .066, .066)], brass)
asset("bath", "Sculpted vitreous WC", 5.71, 1.72)
rings("Sculpted pedestal and bowl", (-.057, .028, 0), [
    (0, .15, .104), (.09, .166, .112), (.19, .17, .124), (.27, .235, .178),
    (.335, .248, .184), (.367, .240, .181), (.367, .177, .133), (.238, .123, .081),
], ceramic)
rings("Rounded seat ring", (-.066, .396, 0), [(0, .236, .180), (.027, .23, .175), (.028, .183, .138), (0, .18, .135)], white)
panel("Soft-close concealed cistern", .126, .465, .367, .177, .246, 0, ceramic, .028)

# Bake modifiers and batch same-material meshes per assembly so WebGL can render efficiently.
bpy.context.view_layer.update()
for room, assemblies in room_nodes.items():
    if requested and room not in requested:
        continue
    for assembly in assemblies:
        by_material = {}
        for obj in list(assembly.children):
            bpy.ops.object.select_all(action="DESELECT")
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            for modifier in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=modifier.name)
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

