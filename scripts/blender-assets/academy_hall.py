"""Baimin Academy: a bright three-bay single-storey hall with an open teaching veranda."""
import bpy

from common import box, curve, cylinder, material, sphere
from landmarks_common import bookshelf, geometric_plaque, hip_roof, lattice_panel, scroll, stone_steps, stool, table


def build_academy_hall():
    wood = material("Academy | natural cedar columns", "80684B", 0.67)
    wood_light = material("Academy | worn pale desk wood", "B49A70", 0.72)
    dark = material("Academy | quiet recessed wood", "3F4037", 0.82)
    white = material("Academy | chalk white lime plaster", "E1DFCF", 0.93)
    stone = material("Academy | light grey stone", "AAAFA4", 0.88)
    tile = material("Academy | matte deep grey tile", "46504F", 0.79)
    tile_edge = material("Academy | soft grey tile edges", "707A74", 0.80)
    paper = material("Academy | ivory book paper", "DED2AE", 0.90)
    book_blue = material("Academy | faded blue book cloth", "657D7D", 0.82)
    ink = material("Academy | inkstone and brush", "242D2B", 0.60)

    box("Academy | long low stone terrace", (0, -0.12, 0.14), (9.25, 5.10, 0.28), stone, 0.035)
    box("Academy | continuous timber floor", (0, -0.05, 0.315), (8.90, 4.82, 0.07), wood_light, 0.012)
    for x in range(-4, 5):
        box("Academy | floorboard seam", (x, -0.05, 0.356), (0.014, 4.70, 0.008), wood, 0)
    stone_steps("Academy | broad teaching steps", 4.80, -2.42, 0.28, stone, 2)

    box("Academy | white rear wall", (0, 2.02, 1.96), (8.75, 0.20, 3.20), white, 0.018)
    for sx in (-1, 1):
        box("Academy | white side wall", (sx * 4.33, 0.12, 1.96), (0.20, 3.95, 3.20), white, 0.018)
        box("Academy | side timber dado", (sx * 4.20, 0.12, 0.83), (0.08, 3.86, 0.85), wood_light, 0.012)
        lattice_panel("Academy | side scholar window", (sx * 4.45, 0.12, 2.28), 2.28, 1.42, wood, dark, "side" if sx < 0 else "side_reverse")
        # Small side veranda rails leave all three front bays open.
        box("Academy | veranda side handrail", (sx * 4.38, -2.12, 0.93), (0.11, 1.05, 0.11), wood, 0.018)
        for y in (-2.55, -1.70):
            box("Academy | veranda rail post", (sx * 4.38, y, 0.66), (0.13, 0.13, 0.62), wood, 0.015)

    # Four columns create a legible horizontal three-bay rhythm.
    for x in (-4.30, -1.43, 1.43, 4.30):
        box("Academy | column stone shoe", (x, -2.02, 0.44), (0.39, 0.39, 0.18), stone, 0.025)
        cylinder("Academy | slender cedar column", (x, -2.02, 1.98), 0.125, 2.96, wood, 16, 0.012)
        box("Academy | simple capital", (x, -2.02, 3.43), (0.43, 0.40, 0.16), wood_light, 0.022)
        for sx in (-1, 1):
            curve("Academy | restrained curved bracket", [(x, -2.02, 3.18), (x + sx * 0.20, -2.02, 3.44), (x + sx * 0.42, -2.02, 3.49)], 0.052, wood, smooth=True)
    box("Academy | three-bay front architrave", (0, -2.02, 3.54), (8.92, 0.22, 0.26), wood, 0.023)
    box("Academy | rear architrave", (0, 2.0, 3.54), (8.92, 0.22, 0.26), wood, 0.023)
    for x in (-4.30, 4.30):
        box("Academy | side architrave", (x, 0, 3.54), (0.22, 4.12, 0.26), wood, 0.023)
    for x in (-2.86, 0, 2.86):
        box("Academy | bay divider beam", (x, -0.05, 3.42), (0.12, 3.85, 0.18), wood_light, 0.016)
    geometric_plaque("Academy | open book plaque", (0, -2.17, 3.36), 1.70, dark, paper, "book")

    # Each bay contains its own study setting and a full bookshelf.
    for index, x in enumerate((-2.83, 0, 2.83)):
        bookshelf("Academy | rear bookshelf", (x, 1.72, 0.38), 2.18, 2.45, wood, dark, paper, book_blue)
        table("Academy | teaching desk", (x, -0.20, 0.36), 1.85, 0.78, 0.73, wood_light, paper)
        stool("Academy | scholar stool", (x, -1.18, 0.36), wood)
        scroll("Academy | open desk scroll", (x - 0.28, -0.20, 1.19), 0.70, paper, wood)
        box("Academy | inkstone", (x + 0.48, -0.22, 1.19), (0.23, 0.16, 0.055), ink, 0.018)
        curve("Academy | calligraphy brush", [(x + 0.40, -0.40, 1.19), (x + 0.66, 0.02, 1.19)], 0.013, wood)
        for j in range(3):
            box("Academy | stacked desk book", (x - 0.64, 0.02, 1.17 + j * 0.055), (0.36, 0.28, 0.045), book_blue if j % 2 else paper, 0.006)

    hip_roof("Academy | broad scholarly roof", 10.0, 6.0, 3.86, 0.88, tile, tile_edge, dark, ridge=2.05, spacing=0.30)
    return [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]
