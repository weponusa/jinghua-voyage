"""Heichi two-storey library tower with balcony, visible books and a steep tiled roof."""
import bpy

from common import box, curve, cylinder, material
from landmarks_common import bookshelf, geometric_plaque, hip_roof, lattice_panel, scroll, stone_steps


def build_library_tower():
    wood = material("Library Tower | blackened elm", "382C27", 0.56)
    edge = material("Library Tower | rubbed dark wood edges", "6D5038", 0.57)
    recess = material("Library Tower | deep interior shadow", "211F1D", 0.84)
    plaster = material("Library Tower | smoke grey infill", "7D8073", 0.91)
    stone = material("Library Tower | dark stone footing", "656B64", 0.91)
    tile = material("Library Tower | steep charcoal tiles", "293A3B", 0.65)
    tile_edge = material("Library Tower | weathered green tile edges", "4E6460", 0.68)
    paper = material("Library Tower | old scroll paper", "C9B991", 0.91)
    cloth = material("Library Tower | dark teal book cloth", "395D5B", 0.78)
    bronze = material("Library Tower | aged bronze fittings", "9A8351", 0.44, 0.46)

    box("Library | stone foundation", (0, 0, 0.18), (6.20, 4.35, 0.36), stone, 0.035)
    box("Library | lower timber floor", (0, 0, 0.40), (5.95, 4.10, 0.09), edge, 0.012)
    stone_steps("Library | entry steps", 2.65, -2.10, 0.36, stone, 3)
    box("Library | lower rear wall", (0, 1.86, 1.83), (5.70, 0.20, 2.82), plaster, 0.018)
    box("Library | upper rear wall", (0, 1.86, 4.36), (5.70, 0.20, 2.22), plaster, 0.018)
    for sx in (-1, 1):
        box("Library | lower side wall", (sx * 2.82, 0, 1.83), (0.20, 3.82, 2.82), plaster, 0.018)
        box("Library | upper side wall", (sx * 2.82, 0, 4.36), (0.20, 3.82, 2.22), plaster, 0.018)
        lattice_panel("Library | lower side window", (sx * 2.94, 0.12, 1.93), 2.10, 1.35, edge, recess, "side" if sx < 0 else "side_reverse", True)
        lattice_panel("Library | upper side window", (sx * 2.94, 0.12, 4.45), 2.10, 1.22, edge, recess, "side" if sx < 0 else "side_reverse", True)
        # Enclosed side bays flank an open central doorway on the ground floor.
        box("Library | lower front side bay", (sx * 1.95, -1.87, 1.83), (1.70, 0.18, 2.82), plaster, 0.018)
        lattice_panel("Library | lower front window", (sx * 1.95, -1.99, 1.91), 1.36, 1.55, edge, recess, "front", True)
        # Upper side bays have lattice; the middle stays open to reveal book stacks.
        box("Library | upper front side bay", (sx * 1.95, -1.87, 4.35), (1.70, 0.18, 2.22), wood, 0.018)
        lattice_panel("Library | upper front window", (sx * 1.95, -1.99, 4.42), 1.38, 1.40, edge, recess, "front", True)

    # Structural grid and strongly expressed floor belt.
    for x in (-2.84, -0.94, 0.94, 2.84):
        for y in (-1.92, 1.90):
            box("Library | full height elm post", (x, y, 2.96), (0.17, 0.18, 5.16), wood, 0.018)
            box("Library | post foot", (x, y, 0.48), (0.30, 0.31, 0.19), stone, 0.022)
    for z in (3.16, 5.47):
        for y in (-1.94, 1.94):
            box("Library | front and rear tie beam", (0, y, z), (5.95, 0.23, 0.25), wood, 0.022)
        for x in (-2.84, 2.84):
            box("Library | side tie beam", (x, 0, z), (0.23, 4.05, 0.25), wood, 0.022)
    box("Library | second floor slab", (0, 0, 3.10), (5.85, 3.90, 0.18), edge, 0.015)
    box("Library | projecting balcony floor", (0, -2.11, 3.10), (6.10, 0.72, 0.16), wood, 0.022)
    box("Library | balcony gilt edge", (0, -2.49, 3.12), (6.12, 0.055, 0.07), bronze, 0.012)

    # Full upper balcony balustrade, including returns on both sides.
    for x in [-2.88 + i * 0.48 for i in range(13)]:
        box("Library | balcony baluster", (x, -2.43, 3.55), (0.075, 0.075, 0.79), edge, 0.010)
    for z in (3.30, 3.91):
        box("Library | balcony long rail", (0, -2.43, z), (6.06, 0.11, 0.11), edge, 0.016)
    for sx in (-1, 1):
        for y in (-1.90, -1.43, -2.00):
            box("Library | balcony return baluster", (sx * 2.95, y, 3.55), (0.075, 0.075, 0.79), edge, 0.010)
        for z in (3.30, 3.91):
            box("Library | balcony return rail", (sx * 2.95, -2.14, z), (0.11, 0.69, 0.11), edge, 0.016)
    for x in (-2.94, -0.96, 0.96, 2.94):
        box("Library | balcony newel", (x, -2.43, 3.58), (0.15, 0.15, 0.94), wood, 0.018)
        box("Library | newel cap", (x, -2.43, 4.05), (0.23, 0.23, 0.10), bronze, 0.018)

    # Book collections are visible through the open upper centre and lower door.
    bookshelf("Library | lower rear collection", (0, 1.60, 0.46), 3.70, 2.20, edge, recess, paper, cloth)
    bookshelf("Library | upper central collection", (0, 1.52, 3.25), 2.20, 1.93, edge, recess, paper, cloth)
    for sx in (-1, 1):
        # A visible stair flight along the inner side.
        for i in range(12):
            top = 0.46 + (i + 1) * 0.218
            box("Library | interior stair tread", (sx * 2.14, -1.20 + i * 0.22, top - 0.07), (0.72, 0.25, 0.14), edge, 0.012)
    for x in (-0.60, 0, 0.60):
        for j in range(3):
            scroll("Library | upper stacked scroll", (x, -1.62, 3.56 + j * 0.12), 0.45, paper, bronze)
    geometric_plaque("Library | archive seal plaque", (0, -2.05, 5.17), 1.52, recess, bronze, "diamond")
    # Layered brackets below the steep main eaves.
    for x in (-2.84, -0.94, 0.94, 2.84):
        for sx in (-1, 1):
            curve("Library | upper dougong arm", [(x, -1.92, 5.10), (x + sx * 0.20, -1.92, 5.40), (x + sx * 0.44, -1.92, 5.49)], 0.065, edge, smooth=True)

    hip_roof("Library | steep archive roof", 7.0, 5.0, 5.66, 1.02, tile, tile_edge, recess, ridge=1.15, spacing=0.25)
    return [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]
