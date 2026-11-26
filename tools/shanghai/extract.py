"""Crop a Shanghai OSM PBF into the renderable local dataset.

Usage: python tools/shanghai/extract.py input.osm.pbf
Requires osmium and shapely for this offline step.
"""
import json
import re
import sys
from pathlib import Path

import osmium
from shapely import make_valid
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

bounds = box(-250, -243, 254, 238)
core = box(-126, -134, 147, 133)
output = Path(__file__).resolve().parents[2] / 'src/experiments/shanghai-city/map.json'


def local(node):
    return (node.lon - 121.495) * 9524, (31.236 - node.lat) * 11113


def geometries(geometry, kind):
    if geometry.is_empty:
        return []
    if geometry.geom_type == kind:
        return [geometry]
    return [part for g in getattr(geometry, 'geoms', []) for part in geometries(g, kind)]


def vector(coords, close=False):
    pairs = [[round(x, 3), round(z, 3)] for x, z in coords]
    return pairs[:-1] if close else pairs


def polygon(g):
    return [vector(g.exterior.coords, True), *[vector(r.coords, True) for r in g.interiors]]


def numeric(value):
    if not value or not re.fullmatch(r'\s*\d+(\.\d+)?\s*m?\s*', value):
        return None
    return float(value.strip().removesuffix('m'))


class Extract(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.water = []
        self.parks = []
        self.roads = []
        self.buildings = []
        self.named = []

    def way(self, w):
        highway = w.tags.get('highway')
        code = {'trunk': 3, 'primary': 3, 'secondary': 2, 'tertiary': 2, 'residential': 1,
                'service': 0, 'pedestrian': 0, 'footway': 0, 'living_street': 0}.get(highway)
        if code is None or w.tags.get('tunnel') == 'yes':
            return
        path = [local(n) for n in w.nodes if n.location.valid()]
        if len(path) < 2:
            return
        for line in geometries(LineString(path).intersection(bounds if code >= 2 else core), 'LineString'):
            if line.length > 1.4:
                self.roads.append([code, vector(line.simplify(.13).coords)])

    def area(self, area):
        tags = area.tags
        building = tags.get('building')
        is_water = tags.get('natural') == 'water' or tags.get('waterway') == 'riverbank'
        park = tags.get('leisure') in ('park', 'garden') or tags.get('landuse') == 'grass'
        if not (building or is_water or park) or building in ('roof', 'construction'):
            return
        for ring in area.outer_rings():
            outer = [local(n) for n in ring if n.location.valid()]
            if len(outer) < 4:
                continue
            xs, zs = zip(*outer)
            if max(xs) < -250 or min(xs) > 254 or max(zs) < -243 or min(zs) > 238:
                continue
            holes = [[local(n) for n in r] for r in area.inner_rings(ring)]
            g = make_valid(Polygon(outer, holes)).intersection(bounds)
            for p in geometries(g.simplify(.08, preserve_topology=True), 'Polygon'):
                if p.area < .30:
                    continue
                if is_water:
                    self.water.append(p)
                elif park:
                    self.parks.append(p)
                elif building:
                    if not core.intersects(p) and p.area < 7.5:
                        continue
                    name = tags.get('name:en') or tags.get('name') or ''
                    h = numeric(tags.get('height'))
                    levels = numeric(tags.get('building:levels'))
                    self.buildings.append([p, h, levels, name, f'{"w" if area.from_way() else "r"}{area.orig_id()}'])
                    if name:
                        self.named.append((name, round(p.centroid.x,2), round(p.centroid.y,2), h, levels))


data = Extract()
source = Path(sys.argv[1])
header = osmium.io.Reader(str(source)).header()
data.apply_file(str(source), locations=True, idx='flex_mem')
water = unary_union(data.water)
main_river = max(geometries(water,'Polygon'),key=lambda p:p.area)
banks = [[], []]
for z in range(-132, 133, 2):
    lines = geometries(main_river.intersection(LineString([(-250,z),(254,z)])), 'LineString')
    if lines:
        xs = sorted(x for x,_ in max(lines, key=lambda g:g.length).coords)
        banks[0].append([round(xs[0], 3),z])
        banks[1].append([round(xs[-1], 3),z])

# Duplicated whole-footprint polygons can occur as both a closed way and an area relation.
dedup = {}
for p,h,levels,name,osm_id in data.buildings:
    if water.intersection(p).area > p.area*.45:
        continue
    c=p.centroid
    key=(round(c.x,1),round(c.y,1),round(p.area,1))
    previous=dedup.get(key)
    if not previous or bool(h)+bool(levels)+bool(name) > sum(bool(x) for x in previous[1:4]):
        dedup[key]=(p,h,levels,name,osm_id)
buildings = [[polygon(p), h, lev, name, osm_id] for p,h,lev,name,osm_id in dedup.values()]
stats = dict(coreBuildings=sum(core.intersects(p) for p,*_ in dedup.values()), buildings=len(buildings), heights=sum(h is not None for _,h,*_ in buildings),
             levels=sum(lev is not None for _,_,lev,*_ in buildings),
             neither=sum(h is None and lev is None for _,h,lev,*_ in buildings), roads=len(data.roads),
             water=len(geometries(water,'Polygon')), parks=len(data.parks), rings=sum(len(r)-1 for r,*_ in buildings))
timestamp = header.get('osmosis_replication_timestamp') or None
result = dict(sourceTimestamp=timestamp, stats=stats, buildings=buildings, roads=data.roads, banks=banks,
              land=[polygon(p) for p in geometries(bounds.difference(water),'Polygon')],
              parks=[polygon(p) for p in geometries(unary_union(data.parks).difference(water),'Polygon')])
output.write_text(json.dumps(result, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')
print(stats, timestamp, 'bytes:',output.stat().st_size)
for name,x,z,h,levels in data.named:
    if re.search(r'Pearl|Jin Mao|Financial Center|Shanghai Tower|Customs|Peace|明珠|金茂|海关|和平|上海中心|环球金融',name,re.I):
        print(name,x,z,h,levels)
