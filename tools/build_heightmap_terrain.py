import argparse
import json
import math
import struct
from pathlib import Path

from osgeo import gdal


TILE_SIZE = 65
MAX_ZOOM_LIMIT = 14


def tile_range(bounds, level):
    west, south, east, north = bounds
    x_tiles = 2 ** (level + 1)
    y_tiles = 2 ** level
    tile_width = 360.0 / x_tiles
    tile_height = 180.0 / y_tiles

    min_x = max(0, math.floor((west + 180.0) / tile_width))
    max_x = min(x_tiles - 1, math.floor((east + 180.0 - 1e-12) / tile_width))
    min_y = max(0, math.floor((90.0 - north) / tile_height))
    max_y = min(y_tiles - 1, math.floor((90.0 - south - 1e-12) / tile_height))
    return range(min_x, max_x + 1), range(min_y, max_y + 1)


def tile_bounds(level, tile_x, tile_y):
    tile_width = 180.0 / (2 ** level)
    tile_height = 180.0 / (2 ** level)
    west = -180.0 + tile_x * tile_width
    north = 90.0 - tile_y * tile_height
    return west, north - tile_height, west + tile_width, north


def dataset_bounds(dataset):
    transform = dataset.GetGeoTransform()
    west = transform[0]
    north = transform[3]
    east = west + transform[1] * dataset.RasterXSize
    south = north + transform[5] * dataset.RasterYSize
    return [min(west, east), min(south, north), max(west, east), max(south, north)]


def choose_max_zoom(dataset, bounds):
    west, south, east, north = bounds
    longitude_resolution = max((east - west) / max(dataset.RasterXSize, 1), 1e-12)
    latitude_resolution = max((north - south) / max(dataset.RasterYSize, 1), 1e-12)
    source_resolution = max(longitude_resolution, latitude_resolution)
    level = math.ceil(math.log2(180.0 / (source_resolution * (TILE_SIZE - 1))))
    return max(0, min(MAX_ZOOM_LIMIT, level))


def write_float_tile(dataset, destination, bounds, no_data_value):
    tile = gdal.Warp(
        '',
        dataset,
        format='MEM',
        dstSRS='EPSG:4326',
        outputBounds=bounds,
        width=TILE_SIZE,
        height=TILE_SIZE,
        outputType=gdal.GDT_Float32,
        resampleAlg=gdal.GRA_Bilinear,
        dstNodata=no_data_value,
        multithread=True,
    )
    if tile is None:
        raise RuntimeError(f'GDAL could not generate tile {destination}')

    values = tile.GetRasterBand(1).ReadAsArray().astype('<f4', copy=False)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(struct.pack(f'<{values.size}f', *values.ravel()))


def build_terrain(source_path, output_path, requested_max_zoom):
    gdal.UseExceptions()
    source = gdal.Open(str(source_path), gdal.GA_ReadOnly)
    if source is None or source.RasterCount < 1:
        raise ValueError('The uploaded file is not a readable single-band DTM.')
    if not source.GetProjection():
        raise ValueError('The DTM has no coordinate reference system.')

    geographic = gdal.Warp('', source, format='VRT', dstSRS='EPSG:4326')
    bounds = dataset_bounds(geographic)
    band = geographic.GetRasterBand(1)
    minimum, maximum = band.ComputeRasterMinMax(True)
    no_data_value = 0.0
    max_zoom = requested_max_zoom if requested_max_zoom is not None else choose_max_zoom(geographic, bounds)
    max_zoom = max(0, min(MAX_ZOOM_LIMIT, max_zoom))

    output_path.mkdir(parents=True, exist_ok=False)
    preview_path = output_path / 'heightmap.png'
    gdal.Translate(
        str(preview_path),
        geographic,
        format='PNG',
        outputType=gdal.GDT_UInt16,
        scaleParams=[[minimum, maximum, 0, 65535]],
    )

    tile_count = 0
    for level in range(max_zoom + 1):
        if level == 0:
            x_range, y_range = range(2), range(1)
        else:
            x_range, y_range = tile_range(bounds, level)
        for tile_x in x_range:
            for tile_y in y_range:
                destination = output_path / 'tiles' / str(level) / str(tile_x) / f'{tile_y}.bin'
                write_float_tile(source, destination, tile_bounds(level, tile_x, tile_y), no_data_value)
                tile_count += 1

    metadata = {
        'tilejson': '2.1.0',
        'format': 'heightmap-1.0',
        'version': '1.0.0',
        'scheme': 'tms-geographic',
        'tiles': ['tiles/{z}/{x}/{y}.bin'],
        'bounds': bounds,
        'minzoom': 0,
        'maxzoom': max_zoom,
        'tileWidth': TILE_SIZE,
        'tileHeight': TILE_SIZE,
        'heightScale': 1,
        'heightOffset': 0,
        'minimumHeight': minimum,
        'maximumHeight': maximum,
        'tileCount': tile_count,
    }
    (output_path / 'layer.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    return metadata


def main():
    parser = argparse.ArgumentParser(description='Build tiled Cesium heightmaps from a GeoTIFF DTM.')
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--max-zoom', type=int)
    args = parser.parse_args()

    metadata = build_terrain(args.source.resolve(), args.output.resolve(), args.max_zoom)
    print(json.dumps(metadata))


if __name__ == '__main__':
    main()