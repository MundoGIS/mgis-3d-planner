let currentConfigName = 'default'; // Default configuration name
let selectedTerrain = null;
//let loadedLayers = {}; // Store loaded layers
let loadedTerrains = [];

document.addEventListener('DOMContentLoaded', function () {
  const reloadMapButton = document.getElementById('reloadMapButton');
  if (reloadMapButton) {
    reloadMapButton.addEventListener('click', function () {
      location.reload();
    });
  }

  const addLayerButton = document.getElementById('addLayerButton');
  if (addLayerButton) {
    addLayerButton.addEventListener('click', function () {
      addLayerDialog();
    });
  }

  loadLayers();
});


function ensureCesiumToken() {
  if (!Cesium.Ion.defaultAccessToken) {
    throw new Error("Cesium Ion token is not configured. Please check your default.json file.");
  }
}


async function loadLayers(skipTerrainZoom = false) {
  console.log('Loading layers and terrains...');
  try {
    const response = await fetch(`/3d/api/layers?config=${encodeURIComponent(currentConfigName)}`);
    if (!response.ok) {
      throw new Error('Error retrieving layers and terrains.');
    }
    const data = await response.json();

    if (data.cesiumToken && !Cesium.Ion.defaultAccessToken) {
      Cesium.Ion.defaultAccessToken = data.cesiumToken;
      console.log('Cesium Ion token configured from default.json');
    }

    const layers = data.config.layers || [];
    const terrains = data.config.terrains || [];

    loadedTerrains = terrains; // Store terrains with their properties

    renderLayers(layers);
    renderTerrains(terrains);

    if (!skipTerrainZoom) {
      // Automatically select the terrain marked as visible
      const visibleTerrain = terrains.find(terrain => terrain.visible);
      if (visibleTerrain) {
        await selectTerrain(visibleTerrain.url);
      } else {
        // If no visible terrain is found, select 'flat'
        await selectTerrain('flat');
      }
    }
  } catch (error) {
    console.error('Error loading layers:', error);
  }
}


function renderTerrains(terrains) {
  console.log("Rendering terrains:", terrains); // Debug log

  const terrainLayersList = document.getElementById("terrainLayersList");
  terrainLayersList.innerHTML = "";

  // Check if any terrain is selected
  const hasSelectedTerrain = terrains.some(terrain => terrain.visible);

  // Add "Flat Terrain" option at the beginning
  const flatTerrainItem = document.createElement("div");
  flatTerrainItem.className = "layer-item";
  flatTerrainItem.innerHTML = `
    <label>
      <input type="radio" name="terrainType" value="flat" onchange="selectTerrain('flat')" ${!hasSelectedTerrain ? "checked" : ""}>
      Flat Terrain
    </label>
  `;
  terrainLayersList.appendChild(flatTerrainItem);

  // Render other terrains without zoom buttons
  terrains.forEach((terrain) => {
    const layerItem = document.createElement("div");
    layerItem.className = "layer-item";

    // Determine if the terrain is visible
    const isSelected = terrain.visible ? "checked" : "";

    // Control buttons (delete only)
    const deleteButton =
      terrain.url !== "flat"
        ? `<i class="bx bx-trash" onclick="deleteItem('${terrain.name}', 'terrain')"></i>`
        : "";

    layerItem.innerHTML = `
      <label>
        <input type="radio" name="terrainType" value="${terrain.url}" ${isSelected} onchange="selectTerrain('${terrain.url}')">
        ${terrain.name}
      </label>
      ${deleteButton}
    `;

    terrainLayersList.appendChild(layerItem);
  });
}


function toggleLayerVisibility(layerName, isVisible) {
  console.log("Toggling visibility for layer:", layerName, "to", isVisible);

  // Search for the layer in loadedLayers case-insensitively
  const layerKey = Object.keys(loadedLayers).find(
    name => name.toLowerCase() === layerName.toLowerCase()
  );

  if (!layerKey) {
    console.error(`Layer "${layerName}" not found in loadedLayers.`);
    return;
  }

  const layer = loadedLayers[layerKey];

  if (!layer) {
    console.error(`Layer "${layerName}" not found in loadedLayers.`);
    return;
  }

  // Update visibility in loadedLayers
  layer.show = isVisible;
  layer.visible = isVisible;

  // Update visibility in Cesium
  if (layer.cesiumObject) {
    if (layer.cesiumObject instanceof Cesium.Cesium3DTileset || layer.cesiumObject instanceof Cesium.Model) {
      console.log(`Setting Cesium object show to ${isVisible} for layer "${layerName}"`);
      layer.cesiumObject.show = isVisible;
      console.log(`Layer "${layerName}" model visibility set to ${isVisible}.`);
    } else if (layer.cesiumObject instanceof Cesium.DataSource || layer.cesiumObject instanceof Cesium.CzmlDataSource) {
      console.log(`Setting Cesium object show to ${isVisible} for layer "${layerName}"`);
      layer.cesiumObject.show = isVisible;
      console.log(`Layer "${layerName}" dataSource visibility set to ${isVisible}.`);
    } else if (layer.cesiumObject instanceof Cesium.ImageryLayer) {
      console.log(`Setting Cesium object show to ${isVisible} for layer "${layerName}"`);
      layer.cesiumObject.show = isVisible;
      console.log(`Layer "${layerName}" ImageryLayer visibility set to ${isVisible}.`);
    } else {
      console.warn(`Layer "${layerName}" has an unsupported Cesium object type.`);
    }
  } else {
    console.warn(`Layer "${layerName}" does not have a cesiumObject.`);
  }

  // If it's a base layer being activated, deactivate other base layers
  if (isVisible && layer.isBaseLayer) {
    Object.keys(loadedLayers).forEach(name => {
      const otherLayer = loadedLayers[name];
      if (otherLayer.isBaseLayer && name !== layerKey) {
        otherLayer.show = false;
        otherLayer.visible = false; // Deactivate in JSON

        // Update visibility on the server
        updateLayerVisibilityInConfig(name, false);

        // Update visibility in Cesium
        if (otherLayer.cesiumObject) {
          if (otherLayer.cesiumObject instanceof Cesium.Cesium3DTileset || otherLayer.cesiumObject instanceof Cesium.Model) {
            console.log(`Setting Cesium object show to false for layer "${name}"`);
            otherLayer.cesiumObject.show = false;
          } else if (otherLayer.cesiumObject instanceof Cesium.DataSource || otherLayer.cesiumObject instanceof Cesium.CzmlDataSource) {
            console.log(`Setting Cesium object show to false for layer "${name}"`);
            otherLayer.cesiumObject.show = false;
          } else if (otherLayer.cesiumObject instanceof Cesium.ImageryLayer) {
            console.log(`Setting Cesium object show to false for layer "${name}"`);
            otherLayer.cesiumObject.show = false;
          }
        }

        // Update widget controls (checkboxes/radios)
        const checkbox = document.getElementById(`${name}-checkbox`);
        const radio = document.getElementById(`${name}-radio`);
        if (checkbox) {
          checkbox.checked = false;
        }
        if (radio) {
          radio.checked = false;
        }

        console.log(`Layer "${name}" visibility set to false as it's a base layer and another base layer was activated.`);
      }
    });
  }

  // Update on the server
  updateLayerVisibilityInConfig(layerName, isVisible);

  console.log(`Layer "${layerName}" visibility set to ${isVisible}.`);
}




let visibilityUpdateQueue = Promise.resolve();

async function updateLayerVisibilityInConfig(layerName, isVisible) {
  // Add the update to the queue to avoid simultaneous writes
  visibilityUpdateQueue = visibilityUpdateQueue.then(() => {
    return fetch(`/3d/api/update-layer-visibility`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: layerName, visible: isVisible, config: currentConfigName }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Layer not found on the server');
        }
        return response.json();
      })
      .then(data => {
        if (data.message === 'Layer visibility updated successfully') {
          console.log(`Layer ${layerName} visibility successfully updated in the configuration.`);
        } else {
          console.error('Error updating layer visibility:', data.error);
        }
      })
      .catch(error => {
        console.error('Error updating layer visibility:', error);
      });
  });
}





function removeLayerFromMap(layerName) {
  const layer = loadedLayers[layerName];

  if (layer) {
    console.log(`Attempting to remove layer: ${layerName}`);

    // Remove the corresponding Cesium object based on its type
    if (layer.cesiumObject instanceof Cesium.Cesium3DTileset || layer.cesiumObject instanceof Cesium.Model) {
      cesiumViewer.scene.primitives.remove(layer.cesiumObject);
      console.log(`Primitive layer "${layerName}" removed.`);
    } else if (layer.cesiumObject instanceof Cesium.DataSource || layer.cesiumObject instanceof Cesium.CzmlDataSource) {
      cesiumViewer.dataSources.remove(layer.cesiumObject);
      console.log(`DataSource layer "${layerName}" removed.`);
    } else if (layer.cesiumObject instanceof Cesium.ImageryLayer) {
      cesiumViewer.imageryLayers.remove(layer.cesiumObject, true);
      console.log(`Imagery layer "${layerName}" removed.`);
    } else {
      console.warn(`Layer "${layerName}" has an unsupported Cesium object type. Unable to remove.`);
    }

    // Remove the layer from loadedLayers
    delete loadedLayers[layerName];
    console.log(`Layer "${layerName}" removed from loadedLayers.`);
  } else {
    console.error(`Layer "${layerName}" not found in loadedLayers.`);
  }
}

function renderLayers(layers) {
  const baseLayersList = document.getElementById('baseLayersList');
  const vectorLayersList = document.getElementById('vectorLayersList');
  const terrainLayersList = document.getElementById('terrainLayersList');

  // Ensure the DOM elements exist
  if (!baseLayersList || !vectorLayersList || !terrainLayersList) {
    console.error("One or more layer lists are missing in the DOM.");
    return;
  }

  // Clear the lists before re-rendering
  baseLayersList.innerHTML = '';
  vectorLayersList.innerHTML = '';
  terrainLayersList.innerHTML = '';

  layers.forEach((layer) => {
    // Ensure 'layer.visible' is a boolean
    const isVisible = (typeof layer.visible === 'boolean') ? layer.visible : false;

    // Sync with layer.show (used by Cesium)
    layer.show = isVisible;

    // Create the HTML container for this layer
    const layerItem = document.createElement('div');
    layerItem.className = 'layer-item flex-container'; // Add a class for Flexbox

    // Logic for buttons (e.g., delete)
    let deleteButton = '';
    if (layer.name !== 'OpenStreetMap' && userRole === 'admin') {
      deleteButton = `
        <i class="bx bx-trash" onclick="deleteItem('${layer.name}', 'layer', '${layer.key}')"></i>
      `;
    }

    // Zoom button
    const zoomButton = `<i class="bx bx-search" onclick="zoomToLayer('${layer.name}')"></i>`;

    // Container to group zoom and delete buttons
    const buttonsContainer = `
      <div class="buttons-group">
        ${zoomButton}
        ${deleteButton}
      </div>
    `;

    // Specific rendering based on layer type
    if (layer.type === 'terrain') {
      // Terrain layers => radios without zoom buttons
      layerItem.innerHTML = `
        <div class="layer-left">
          <label>
            <input
              type="radio"
              name="terrainType"
              value="${layer.url}"
              onchange="selectTerrain('${layer.url}')"
              ${isVisible ? 'checked' : ''}
            >
            ${layer.name}
          </label>
        </div>
        <div class="layer-right">
          ${deleteButton}
        </div>
      `;
      terrainLayersList.appendChild(layerItem);

    } else if (layer.type === '3dtiles') {
      // 3D Tiles => checkbox with grouped buttons
      layerItem.innerHTML = `
        <div class="layer-left">
          <label>
            <input
              type="checkbox"
              name="tilesetType"
              value="${layer.url}"
              onchange="toggleLayerVisibility('${layer.name}', this.checked)"
              ${isVisible ? 'checked' : ''}
            >
            ${layer.name}
          </label>
        </div>
        <div class="layer-right">
          ${buttonsContainer}
        </div>
      `;
      vectorLayersList.appendChild(layerItem);

    } else if (layer.type === 'gltf') {
      // GLTF => checkbox with grouped buttons
      layerItem.innerHTML = `
        <div class="layer-left">
          <label>
            <input
              type="checkbox"
              name="gltfType"
              value="${layer.url}"
              onchange="toggleLayerVisibility('${layer.name}', this.checked)"
              ${isVisible ? 'checked' : ''}
            >
            ${layer.name}
          </label>
        </div>
        <div class="layer-right">
          ${buttonsContainer}
        </div>
      `;
      vectorLayersList.appendChild(layerItem);

    } else if (layer.type === 'czml') {
      // CZML => checkbox with grouped buttons
      layerItem.innerHTML = `
        <div class="layer-left">
          <label>
            <input
              type="checkbox"
              name="czmlType"
              value="${layer.url}"
              onchange="toggleLayerVisibility('${layer.name}', this.checked)"
              ${isVisible ? 'checked' : ''}
            >
            ${layer.name}
          </label>
        </div>
        <div class="layer-right">
          ${buttonsContainer}
        </div>
      `;
      vectorLayersList.appendChild(layerItem);

    } else if (layer.isBaseLayer) {
      // Base layers => radios without zoom buttons
      layerItem.innerHTML = `
        <div class="layer-left">
          <label>
            <input
              type="radio"
              name="baseLayer"
              id="${layer.name}-radio"
              onchange="toggleLayerVisibility('${layer.name}', this.checked)"
              ${isVisible ? 'checked' : ''}
            >
            ${layer.name}
          </label>
        </div>
        <div class="layer-right">
          ${deleteButton}
        </div>
      `;
      baseLayersList.appendChild(layerItem);

    } else {
      // Normal layers => checkbox with grouped buttons
      layerItem.innerHTML = `
        <div class="layer-left">
          <label>
            <input
              type="checkbox"
              id="${layer.name}-checkbox"
              onchange="toggleLayerVisibility('${layer.name}', this.checked)"
              ${isVisible ? 'checked' : ''}
            >
            ${layer.name}
          </label>
        </div>
        <div class="layer-right">
          ${buttonsContainer}
        </div>
      `;
      vectorLayersList.appendChild(layerItem);
    }

    // If the layer is already loaded, simply update its visibility
    if (loadedLayers[layer.name]) {
      // Update visibility of the loaded layer
      toggleLayerVisibility(layer.name, isVisible);
    } else {
      // Load the layer into Cesium
      loadLayer(layer);
    }
  });

  // Ensure checkboxes/radios reflect the value of layer.show
  updateLayerVisibility();
}







function updateLayerVisibility() {
  console.log("Updating layer visibility");
  Object.keys(loadedLayers).forEach(layerName => {
    const checkbox = document.getElementById(`${layerName}-checkbox`);
    const radio = document.getElementById(`${layerName}-radio`);
    if (checkbox) {
      checkbox.checked = loadedLayers[layerName].show;
    }
    if (radio) {
      radio.checked = loadedLayers[layerName].show;
    }
  });
}

async function load3DTileset(layer) {
  console.log(`Loading 3D Tileset for layer: ${layer.name}`);

  try {
    let tileset;

    if (layer.type === '3dtiles' && layer.id) {
      // Cargar desde Cesium Ion usando el asset ID
      console.log(`Using Cesium Ion Asset ID: ${layer.id}`);
      tileset = await Cesium.Cesium3DTileset.fromIonAssetId(layer.id);
    } else if (layer.type === '3dtiles') {
      // Cargar desde una URL local
      console.log(`Using URL: ${layer.url}`);
      tileset = new Cesium.Cesium3DTileset({ url: layer.url });
      await tileset.readyPromise;
    } else {
      throw new Error(`Unsupported 3D Tiles layer type: ${layer.type}`);
    }

    cesiumViewer.scene.primitives.add(tileset);
    tileset.show = layer.visible !== undefined ? layer.visible : true;

    // Registrar en loadedLayers con 'cesiumObject'
    loadedLayers[layer.name] = {
      cesiumObject: tileset, // Para 3D Tiles
      show: tileset.show,
      type: layer.type,
      isBaseLayer: layer.isBaseLayer || false, // Si aplica
    };

    console.log(`3D Tileset for layer "${layer.name}" loaded successfully.`);
  } catch (error) {
    console.error(`Error loading 3D Tileset for layer "${layer.name}":`, error);
  }
}






function loadLayer(layer) {
  console.log(`Loading layer: ${layer.name}`);

  switch (layer.type) {
    case 'ion':
    case 'local':
      loadTileset(layer);
      break;
    case 'wms':
      loadWmsLayer(layer);
      break;
    case 'osm':  // Manejar el caso de OpenStreetMap
      loadOsmLayer(layer);
      break;
    case '3dtiles':
      load3DTileset(layer);  // Usar la función ajustada para cargar 3D Tiles
      break;
    case 'gltf':
      loadGltfLayer(layer);
      break;
    case 'glb':
      loadGlbLayer(layer);
      break;
    case 'kml':
      loadKmlLayer(layer);
      break;
    case 'czml':
      loadCzmlLayer(layer);
      break;
    default:
      console.error('Unknown layer type:', layer.type);
  }
}

async function loadTileset(layer) {
  console.log("Loading tileset for layer:", layer.name);
  try {
    let tileset;

    if (layer.type === 'ion') {
      console.log("Using Cesium Ion Asset ID:", layer.id);
      tileset = await Cesium.Cesium3DTileset.fromIonAssetId(layer.id);
    } else {
      console.log("Using URL:", layer.url);
      tileset = new Cesium.Cesium3DTileset({ url: layer.url });
    }

    cesiumViewer.scene.primitives.add(tileset);

    tileset.show = layer.visible !== undefined ? layer.visible : true;

    // Registrar en loadedLayers con 'cesiumObject'
    loadedLayers[layer.name] = {
      cesiumObject: tileset,
      show: tileset.show,
      type: layer.type
    };

    console.log(`Tileset for layer ${layer.name} loaded successfully.`);
    cesiumViewer.zoomTo(tileset);
  } catch (error) {
    console.error(`Error loading tileset for layer ${layer.name}:`, error);
  }
}



// Función para cargar la capa OSM
function loadOsmLayer(layer) {
  console.log("Loading OSM layer:", layer);

  const osmLayer = new Cesium.OpenStreetMapImageryProvider();

  const imageryLayer = cesiumViewer.imageryLayers.addImageryProvider(osmLayer);
  imageryLayer.show = layer.visible !== undefined ? layer.visible : true;  // Respetar visibilidad
  loadedLayers[layer.name] = imageryLayer;  // Registrar la capa en loadedLayers

  console.log(`OSM layer ${layer.name} loaded with visibility: ${imageryLayer.show}`);
}


function loadWmsLayer(layer) {
  console.log("Loading WMS layer:", layer);
  const wmsLayer = new Cesium.WebMapServiceImageryProvider({
    url: layer.url,
    layers: layer.layerName,
    parameters: {
      service: "WMS",
      version: "1.1.1",
      request: "GetMap",
      styles: "",
      format: "image/png",
      transparent: true,
    },
  });

  const imageryLayer = cesiumViewer.imageryLayers.addImageryProvider(wmsLayer);
  imageryLayer.show = layer.visible !== undefined ? layer.visible : false;

  // Guarda la capa en `loadedLayers` para referencia futura
  loadedLayers[layer.name] = imageryLayer;

  console.log("WMS layer loaded:", layer.name, "with visibility:", imageryLayer.show);
}


function loadCzmlLayer(layer) {
  console.log("Loading CZML layer:", layer.name);
  const czmlPath = `/3d/${layer.czmlName}`;

  Cesium.CzmlDataSource.load(czmlPath)
    .then((dataSource) => {
      // Agregar el dataSource al visor
      cesiumViewer.dataSources.add(dataSource);

      // Determinar visibilidad
      const initialShow = (typeof layer.visible === 'boolean') ? layer.visible : false;
      dataSource.show = initialShow;

      // Registrar en loadedLayers con estructura uniforme
      loadedLayers[layer.name] = {
        cesiumObject: dataSource,
        type: layer.type,
        show: initialShow,
        isBaseLayer: layer.isBaseLayer || false,
      };
      dataSource.entities.values.forEach(entity => {
        if (entity.model && entity.position) {
          const position = entity.position.getValue(Cesium.JulianDate.now());
          const cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(position);

          console.log(`Model ${entity.id} loaded at height: ${cartographic.height}`);

          // Asegurarse de que los modelos no se escalen infinitamente
          entity.model.scale = 1.0; // Escala base inicial
          entity.model.minimumPixelSize = 64; // Mínimo tamaño en pantalla
          entity.model.maximumScale = 1; // Evita que los modelos sean gigantes

          // Configuración de escala por distancia (gradual)
          entity.model.scaleByDistance = new Cesium.NearFarScalar(
            0.0, // Desde 0 metros
            1.0, // Escala completa
            5000.0, // Hasta 5000 metros
            0.0 // Desaparece
          );

          // Desactivar la corrección automática del terreno
          entity.model.clampToGround = false;

          // Configuración de visibilidad por distancia
          entity.model.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(
            0.0, // Visible desde 0 metros
            20000.0 // Hasta 5000 metros
          );

          // Forzar la matriz de transformación para asegurar la escala dinámica
          const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
            Cesium.Cartesian3.fromDegrees(
              cartographic.longitude,
              cartographic.latitude,
              cartographic.height
            )
          );
          entity.model.modelMatrix = modelMatrix;
        } else {
          console.warn(`Entity ${entity.id} does not have a model or position.`);
        }
      });

      console.log(`CZML layer "${layer.name}" loaded successfully, visible: ${initialShow}.`);
    })
    .catch((error) => {
      console.error("Error loading CZML file:", error);
    });
}

async function loadGlbLayer(layer) {
  console.log("Loading GLB layer:", layer.name);

  // 1) Construir rutas 
  const geoJsonPath = `/geojson-conf/${layer.glbName.replace('.glb', '.geojson')}`;
  const glbPath = `/3d/${layer.glbName}`;

  try {
    // 2) Leer el GeoJSON de ubicación/rotación
    const response = await fetch(geoJsonPath);
    if (!response.ok) {
      throw new Error('GeoJSON file not found for this GLB model');
    }
    const data = await response.json();

    const [longitude, latitude, height] = data.features[0].geometry.coordinates;
    const props = data.features[0].properties;

    // 3) Calcular la matriz de posición y rotación
    const modelPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
    let modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(modelPosition);

    const hRot = Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(props.horizontalRotation || 0));
    const vRot = Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(props.verticalRotation || 0));
    const lRot = Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(props.lateralRotation || 0));

    // Combinar rotaciones
    let rotationMatrix = Cesium.Matrix3.multiply(hRot, lRot, new Cesium.Matrix3());
    rotationMatrix = Cesium.Matrix3.multiply(rotationMatrix, vRot, rotationMatrix);
    Cesium.Matrix4.multiplyByMatrix3(modelMatrix, rotationMatrix, modelMatrix);

    // 4) Cargar el modelo (GLB se carga igual que GLTF)
    const loadedModel = await Cesium.Model.fromGltfAsync({
      url: glbPath,
      modelMatrix: modelMatrix,
      scale: 1.0,
      minimumPixelSize: 0.0,
      clampToGround: true
    });

    // 5) Visibilidad inicial
    const initialShow = (typeof layer.visible === 'boolean') ? layer.visible : false;
    loadedModel.show = initialShow;

    // 6) Añadir a escena
    cesiumViewer.scene.primitives.add(loadedModel);

    // 7) Registrar en loadedLayers
    loadedLayers[layer.name] = {
      cesiumObject: loadedModel,
      type: layer.type,    // 'glb'
      show: initialShow,
    };

    // 8) Ajustar texturas (si quieres la misma lógica)
    await loadedModel.readyPromise;
    adjustModelTextures(loadedModel);

    console.log(`GLB layer loaded and textures adjusted: ${layer.name}`);
  } catch (error) {
    console.error('Error loading GLB file:', error);
  }
}


async function loadGltfLayer(layer) {
  console.log("Loading GLTF layer:", layer.name);
  const geoJsonPath = `/geojson-conf/${layer.gltfName.replace('.gltf', '.geojson')}`;
  const gltfPath = `/3d/${layer.gltfName}`;

  try {
    const response = await fetch(geoJsonPath);
    if (!response.ok) {
      throw new Error('GeoJSON file not found');
    }
    const data = await response.json();

    const coordinates = data.features[0].geometry.coordinates;
    const properties = data.features[0].properties;

    const longitude = coordinates[0];
    const latitude = coordinates[1];
    const height = coordinates[2];

    // Crear la posición del modelo en Cesium
    const modelPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
    let modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(modelPosition);

    // Aplicar rotaciones: horizontal (Z), vertical (X), lateral (Y)
    const hRotation = Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(properties.horizontalRotation || 0));
    const vRotation = Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(properties.verticalRotation || 0));
    const lRotation = Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(properties.lateralRotation || 0));

    // Combinar las tres rotaciones
    const rotationMatrix = Cesium.Matrix3.multiply(hRotation, lRotation, new Cesium.Matrix3());
    Cesium.Matrix3.multiply(rotationMatrix, vRotation, rotationMatrix);

    // Aplicar la rotación combinada al modelMatrix final
    Cesium.Matrix4.multiplyByMatrix3(modelMatrix, rotationMatrix, modelMatrix);

    // Cargar el modelo GLTF con la matriz de transformación
    const loadedModel = await Cesium.Model.fromGltfAsync({
      url: gltfPath,
      modelMatrix: modelMatrix,
      scale: 1.0, // Mantiene la escala original del modelo
      minimumPixelSize: 0.0, // Evita el escalado automático basado en el tamaño en pantalla
      clampToGround: true // Asegura que el modelo se ajuste al terreno
    });

    // Asignar la visibilidad inicial
    const initialShow = (typeof layer.visible === 'boolean') ? layer.visible : false;
    loadedModel.show = initialShow;

    // Agregar el modelo a la escena
    cesiumViewer.scene.primitives.add(loadedModel);

    // Registrar en loadedLayers con 'cesiumObject'
    loadedLayers[layer.name] = {
      cesiumObject: loadedModel,
      type: layer.type,
      show: initialShow,
    };

    // Ajustar texturas y filtros cuando el modelo esté listo
    await loadedModel.readyPromise;
    adjustModelTextures(loadedModel);
    console.log(`GLTF layer loaded and textures adjusted: ${layer.name}`);
  } catch (error) {
    console.error('Error loading GLTF/GLB file:', error);
  }
}








function adjustModelTextures(model) {
  if (model.gltf && model.gltf.textures) {
    model.gltf.textures.forEach(texture => {
      if (texture && texture.sampler) {
        // Asegúrate de que los filtros sean bilineales
        texture.sampler.minificationFilter = Cesium.TextureMinificationFilter.LINEAR;
        texture.sampler.magnificationFilter = Cesium.TextureMagnificationFilter.LINEAR;

        // Asegurarse de regenerar mipmaps con configuraciones específicas
        if (texture.image && texture.image.internalFormat) {
          const gl = cesiumViewer.scene.context._gl;
          const target = gl.TEXTURE_2D;
          gl.bindTexture(target, texture.image._texture);
          gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.generateMipmap(target);
          gl.bindTexture(target, null);
        }
      }
    });
  }
}

function zoomToLayer(layerName) {
  console.log(`Zooming to layer: ${layerName}`);
  const layer = loadedLayers[layerName];

  if (!layer) {
    console.error(`Layer "${layerName}" not found in loadedLayers.`);
    return;
  }

  console.log(`Layer object:`, layer);

  // Caso 1: Capa con 'cesiumObject' (e.g., Cesium3DTileset, Cesium.Model, Cesium.DataSource)
  if (layer.cesiumObject) {
    console.log(`Layer "${layerName}" cesiumObject is instance of:`, layer.cesiumObject.constructor.name);

    // Subcaso 1.1: Cesium3DTileset o Cesium.Model
    if (layer.cesiumObject instanceof Cesium.Cesium3DTileset || layer.cesiumObject instanceof Cesium.Model) {
      console.log(`Zooming to model layer "${layerName}"`);
      if (layer.cesiumObject.readyPromise) {
        layer.cesiumObject.readyPromise
          .then(() => {
            cesiumViewer.zoomTo(layer.cesiumObject).catch(error => {
              console.error(`Error during zoom to layer "${layerName}":`, error);
            });
          })
          .catch(error => {
            console.error(`Error waiting for readyPromise for layer "${layerName}":`, error);
          });
      } else {
        cesiumViewer.zoomTo(layer.cesiumObject).catch(error => {
          console.error(`Error during zoom to layer "${layerName}":`, error);
        });
      }
      return;
    }

    // Subcaso 1.2: Cesium.DataSource (CZML)
    if (layer.cesiumObject instanceof Cesium.DataSource || layer.cesiumObject instanceof Cesium.CzmlDataSource) {
      cesiumViewer.zoomTo(layer.cesiumObject).catch(error => {
        console.error(`Error during zoom to CZML layer "${layerName}":`, error);
      });
      return;
    }
  }

  // Caso 2: ImageryLayer (e.g., WMS, OSM)
  if (layer.cesiumObject instanceof Cesium.ImageryLayer) {
    const provider = layer.cesiumObject.imageryProvider;
    if (provider && provider.rectangle) {
      const rectangle = provider.rectangle;
      const boundingSphere = Cesium.BoundingSphere.fromRectangle3D(rectangle);
      cesiumViewer.camera.flyToBoundingSphere(boundingSphere, { duration: 2 });
    } else {
      console.warn(`No rectangle info for ImageryProvider of layer "${layerName}". Flying home as fallback...`);
      cesiumViewer.camera.flyHome(2);
    }
    return;
  }

  // Caso 3: Otros tipos de capas (opcional)
  // Añade más casos si tienes otros tipos de capas con funcionalidades de zoom

  // Caso por defecto: Tipo de capa no reconocido
  console.warn(`No zoom handler for layer: "${layerName}"`);
}





function deleteItem(itemName, itemType, itemKey) {
  if (!confirm(`¿Estás seguro de que deseas eliminar "${itemName}"?`)) {
    return;
  }

  fetch('/3d/api/delete-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: itemName, type: itemType, key: itemKey }),
  })
    .then(response => response.json())
    .then(data => {
      if (data.message === 'Item deleted successfully') {
        console.log(`Item "${itemName}" deleted successfully.`);

        // Si era una capa, remuévela del mapa
        if (itemType === 'layer') {
          removeLayerFromMap(itemName);
        }

        // Recargar la lista en la interfaz
        loadLayers();
      } else {
        console.error('Error deleting item:', data.error);
      }
    })
    .catch(error => {
      console.error('Error deleting item:', error);
    });
}



// Función para calcular el bounding box a partir de las coordenadas GeoJSON
function calculateBoundingBox(coordinates) {
  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  coordinates.forEach(coord => {
    const [lon, lat] = coord;
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  });

  return { west, south, east, north };
}

// Funciones de carga y guardado de capas
async function loadLayersFromConfig(configName) {
  console.log(`Loading layers from config: ${configName}`);
  try {
    const response = await fetch(`/3d/api/layers?config=${encodeURIComponent(configName)}`);
    if (!response.ok) {
      throw new Error(`Error fetching layers for config "${configName}".`);
    }

    // Assuming the endpoint returns an array of layers
    const layers = await response.json();

    // If you use an osmLayerConfig, insert it if you want it to be the default base layer
    // layers.unshift(osmLayerConfig); // <-- only if your project requires it

    console.log("Layers loaded from config:", layers);
    renderLayers(layers);
  } catch (error) {
    console.error('Error loading layers from config:', error);
  }
}


async function addLayerDialog() {
  console.log("Opening add layer dialog");

  const dialog = document.createElement("div");
  dialog.setAttribute("id", "layerDialog");
  dialog.setAttribute("class", "modal is-active");
  dialog.innerHTML = `
    <div class="modal-layers-background"></div>
    <div class="modal-layers-content">
      <div class="box">
        <div class="field">
          <label class="label">Select the layer type</label>
          <div class="control">
            <div class="select">
              <select id="selectType">
                <option value="">Select the layer type</option>
                <option value="ion">Cesium Ion</option>
                <option value="gltf">GLTF</option>
                <option value="glb">GLB</option>
                <option value="wms">WMS</option>
                <option value="kml">KML</option>
                <option value="czml">CZML</option>
                <option value="3dtiles">Local 3D Tiles</option>
                <option value="localTerrain">Local Terrain</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Specific fields for each layer type -->
        <!-- Local 3D Tiles -->
        <div class="field" id="3dtilesField" style="display: none;">
          <label class="label">Select a local 3D Tiles model</label>
          <div class="control">
            <div class="select">
              <select id="3dtilesSelect">
                <option value="">Loading 3D Tiles...</option>
              </select>
            </div>
          </div>
        </div>

        <!-- WMS URL -->
        <div class="field" id="wmsUrlField" style="display: none;">
          <label class="label">Add the WMS URL</label>
          <div class="control">
            <input class="input" type="text" id="wmsUrlInput" placeholder="https://example.com/wms" required>
          </div>
        </div>

        <!-- WMS Layer Selection -->
        <div class="field" id="wmsLayerField" style="display: none;">
          <label class="label">Select a WMS layer</label>
          <div class="control">
            <div class="select">
              <select id="wmsLayerSelect">
                <option value="">Loading WMS layers...</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Option to choose if it is a base layer -->
        <div class="field" id="wmsBaseLayerField" style="display: none;">
          <label class="checkbox">
            <input type="checkbox" id="wmsIsBaseLayer"> Is this a base layer?
          </label>
        </div>

        <!-- CZML -->
        <div class="field" id="czmlField" style="display: none;">
          <label class="label">Select a CZML file</label>
          <div class="control">
            <div class="select">
              <select id="czmlSelect">
                <option value="">Loading CZML files...</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Cesium Ion Assets -->
        <div class="field" id="ionAssetsField" style="display: none;">
          <label class="label">Select a Cesium Ion 3D Tiles asset</label>
          <div class="control">
            <div class="select">
              <select id="ionAssetsSelect">
                <option value="">Loading Ion data...</option>
              </select>
            </div>
          </div>
        </div>

        <!-- GLTF -->
        <div class="field" id="gltfField" style="display: none;">
          <label class="label">Select a GLTF model</label>
          <div class="control">
            <div class="select">
              <select id="gltfSelect">
                <option value="">Loading GLTF files...</option>
              </select>
            </div>
          </div>
        </div>

         <!-- GLB -->
        <div class="field" id="glbField" style="display: none;">
          <label class="label">Select a GLB model</label>
          <div class="control">
            <div class="select">
              <select id="glbSelect">
                <option value="">Loading GLB files...</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Local Terrain Dropdown -->
        <div class="field" id="localTerrainField" style="display: none;">
          <label class="label">Select a local terrain</label>
          <div class="control">
            <div class="select">
              <select id="localTerrainDropdown">
                <option value="">Loading terrains...</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Layer Name -->
        <div class="field">
          <label class="label">Layer name</label>
          <div class="control">
            <input class="input" type="text" id="nameInput" placeholder="Layer name" required>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="field is-grouped">
          <div class="control">
            <button class="button is-primary" id="submitButton">Add layer</button>
          </div>
          <div class="control">
            <button class="button is-light" id="cancelButton">Cancel</button>
          </div>
        </div>
      </div>
    </div>
    <button class="modal-layers-close is-large" aria-label="close"></button>
  `;

  document.body.appendChild(dialog);



  // Función para cerrar el modal
  function closeModal() {
    dialog.classList.remove('is-active');
    document.body.removeChild(dialog);
  }

  const selectType = document.getElementById('selectType');
  const ionAssetsField = document.getElementById('ionAssetsField');
  const gltfField = document.getElementById('gltfField');
  const glbField = document.getElementById('glbField');
  const czmlField = document.getElementById('czmlField');
  const wmsUrlField = document.getElementById('wmsUrlField');
  const wmsLayerField = document.getElementById('wmsLayerField');
  const wmsBaseLayerField = document.getElementById('wmsBaseLayerField');
  const localTerrainField = document.getElementById("localTerrainField");
  const localTerrainDropdown = document.getElementById("localTerrainDropdown");
  const tilesField = document.getElementById('3dtilesField');
  const tilesSelect = document.getElementById('3dtilesSelect');
  const czmlSelect = document.getElementById('czmlSelect');
  const wmsUrlInput = document.getElementById('wmsUrlInput');
  const wmsLayerSelect = document.getElementById('wmsLayerSelect');
  const wmsIsBaseLayer = document.getElementById('wmsIsBaseLayer');
  const ionAssetsSelect = document.getElementById('ionAssetsSelect');
  const gltfSelect = document.getElementById('gltfSelect');

  // Limpia y oculta todos los campos
  function hideAllFields() {
    const fieldsToHide = [
      '3dtilesField',
      'wmsUrlField',
      'wmsLayerField',
      'wmsBaseLayerField',
      'czmlField',
      'ionAssetsField',
      'gltfField',
      'glbField',
      'localTerrainField'
    ];
    fieldsToHide.forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
  }

  // Listener consolidado para el evento 'change' de 'selectType'
  selectType.addEventListener('change', async (event) => {
    const selectedType = event.target.value;
    hideAllFields(); // Oculta todos los campos inicialmente

    switch (selectedType) {
      case '3dtiles':
        // Muestra el field 3dtiles
        document.getElementById('3dtilesField').style.display = 'block';
        await load3DTilesFolders(); // Llama a la ruta /3d/api/3dtiles-files
        break;

      case 'wms':
        wmsUrlField.style.display = 'block';
        wmsBaseLayerField.style.display = 'block';
        break;

      case 'czml':
        czmlField.style.display = 'block';
        await loadCzmlFiles();
        break;

      case 'ion':
        ionAssetsField.style.display = 'block';
        await loadIonAssetsAutomatically();
        break;

      case 'gltf':
        gltfField.style.display = 'block';
        await loadGltfFiles();
        break;
      case 'glb':
        glbField.style.display = 'block';
        await loadGlbfFiles();
        break;
      case 'localTerrain':
        localTerrainField.style.display = 'block';
        await loadTerrainOptions(); // Cargar terrenos locales
        break;

      default:
        // No hacer nada si no se selecciona ningún tipo
        break;
    }
  });

  async function load3DTilesFolders() {
    try {
      const response = await fetch('/3d/api/3dtiles-folders');
      const data = await response.json();
      const tilesDropdown = document.getElementById('3dtilesSelect');

      // Rellenar
      tilesDropdown.innerHTML = data.folders
        .map(folder => `<option value="${folder}">${folder}</option>`)
        .join('');

      // Si quieres forzar la selección de la primera carpeta:
      if (data.folders.length > 0) {
        tilesDropdown.value = data.folders[0];
        // Llamar manualmente a load3dTilesFiles con la primera
        await load3dTilesFiles(data.folders[0]);
      }
    } catch (error) {
      console.error('Error loading 3D Tiles folders:', error);
    }
  }



  let selectedTilesetUrl = null;

  async function load3dTilesFiles(selectedFolder) {
    try {
      const response = await fetch(`/3d/api/3dtiles-files?folder=${encodeURIComponent(selectedFolder)}`);
      if (!response.ok) {
        throw new Error('The tileset.json file was not found in the selected folder.');
      }
      const data = await response.json();

      // Save the tileset URL in selectedTilesetUrl
      selectedTilesetUrl = data.tileset;
      console.log("Tileset URL loaded:", selectedTilesetUrl);
    } catch (error) {
      console.error('Error loading 3D Tiles files:', error);
      selectedTilesetUrl = null; // Ensure no invalid value is used
    }
  }



  //let selectedTilesetUrl = null;

  tilesSelect.addEventListener('change', async function () {
    const folderName = this.value;
    if (!folderName) {
      selectedTilesetUrl = null;
      return;
    }
    try {
      const response = await fetch(`/3d/api/3dtiles-files?folder=${encodeURIComponent(folderName)}`);
      if (!response.ok) {
        throw new Error('No se encontró el tileset.json en esa carpeta');
      }
      const data = await response.json();
      selectedTilesetUrl = data.tileset; // e.g. "/Tiles/micarpeta/tileset.json"
      console.log('Tileset URL loaded:', selectedTilesetUrl);
    } catch (error) {
      console.error('Error retrieving tileset.json:', error);
      selectedTilesetUrl = null;
    }
  });




  // Función para cargar capas WMS desde la URL usando GetCapabilities
  async function loadWmsLayers(wmsUrl) {
    try {
      const response = await fetch(`/3d/api/loadWmsLayers?url=${encodeURIComponent(wmsUrl)}`);
      const data = await response.json();
      wmsLayerSelect.innerHTML = data.map(layer => `<option value="${layer.name}">${layer.name}</option>`).join('');
      wmsLayerField.style.display = 'block'; // Mostrar la selección de capas WMS
    } catch (error) {
      console.error('Error loading WMS layers:', error);
    }
  }

  // Listener para cargar capas WMS cuando se ingresa la URL
  wmsUrlInput.addEventListener('input', async () => {
    const wmsUrl = wmsUrlInput.value.trim();
    if (wmsUrl) {
      await loadWmsLayers(wmsUrl); // Cargar las capas WMS desde la URL proporcionada
    } else {
      wmsLayerSelect.innerHTML = `<option value="">-- Seleccione una URL WMS primero --</option>`;
      wmsLayerField.style.display = 'none';
    }
  });

  // Función para cargar archivos CZML y llenar el dropdown
  async function loadCzmlFiles() {
    try {
      const response = await fetch('/3d/api/czml-files');
      const data = await response.json();
      czmlSelect.innerHTML = data.files3D.map(file => `<option value="${file.name}">${file.name}</option>`).join('');
    } catch (error) {
      console.error('Error loading CZML files:', error);
    }
  }

  // Función para cargar archivos GLTF y llenar el dropdown
  async function loadGltfFiles() {
    try {
      const response = await fetch('/3d/api/gltf-files');
      const data = await response.json();
      gltfSelect.innerHTML = data.files3D.map(file => `<option value="${file.name}">${file.name}</option>`).join('');
    } catch (error) {
      console.error('Error loading GLTF files:', error);
    }
  }
   // Función para cargar archivos GLTF y llenar el dropdown
   async function loadGlbfFiles() {
    try {
      const response = await fetch('/3d/api/glb-files');
      const data = await response.json();
      // Usar el select de GLB (id="glbSelect") y no gltfSelect
      const glbSelect = document.getElementById("glbSelect");
      glbSelect.innerHTML = data.files3D
        .map(file => `<option value="${file.name}">${file.name}</option>`)
        .join('');
    } catch (error) {
      console.error('Error loading GLB files:', error);
    }
  }
  // Función para cargar terrenos locales (carpetas) SIN buscar terrain.json
  async function loadTerrainOptions() {
    try {
      // Ajusta la ruta al endpoint que listará TODAS las subcarpetas
      const response = await fetch('/3d/api/terrain-files');
      if (!response.ok) {
        throw new Error('Error retrieving the list of local terrains.');
      }
      const terrains = await response.json();

      const terrainDropdown = document.getElementById('localTerrainDropdown');
      if (terrains.length > 0) {
        terrainDropdown.innerHTML = terrains
          .map(terrain => `<option value="${terrain.url}">${terrain.name}</option>`)
          .join('');
      } else {
        terrainDropdown.innerHTML = `<option value="">No land available to add</option>`;
      }
    } catch (error) {
      console.error('Error loading terrain options:', error);
      const terrainDropdown = document.getElementById('localTerrainDropdown');
      terrainDropdown.innerHTML = `<option value="">Error when loading terrain</option>`;
    }
  }


  // Función para cargar activos de Cesium Ion automáticamente
  async function loadIonAssetsAutomatically() {
    try {
      const response = await fetch('/3d/api/load-ion-token');
      const data = await response.json();

      // Verifica si hay un token disponible
      if (data.token) {
        Cesium.Ion.defaultAccessToken = data.token;
        console.log('Cesium Ion token automatically configured.');

        // Cargar los activos de Ion
        await loadIonAssets(data.token);
      } else {
        console.error('No Cesium Ion token found in the configuration.');
      }
    } catch (error) {
      console.error('Error whean loading Cesium Ion Token:', error);
    }
  }

  // Función para cargar activos de Cesium Ion
  async function loadIonAssets(token) {
    try {
      const response = await fetch('/3d/api/proxy-ion-assets');
      const data = await response.json();

      // Filtra y muestra solo terrenos y 3D Tiles
      const combinedAssets = data.items.filter(
        asset => asset.type === 'TERRAIN' || asset.type === '3DTILES'
      );

      const ionAssetsSelect = document.getElementById('ionAssetsSelect');
      if (combinedAssets.length > 0) {
        ionAssetsSelect.innerHTML = combinedAssets
          .map(
            asset => `
          <option value="${asset.id}" data-type="${asset.type.toLowerCase()}">
            ${asset.name} (${asset.type === 'TERRAIN' ? 'Terrain' : '3D Tiles'})
          </option>
        `
          )
          .join('');
        ionAssetsSelect.parentElement.style.display = 'block'; // Muestra el dropdown
      } else {
        ionAssetsSelect.innerHTML = `<option value="">No assets found</option>`;
      }
    } catch (error) {
      console.error('Error loading Cesium Ion files:', error);
    }
  }

  // Listener para cerrar el modal al hacer clic en "Cancelar"
  const cancelButton = document.getElementById('cancelButton');
  cancelButton.addEventListener('click', closeModal);

  // Listener para cerrar el modal al hacer clic en la "X" del modal
  const closeModalButton = document.querySelector('.modal-layers-close');
  closeModalButton.addEventListener('click', closeModal);

  // Listener para el botón de envío
  const submitButton = document.getElementById("submitButton");
  submitButton.onclick = async function () {
    const type = document.getElementById("selectType").value;
    const name = document.getElementById("nameInput").value.trim();

    const ionAssetId = ionAssetsSelect?.value;
    const assetType = ionAssetsSelect?.selectedOptions[0]?.getAttribute("data-type");
    const tilesetName = tilesSelect?.value;
    const gltfName = gltfSelect?.value;
    const glbName = document.getElementById("glbSelect")?.value;  // <-- Agregado para GLB
    const czmlFile = czmlSelect?.value;
    const wmsUrl = wmsUrlInput?.value.trim();
    const wmsLayer = wmsLayerSelect?.value;
    const isBaseLayer = wmsIsBaseLayer?.checked;
    const selectedUrl = localTerrainDropdown?.value;

    try {
      let layerConfig;

      switch (type) {
        // ------------------------------------------------------
        // A) CESIUM ION
        // ------------------------------------------------------
        case "ion":
          if (!ionAssetId || !assetType) {
            alert("Please choose a valid Ion asset and name.");
            return;
          }
          if (assetType === "terrain") {
            // Terreno Ion
            layerConfig = {
              name,
              type: "ion",  // o "terrainIon", según tu convención
              id: ionAssetId,
              url: `https://assets.cesium.com/${ionAssetId}/tileset.json`
            };
            await saveTerrainLayer(layerConfig);
          } else if (assetType === "3dtiles") {
            // 3D Tiles Ion
            layerConfig = {
              name,
              type: "3dtiles",
              id: ionAssetId,
              url: `https://assets.cesium.com/${ionAssetId}/tileset.json`
            };
            await saveLayer(layerConfig);
          }
          break;

        // ------------------------------------------------------
        // B) LOCAL TERRAIN
        // ------------------------------------------------------
        case "localTerrain":
          if (!selectedUrl) {
            alert("Please select a local terrain folder and name.");
            return;
          }
          layerConfig = {
            name,
            type: "local",  // Indica un terreno local
            url: selectedUrl
          };
          await saveTerrainLayer(layerConfig);
          break;

        // ------------------------------------------------------
        // C) LOCAL 3D TILES
        // ------------------------------------------------------
        case "3dtiles":
          if (!selectedTilesetUrl) {
            alert("Please select a local 3D Tiles folder (tileset.json).");
            return;
          }
          layerConfig = {
            name,
            type: "3dtiles",
            url: selectedTilesetUrl,
            visible: false
          };
          await saveLayer(layerConfig);
          break;

        // ------------------------------------------------------
        // D) GLTF
        // ------------------------------------------------------
        case "gltf":
          if (!gltfName) {
            alert("Please select a GLTF file and name.");
            return;
          }
          layerConfig = {
            name,
            type: "gltf",
            visible: false,
            gltfName
          };
          await saveLayer(layerConfig);
          break;

           // ------------------------------------------------------
        // D) GLB
        // ------------------------------------------------------
        case "glb":
          if (!glbName) {
            alert("Please select a GLB file and name.");
            return;
          }
          layerConfig = {
            name,
            type: "glb",
            visible: false,
            glbName
          };
          await saveLayer(layerConfig);
          break;

        // ------------------------------------------------------
        // E) CZML
        // ------------------------------------------------------
        case "czml":
          if (!czmlFile) {
            alert("Please select a CZML file and name.");
            return;
          }
          layerConfig = {
            name,
            type: "czml",
            visible: false,
            czmlName: czmlFile
          };
          await saveLayer(layerConfig);
          break;

        // ------------------------------------------------------
        // F) WMS
        // ------------------------------------------------------
        case "wms":
          if (!wmsUrl || !wmsLayer) {
            alert("Please fill WMS URL and layer name.");
            return;
          }
          layerConfig = {
            name,
            type: "wms",
            url: wmsUrl,
            layerName: wmsLayer,
            isBaseLayer
          };
          await saveLayer(layerConfig);
          break;

        // ------------------------------------------------------
        // G) KML (o algo que tengas pendiente)
        // ------------------------------------------------------
        case "kml":
          // Aquí falta la lógica para KML (si la necesitas).
          alert("KML saving is not implemented yet.");
          break;

        default:
          alert("Invalid layer type. Please select a valid type.");
          return;
      }
      // Close the modal after saving the layer
      closeModal();
    } catch (error) {
      console.error("Error saving the layer:", error);
      alert("An error occurred while saving the layer. Please try again.");
    }
  };


  // Función para guardar un terreno (Ion o Local)
  async function saveTerrainLayer(layerConfig) {
    try {
      console.log("Saving terrain layer:", layerConfig);
      const response = await fetch('/3d/api/save-terrain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layerConfig),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to save terrain layer');
      }
      const data = await response.json();
      console.log('Terrain layer added successfully:', data);
      alert(`Terrain "${layerConfig.name}" successfully added.`);
      loadLayers(); // Recargar capas en tu interfaz
    } catch (error) {
      console.error('Error adding terrain layer:', error);
      alert('Error adding terrain layer: ' + error.message);
    }
  }

  async function saveLayer(layerConfig) {
    try {
      console.log("Saving layer:", layerConfig);
      const response = await fetch('/3d/api/save-layer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layerConfig),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to save layer');
      }
      const data = await response.json();
      console.log('Layer added successfully:', data);
      alert(`Layer "${layerConfig.name}" successfully added.`);
      loadLayers(); // Recargar capas en tu interfaz
    } catch (error) {
      console.error('Error adding layer:', error);
      alert('Error adding layer: ' + error.message);
    }
  }
}

function saveLayersToFile(newLayers) {
  const filePath = path.join(__dirname, '..', 'data', '3d-jsons', 'default.json');

  // 1) Leer config actual
  const data = fs.readFileSync(filePath, 'utf8');
  const config = JSON.parse(data);

  // 2) Reemplazar config.config.layers con newLayers
  config.config.layers = newLayers;

  // 3) Guardar
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
}



async function loadTerrainOptions() {
  try {
    const response = await fetch('/3d/api/terrain-files'); // Corrected path
    if (!response.ok) {
      throw new Error('Error fetching the list of local terrains.');
    }
    const terrains = await response.json();

    const terrainDropdown = document.getElementById('localTerrainDropdown');
    terrainDropdown.innerHTML = terrains.length > 0
      ? terrains.map(terrain => `<option value="${terrain.url}">${terrain.name}</option>`).join('')
      : `<option value="">No terrains available to add</option>`;
  } catch (error) {
    console.error('Error loading terrain options:', error);
    const terrainDropdown = document.getElementById('localTerrainDropdown');
    terrainDropdown.innerHTML = `<option value="">Error loading terrains</option>`;
  }
}


async function loadTerrains() {
  try {
    const response = await fetch('/3d/api/terrains');
    const terrains = await response.json();

    const terrainLayersList = document.getElementById('terrainLayersList');
    terrainLayersList.innerHTML = terrains
      .map(terrain => `
        <label class="layer-item">
          <input type="radio" name="terrainType" value="${terrain.name}" onchange="selectTerrain('${terrain.url}')">
          ${terrain.name}
        </label>
      `)
      .join('');
  } catch (error) {
    console.error('Error loading terrains:', error);
  }
}

async function selectTerrain(urlOrType) {
  try {
    console.log(`Selecting terrain: ${urlOrType}`);
    let terrainProvider;

    if (urlOrType === 'flat') {
      terrainProvider = new Cesium.EllipsoidTerrainProvider();
      console.log('Flat terrain selected.');
    } else {
      // Determinar el tipo de terreno basado en la URL
      let terrainType = 'local'; // Por defecto
      if (urlOrType.includes('cesium.com')) {
        terrainType = 'ion';
      }

      if (terrainType === 'ion') {
        const match = urlOrType.match(/\/(\d+)\//);
        if (!match || !match[1]) throw new Error("Unable to extract assetId.");
        const assetId = parseInt(match[1], 10);
        terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(assetId);
        console.log(`Cesium Ion terrain selected with asset ID: ${assetId}`);
      } else {
        terrainProvider = new Cesium.CesiumTerrainProvider({ url: urlOrType });
        console.log(`Local terrain selected with URL: ${urlOrType}`);
      }
    }

    // Update terrain provider
    cesiumViewer.terrainProvider = terrainProvider;
    cesiumViewer.scene.globe.show = true;

    // Save selected terrain
    await saveSelectedTerrain(urlOrType);
    console.log(`Selected terrain "${urlOrType}" saved successfully.`);

    // Update UI
    const terrainInputs = document.querySelectorAll("input[name='terrainType']");
    terrainInputs.forEach((input) => {
      input.checked = input.value === urlOrType;
    });


  } catch (error) {
    console.error('Error selecting terrain:', error.message || error);
    alert('Error selecting terrain: ' + error.message);
  }
}

async function saveSelectedTerrain(url) {
  try {
    const response = await fetch('/3d/api/update-terrain-visibility', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to update terrain visibility');
    }

    const result = await response.json();
    if (result.message) {
      console.log('Selected terrain saved successfully.');
    } else {
      console.error('Error saving the selected terrain:', result.error);
    }
  } catch (error) {
    console.error('Error saving the selected terrain:', error.message || error);
    alert('Error saving the selected terrain: ' + error.message);
  }
}

async function saveIonToken(token) {
  await fetch('/3d/api/save-ion-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

