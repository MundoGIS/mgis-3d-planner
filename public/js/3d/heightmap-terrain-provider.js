(function (global) {
  class HeightmapTerrainProvider {
    constructor(options) {
      this.baseUrl = options.baseUrl.replace(/\/?$/, '/');
      this.metadata = options.metadata;
      this.errorEvent = new Cesium.Event();
      this.credit = undefined;
      this.tilingScheme = new Cesium.GeographicTilingScheme({
        numberOfLevelZeroTilesX: 2,
        numberOfLevelZeroTilesY: 1
      });
      this.ready = true;
      this.readyPromise = Promise.resolve(true);
      this.hasWaterMask = false;
      this.hasVertexNormals = false;
      this.availability = undefined;
    }

    requestTileGeometry(x, y, level, request) {
      if (!this.getTileDataAvailable(x, y, level)) {
        return undefined;
      }

      const tileUrl = new URL(`tiles/${level}/${x}/${y}.bin`, new URL(this.baseUrl, window.location.origin));
      const tileRequest = Cesium.Resource.fetchArrayBuffer({ url: tileUrl.toString(), request });
      if (!tileRequest) {
        return undefined;
      }

      return tileRequest
        .then(arrayBuffer => new Cesium.HeightmapTerrainData({
          buffer: new Float32Array(arrayBuffer),
          width: this.metadata.tileWidth,
          height: this.metadata.tileHeight,
          childTileMask: this.childTileMask(x, y, level),
          structure: {
            heightScale: this.metadata.heightScale,
            heightOffset: this.metadata.heightOffset,
            elementsPerHeight: 1,
            stride: 1,
            elementMultiplier: 256,
            isBigEndian: false
          }
        }))
        .catch(error => {
          this.errorEvent.raiseEvent(error);
          throw error;
        });
    }

    getLevelMaximumGeometricError(level) {
      return Cesium.TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
        this.tilingScheme.ellipsoid,
        this.metadata.tileWidth,
        this.tilingScheme.getNumberOfXTilesAtLevel(0)
      ) / (1 << level);
    }

    getTileDataAvailable(x, y, level) {
      if (level < this.metadata.minzoom || level > this.metadata.maxzoom) {
        return false;
      }
      if (level === 0) {
        return true;
      }
      return this.tileIntersectsBounds(x, y, level);
    }

    loadTileDataAvailability() {
      return undefined;
    }

    childTileMask(x, y, level) {
      if (level >= this.metadata.maxzoom) {
        return 0;
      }
      let mask = 0;
      if (this.tileIntersectsBounds(x * 2, y * 2 + 1, level + 1)) mask |= 1;
      if (this.tileIntersectsBounds(x * 2 + 1, y * 2 + 1, level + 1)) mask |= 2;
      if (this.tileIntersectsBounds(x * 2, y * 2, level + 1)) mask |= 4;
      if (this.tileIntersectsBounds(x * 2 + 1, y * 2, level + 1)) mask |= 8;
      return mask;
    }

    tileIntersectsBounds(x, y, level) {
      const rectangle = this.tilingScheme.tileXYToRectangle(x, y, level);
      const bounds = this.metadata.bounds;
      const west = Cesium.Math.toDegrees(rectangle.west);
      const south = Cesium.Math.toDegrees(rectangle.south);
      const east = Cesium.Math.toDegrees(rectangle.east);
      const north = Cesium.Math.toDegrees(rectangle.north);
      return east >= bounds[0] && west <= bounds[2] && north >= bounds[1] && south <= bounds[3];
    }
  }

  async function createLocalTerrainProvider(url) {
    const baseUrl = url.replace(/\/?$/, '/');
    const response = await fetch(`${baseUrl}layer.json`);
    if (!response.ok) {
      throw new Error(`Could not read terrain metadata (${response.status}).`);
    }
    const metadata = await response.json();
    if (metadata.format === 'heightmap-1.0') {
      return new HeightmapTerrainProvider({ baseUrl, metadata });
    }
    return new Cesium.CesiumTerrainProvider({
      url: baseUrl,
      requestVertexNormals: true,
      requestWaterMask: true
    });
  }

  global.HeightmapTerrainProvider = HeightmapTerrainProvider;
  global.createLocalTerrainProvider = createLocalTerrainProvider;
})(window);