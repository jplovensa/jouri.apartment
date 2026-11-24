"""Build the original fitted furniture meshes modelled from Interiola's drawing set."""
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/models"
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, rgb, rough=.55, metal=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Metallic"].default_value = metal
    return mat


teak = material("TACO TH 356 | Baltimore teak", (.26, .108, .049), .48)
end_grain = material("Teak edge band", (.19, .081, .036), .48)
olive = material("TACO TH 076 | Thyme Rhythm", (.144, .158, .076))
rust = material("TACO TH 059 | South Terracotta", (.37, .109, .057))
stone = material("Sandimas Amarillo | Honed granite", (.60, .526, .405), .42)
white = material("Ivory linen", (.83, .76, .65), .85)
fabric = material("TACO TH 1239 | Avena Linen", (.65, .55, .43), .82)
ochre = material("Cognac upholstery", (.45, .192, .059), .66)
ceramic = material("Glazed ivory ceramic", (.87, .86, .80), .19)
dark = material("Dark powder coated metal", (.032, .028, .024), .43, .4)
brass = material("Satin brass", (.58, .38, .15), .30, .76)
mirror = material("Mirror and brushed steel", (.52, .57, .56), .21, .83)
green_tile = material("Olive glazed mosaic", (.158, .205, .131), .27)
grout = material("Warm grey grout", (.32, .32, .25))
led = material("Warm integrated lighting", (.91, .55, .24), .32)
shader = led.node_tree.nodes.get("Principled BSDF")
shader.inputs["Emission Color"].default_value = (1, .50, .16, 1)
shader.inputs["Emission Strength"].default_value = 1.4
glass = material("Clear shower glass", (.72, .86, .83), .11)
glass.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = .29
glass.surface_render_method = "DITHERED"

# Packed, deterministic teak grain for the visible panel faces.
rand = random.Random(356)
width, height = 128, 256
image = bpy.data.images.new("Baltimore teak visual grain", width, height, alpha=False)
image.colorspace_settings.name = 'sRGB'
pixels = []
for y in range(height):
    for x in range(width):
        phase = x * .45 + .36 * math.sin(y * .027 + x * .05)
        value = .82 + .08 * math.sin(phase) + .04 * math.sin(phase * 3.13) + rand.random() * .025
        pixels.extend((value * .60, value * .39, value * .29, 1))
image.pixels.foreach_set(pixels)
image.pack()
wood_nodes = teak.node_tree.nodes
texture = wood_nodes.new("ShaderNodeTexImage")
texture.image = image
teak.node_tree.links.new(texture.outputs["Color"], wood_nodes.get("Principled BSDF").inputs["Base Color"])

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

asset("social", "F01 Granite waterfall island", 4.92, 5)
rotate(-90)
cabinet(1.29, .737, .46, 3, base=.068)
panel("Granite eased countertop", 1.43, .058, .59, 0, .766, .03, stone, .016)
for x in (-.675, .675):
    panel("Waterfall end", .038, .735, .52, x, .368, .01, stone, .008)

for i, z in enumerate((4.65, 5.24), 1):
    asset("social", f"F02 Sculpted cognac stool {i}", 4.23, z)
    cushion("Contour saddle", .351, .326, .083, 0, .550, 0, ochre)
    shell = panel("Curved wrap backrest", .055, .25, .30, -.134, .665, 0, ochre, .026)
    shell.rotation_euler.y = .11
    for x in (-.115, .115):
        for z_leg in (-.108, .108):
            rod("Tapered steel leg", (x * 1.35, .012, z_leg * 1.32), (x, .52, z_leg), .011, dark, .018)
    rod("Footrest", (-.138, .20, -.134), (.139, .20, -.134), .012, dark)

asset("social", "F05 Full-height bicycle joinery", .37, 4.39)
rotate(90)
cabinet(.86, 2.01, .46, 2)
asset("social", "F04 Slatted floating media credenza", 1.88, 4.06)
cabinet(2.29, .34, .302, 3, base=.046)
for i in range(6):
    panel("Horizontal media ventilation slat", .64, .013, .018, 0, .14 + .021 * i, .165, end_grain, .002)
asset("social", "F06 Teak dining niche", 5.57, 6.20)
rotate(-90)
panel("Reeded timber backing", .88, 1.48, .033, 0, .74, -.048, teak)
for x in (-.4, .4):
    panel("Niche side return", .051, 1.48, .113, x, .74, .018, end_grain)
for y in (.29, .66, 1.05):
    panel("Display niche shelf", .76, .027, .13, 0, y, .023, teak)
asset("social", "F07 Low window seat with storage", 2.54, 7.23)
rotate(180)
cabinet(2.9, .375, .362, 4, base=.055)
cushion("Avena seat pad", 2.18, .335, .055, .11, .404, 0, fabric)

# Main bedroom, headboard, upholstered bed and six custom joinery components.
asset("bedroom", "F15–F16 Main bedroom upholstered platform", 2.22, 1.18)
panel("Chamfered platform", 1.83, .208, 2.015, 0, .147, .01, teak, .026)
panel("Shadow reveal plinth", 1.73, .08, 1.91, 0, .04, .012, end_grain, .012)
cushion("Rounded mattress", 1.75, 1.93, .186, 0, .343, .022, white)
cushion("Draped duvet", 1.74, 1.36, .087, 0, .455, .30, white, .005)
panel("Folded Avena bed runner", 1.749, .037, .405, 0, .503, .690, fabric, .017)
for x in (-.44, .44):
    cushion("Tailored pillow", .64, .32, .115, x, .448, -.70, white, .003)
    cushion("Green lumbar cushion", .48, .21, .121, x, .491, -.48, olive, .004)
panel("Terracotta headboard backing", 2.16, .557, .067, .165, .326, -1.081, rust, .01)
for i in range(7):
    panel("Upholstered headboard panel", .299, .376, .036, -.755 + .307 * i, .34, -1.038, fabric, .018)
panel("Headboard cap", 2.16, .036, .092, .165, .616, -1.071, teak)
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
cushion("Daybed mattress", 1.09, 1.78, .151, 0, .382, 0, white)
cushion("Wrapped coverlet", 1.079, 1.09, .06, 0, .474, .31, fabric)
cushion("Olive pillow", .66, .35, .112, 0, .477, -.608, olive)
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
print("Exported furniture GLBs:", ", ".join(room_nodes))
