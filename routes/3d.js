const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const axios = require('axios');
const { DOMParser } = require('@xmldom/xmldom'); // Usar xmldom para analizar XML
//const { Blob } = require('buffer'); // Asegúrate de usar Blob para manejar archivos binarios si es necesario


// Define la ruta global para la configuración de JSONs
const configDir = path.join(__dirname, '..', 'data', '3d-jsons/');
const mapsDir = path.join(configDir, 'maps'); // Ruta a la carpeta 'maps'
const gltfDir = path.join(__dirname, '..', 'data', 'uploaded', '3d');


// Ruta al archivo donde guardaremos las URLs WMS
const wmsUrlsFilePath = path.join(__dirname, '..', 'data', '3d-jsons', 'wms-urls.json');
const modelsFilePath = path.join(configDir, '3d-modells.json'); 
const configMutationQueues = new Map();


class ConfigMutationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function mutateConfig(filePath, mutator) {
  const previousMutation = configMutationQueues.get(filePath) || Promise.resolve();
  const mutation = previousMutation.catch(() => undefined).then(async () => {
    const data = await fs.promises.readFile(filePath, 'utf8');
    const config = JSON.parse(data);
    const result = await mutator(config);
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

    try {
      await fs.promises.writeFile(temporaryPath, JSON.stringify(config, null, 2), 'utf8');
      await fs.promises.rename(temporaryPath, filePath);
    } finally {
      await fs.promises.rm(temporaryPath, { force: true });
    }
    return result;
  });

  configMutationQueues.set(filePath, mutation);
  mutation.finally(() => {
    if (configMutationQueues.get(filePath) === mutation) {
      configMutationQueues.delete(filePath);
    }
  }).catch(() => undefined);
  return mutation;
}


function parseHttpUrl(value) {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS service URLs are supported.');
  }
  return parsed;
}

function directChildText(node, localName) {
  if (!node) {
    return '';
  }
  const child = Array.from(node.childNodes || []).find(item => item.nodeType === 1 && item.localName === localName);
  return child ? child.textContent.trim() : '';
}

function descendantTexts(node, localName) {
  return Array.from(node.getElementsByTagNameNS('*', localName))
    .map(item => item.textContent.trim())
    .filter(Boolean);
}

function inheritedWmsCrs(layer) {
  const values = new Set();
  let current = layer;
  while (current?.nodeType === 1 && current.localName === 'Layer') {
    for (const child of Array.from(current.childNodes || [])) {
      if (child.nodeType === 1 && ['CRS', 'SRS'].includes(child.localName)) {
        const value = child.textContent.trim();
        if (value) values.add(value);
      }
    }
    current = current.parentNode;
  }
  return [...values];
}

function serviceUrl(value) {
  const parsed = parseHttpUrl(value);
  const serviceParameters = new Set(['service', 'request', 'version', 'layer', 'layers']);
  for (const name of [...parsed.searchParams.keys()]) {
    if (serviceParameters.has(name.toLowerCase())) {
      parsed.searchParams.delete(name);
    }
  }
  return parsed.toString();
}

async function fetchCapabilities(type, value) {
  const url = parseHttpUrl(value);
  for (const name of [...url.searchParams.keys()]) {
    if (['service', 'request', 'version'].includes(name.toLowerCase())) {
      url.searchParams.delete(name);
    }
  }
  url.searchParams.set('SERVICE', type.toUpperCase());
  url.searchParams.set('REQUEST', 'GetCapabilities');

  const response = await axios.get(url.toString(), {
    timeout: 15000,
    responseType: 'text',
    headers: { Accept: 'application/xml,text/xml,*/*' }
  });
  const xmlDoc = new DOMParser().parseFromString(response.data, 'text/xml');
  const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('The service returned invalid XML capabilities.');
  }

  if (type === 'wms') {
    const root = xmlDoc.documentElement;
    const formats = descendantTexts(xmlDoc, 'GetMap').length
      ? descendantTexts(xmlDoc.getElementsByTagNameNS('*', 'GetMap')[0], 'Format')
      : ['image/png'];
    const layers = Array.from(xmlDoc.getElementsByTagNameNS('*', 'Layer'))
      .map(layer => ({
        name: directChildText(layer, 'Name'),
        title: directChildText(layer, 'Title'),
        crs: inheritedWmsCrs(layer)
      }))
      .filter(layer => layer.name);
    return { type, serviceUrl: serviceUrl(value), version: root.getAttribute('version') || '1.3.0', formats, layers };
  }

  const matrixSets = Object.fromEntries(
    Array.from(xmlDoc.getElementsByTagNameNS('*', 'TileMatrixSet')).map(matrixSet => {
      const identifier = directChildText(matrixSet, 'Identifier');
      const tileMatrices = Array.from(matrixSet.childNodes || [])
        .filter(item => item.nodeType === 1 && item.localName === 'TileMatrix');
      if (!identifier || tileMatrices.length === 0) {
        return null;
      }
      const supportedCrs = directChildText(matrixSet, 'SupportedCRS');
      const crsDescription = `${identifier} ${supportedCrs}`;
      let tilingScheme = null;
      if (/3857|900913|GoogleMapsCompatible/i.test(crsDescription)) {
        tilingScheme = 'webMercator';
      } else if (/4326|CRS84|WorldCRS84Quad/i.test(crsDescription)) {
        tilingScheme = 'geographic';
      }
      const firstMatrix = tileMatrices[0];
      return [identifier, {
        identifier,
        supportedCrs,
        tilingScheme,
        tileMatrixLabels: tileMatrices.map(tileMatrix => directChildText(tileMatrix, 'Identifier')),
        levelZeroTilesX: Number.parseInt(directChildText(firstMatrix, 'MatrixWidth'), 10) || undefined,
        levelZeroTilesY: Number.parseInt(directChildText(firstMatrix, 'MatrixHeight'), 10) || undefined,
        maximumLevel: Math.max(0, tileMatrices.length - 1)
      }];
    }).filter(Boolean)
  );
  const layers = Array.from(xmlDoc.getElementsByTagNameNS('*', 'Layer')).map(layer => {
    const styleNode = Array.from(layer.getElementsByTagNameNS('*', 'Style'))
      .find(style => style.getAttribute('isDefault') === 'true') || layer.getElementsByTagNameNS('*', 'Style')[0];
    const matrixSetIds = Array.from(layer.getElementsByTagNameNS('*', 'TileMatrixSetLink'))
      .map(link => directChildText(link, 'TileMatrixSet'))
      .filter(Boolean);
    return {
      name: directChildText(layer, 'Identifier'),
      title: directChildText(layer, 'Title'),
      formats: descendantTexts(layer, 'Format'),
      style: styleNode ? directChildText(styleNode, 'Identifier') : 'default',
      matrixSets: matrixSetIds.map(identifier => matrixSets[identifier]).filter(Boolean)
    };
  }).filter(layer => layer.name);
  return { type, serviceUrl: serviceUrl(value), version: '1.0.0', layers };
}


// Middleware para verificar autenticación
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    res.redirect('/login');
  }
}

router.use(isAuthenticated);

// Cargar URLs WMS guardadas
router.get('/api/load-wms-urls', (req, res) => {
  if (fs.existsSync(wmsUrlsFilePath)) {
    const data = fs.readFileSync(wmsUrlsFilePath, 'utf8');
    res.json(JSON.parse(data));
  } else {
    res.json([]);  // Devuelve una lista vacía si no existen URLs guardadas
  }
});

// Guardar una nueva URL WMS
router.post('/api/save-wms-url', (req, res) => {
  const { url } = req.body;
  let wmsUrls = [];

  if (fs.existsSync(wmsUrlsFilePath)) {
    const data = fs.readFileSync(wmsUrlsFilePath, 'utf8');
    wmsUrls = JSON.parse(data);
  }

  if (!wmsUrls.includes(url)) {
    wmsUrls.push(url);  // Agrega la URL solo si no existe previamente
    fs.writeFileSync(wmsUrlsFilePath, JSON.stringify(wmsUrls, null, 2), 'utf8');
  }

  res.json({ message: 'WMS URL saved successfully' });
});


router.get('/api/3dtiles-folders', (req, res) => {
  const tilesDir = path.join(__dirname, '..', 'data', 'uploaded', '3d', '3dtiles');

  fs.readdir(tilesDir, (err, folders) => {
    if (err) {
      console.error('Error reading 3D Tiles folders:', err);
      return res.status(500).json({ error: 'Error reading 3D Tiles folders' });
    }

    // Filtrar solo las carpetas que *tengan* un tileset.json 
    // o al menos que sean subdirectorios válidos.
    const validFolders = folders.filter(folder => {
      const tilesetPath = path.join(tilesDir, folder, 'tileset.json');
      return fs.existsSync(tilesetPath);
    });

    // Respondemos con un objeto que tenga `folders: ...`
    res.json({ folders: validFolders });
  });
});

router.get('/api/3dtiles-files', (req, res) => {
  const folderName = req.query.folder;  // El nombre de la carpeta seleccionada
  if (!folderName) {
    return res.status(400).send('Folder name is required');
  }

  const tilesDir = path.join(__dirname, '..', 'data', 'uploaded', '3d', '3dtiles');
  const tilesetPath = path.join(tilesDir, folderName, 'tileset.json');

  fs.access(tilesetPath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('tileset.json not found');
    }

    // Devolvemos la ruta pública donde se servirá `tileset.json` 
    // (asumiendo que /Tiles/ es un static que apunta a data/uploaded/3d/3dtiles)
    res.json({ 
      tileset: `/Tiles/${folderName}/tileset.json` 
    });
  });
});



router.post('/api/update-layer-visibility', async (req, res) => {
  try {
    const { name, visible, config } = req.body;

    // 1) Validar que vengan 'name' y 'visible'
    if (!name || typeof visible === 'undefined') {
      return res.status(400).json({ error: 'Faltan campos: "name" y/o "visible".' });
    }

    // 2) Normalizar configName
    const configName = config || 'default';
    const filePath = path.join(configDir, `${configName}.json`);
    await mutateConfig(filePath, configData => {
      if (!configData.config || !Array.isArray(configData.config.layers)) {
        throw new ConfigMutationError('Invalid configuration: config.layers is missing.');
      }
      const layer = configData.config.layers.find(item => item.name === name);
      if (!layer) {
        throw new ConfigMutationError(`Layer "${name}" not found in the config.`, 404);
      }
      layer.visible = visible === 'true' || visible === true;
    });
    return res.status(200).json({ message: 'Layer visibility updated successfully' });
  } catch (error) {
    console.error('Unexpected error updating layer visibility:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Unexpected error updating layer visibility.' });
  }
});



// Ruta para guardar un terreno (Ion o Local)
router.post('/api/save-terrain', async (req, res) => {
  const { name, type, url, id } = req.body;

  // Validar campos requeridos
  if (!name || !type) {
    return res.status(400).json({ error: 'Required fields missing: name and type' });
  }

  try {
    // Ajusta a tu ruta real de default.json dentro de data/3d-jsons:
    const filePath = path.join(configDir, 'default.json');
    //const filePath = path.join(__dirname, '..', 'data', '3d-jsons', 'default.json');
    const data = await fs.promises.readFile(filePath, 'utf8');
    const config = JSON.parse(data);

    // Nos aseguramos de que exista config.config.terrains (o config.terrains si así lo usas)
    config.config.terrains = config.config.terrains || [];

    let terrainUrl;

    if (type === 'ion') {
      // Terreno desde Cesium Ion
      if (!id) {
        return res.status(400).json({ error: 'Missing asset ID for Cesium Ion terrain.' });
      }
      terrainUrl = `https://assets.cesium.com/${id}/tileset.json`;
    } else if (type === 'local') {
      // Terreno local
      if (!url) {
        return res.status(400).json({ error: 'Missing URL for local terrain.' });
      }
      terrainUrl = url;
    } else {
      return res.status(400).json({ error: 'Invalid terrain type, only ion or local is supported.' });
    }

    // Verificar si ya existe un terreno con el mismo nombre
    const existingTerrain = config.config.terrains.find(t => t.name === name);
    if (existingTerrain) {
      return res.status(400).json({ error: 'A terrain with this name already exists.' });
    }

    // Agregamos el nuevo terreno
    const newTerrain = {
      key: Date.now().toString(),  // opcional, si quieres un ID único
      name,
      url: terrainUrl,
      type,       // "ion" o "local"
      visible: true
    };
    config.config.terrains.push(newTerrain);

    // Guardar la configuración actualizada
    await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');

    // Respuesta de éxito
    res.json({
      message: 'Terrain saved successfully.',
      terrain: newTerrain
    });
  } catch (error) {
    console.error('Error saving the terrain:', error);
    res.status(500).json({ error: 'Error saving the terrain.' });
  }
});


// Ruta para listar todos los terrenos subidos
router.get('/api/terrain-files', (req, res) => {
  const terrainDirectory = path.join(__dirname, '..', 'data', 'uploaded', '3d', 'terrain');
  fs.readdir(terrainDirectory, (err, folders) => {
    if (err) {
      console.error('Error loading terrain files:', err);
      return res.status(500).json({ error: 'Error loading terrain files' });
    }

    // AHORA: solo filtras subcarpetas (sin chequear si hay terrain.json)
    const terrains = folders
      .filter(folder => {
        const folderPath = path.join(terrainDirectory, folder);
        // Nos basta con que sea una carpeta
        return fs.statSync(folderPath).isDirectory();
      })
      .map(folder => ({
        name: folder,
        // Por ejemplo, /terrain/<carpeta>:
        url: `/terrain/${folder}/`
      }));

    res.json(terrains);
  });
});


router.get('/api/terrains', (req, res) => {
  const filePath = path.join(configDir, 'default.json');
  const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  res.json(config.terrains || []);
});


// Renderizar mapa de Cesium
router.get('/cesium-map', isAuthenticated, async (req, res) => {
  const filePath = path.join(configDir, 'default.json');
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    const layers = JSON.parse(data);
    res.render('cesium', { layers, isAuthenticated: true, userRole: req.session.user.role });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading layers.");
  }
});


// Obtener archivos GLTF
router.get('/api/gltf-files', (req, res) => {
  fs.readdir(gltfDir, (err, files) => {
    if (err) {
      console.error('Error scanning directory:', gltfDir, err); // Mejor log de error
      return res.status(500).send('Unable to scan directory: ' + err);
    }

    // Filtra para incluir ambas extensiones
    const modelFiles = files.filter(file => file.endsWith('.gltf') || file.endsWith('.glb'));

    // Devuelve la lista combinada
    res.json({ files3D: modelFiles.map(file => ({ name: file })) });
  });
});

router.get('/api/glb-files', (req, res) => {
  fs.readdir(gltfDir, (err, files) => {
    if (err) {
      return res.status(500).send('Unable to scan directory: ' + err);
    }
    const glbFiles = files.filter(file => file.endsWith('.glb'));
    res.json({ files3D: glbFiles.map(file => ({ name: file })) });
  });
});


// Middleware para deshabilitar el caché
function disableCache(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
}

// Aplicar el middleware a las rutas que obtienen capas
router.get('/api/layers', disableCache, (req, res) => {
  const configName = req.query.config || 'default';
  const filePath = path.join(configDir, `${configName}.json`);

  console.log(`Loading layers from configuration: ${configName}`);

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading layer configuration:', err);
      return res.status(500).json({ error: 'Error reading layer configuration' });
    }

    try {
      const layers = JSON.parse(data);
      console.log(`Loaded layers from config:`, layers.config.layers);
      res.json(layers);
    } catch (parseError) {
      console.error('Error parsing layer configuration:', parseError);
      res.status(500).json({ error: 'Error parsing layer configuration' });
    }
  });
});



// Añadir una nueva capa a una configuración específica
router.post('/api/layers', async (req, res) => {
  const newLayer = req.body;  // Los datos de la nueva capa vienen en el cuerpo de la solicitud
  const configName = req.query.config || 'default'; // Usar 'default.json' si no se proporciona un nombre en la query
  const filePath = path.join(configDir, `${configName}.json`); // Ruta al archivo default.json

  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    const config = JSON.parse(data);

    newLayer.key = Date.now(); // Asigna una clave única para la capa
    config.config.layers.push(newLayer); // Añadir la nueva capa a la lista de capas

    await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
    
    res.json({ message: 'Layer added successfully', layerId: newLayer.key });
  } catch (error) {
    console.error('Error adding layer:', error);
    res.status(500).json({ error: 'Error processing the request' });
  }
});




router.get('/api/load-ion-token', async (req, res) => {
  const configName = 'default';
  const filePath = path.join(configDir, `${configName}.json`);

  try {
    let data = await fs.promises.readFile(filePath, 'utf8');
    let config = JSON.parse(data);

    const token = config.cesiumToken; // Ajuste realizado aquí

    if (!token) {
      return res.json({ token: null });
    }

    res.json({ token });
  } catch (error) {
    console.error('Error loading Cesium Ion token:', error.message);
    res.status(500).json({ error: 'Error loading Cesium Ion token' });
  }
});

router.post('/api/save-ion-token', async (req, res) => {
  const { token } = req.body;
  const configName = 'default';
  const filePath = path.join(configDir, `${configName}.json`);

  try {
    let data = await fs.promises.readFile(filePath, 'utf8');
    let config = JSON.parse(data);

    config.cesiumToken = token; // Ajuste realizado aquí

    await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
    res.json({ message: 'Token saved successfully' });
  } catch (error) {
    console.error('Error saving Cesium Ion token:', error.message);
    res.status(500).json({ error: 'Error saving Cesium Ion token' });
  }
});

// Ruta para obtener los activos de Cesium Ion mediante un proxy
router.get('/api/proxy-ion-assets', async (req, res) => {
  const configName = 'default';
  const filePath = path.join(configDir, `${configName}.json`);

  try {
    // Leer el archivo default.json para obtener el token
    let data = await fs.promises.readFile(filePath, 'utf8');
    let config = JSON.parse(data);

    const token = config.cesiumToken; // Asegúrate de que el token esté en la raíz de config

    if (!token) {
      return res.status(400).json({ error: 'Cesium Ion token not found' });
    }

    // Hacer la solicitud a la API de Cesium Ion usando axios
    const response = await axios.get('https://api.cesium.com/v1/assets', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Enviar la respuesta de vuelta al cliente
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching Cesium Ion assets:', error.message);
    res.status(500).json({ error: 'Error fetching Cesium Ion assets' });
  }
});

router.post('/api/update-terrain-visibility', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Missing terrain URL' });
  }

  try {
    const filePath = path.join(configDir, 'default.json');
    await mutateConfig(filePath, config => {
      config.config.terrains = config.config.terrains || [];
      config.config.terrains.forEach(terrain => {
        terrain.visible = terrain.url === url;
      });
    });
    res.json({ message: 'Selected terrain saved successfully.' });
  } catch (error) {
    console.error('Error updating terrain visibility:', error);
    res.status(error.status || 500).json({ error: error.message || 'Error updating terrain visibility' });
  }
});




// Obtener archivos CZML
router.get('/api/czml-files', (req, res) => {
  fs.readdir(gltfDir, (err, files) => {
    if (err) {
      return res.status(500).send('Unable to scan directory: ' + err);
    }
    const czmlFiles = files.filter(file => file.endsWith('.czml'));
    res.json({ files3D: czmlFiles.map(file => ({ name: file })) });
  });
});



// Añadir una capa WMS
router.post('/api/wms_layers', async (req, res) => {
  const { name, url, type, layers } = req.body;
  const configName = req.query.config || 'default';
  const filePath = path.join(configDir, `${configName}.json`);

  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    const config = JSON.parse(data);

    const newLayer = {
      key: Date.now().toString(),
      name,
      type,
      url,
      layers
    };

    config.config.layers.push(newLayer);
    await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
    res.status(200).json({ message: 'WMS layer added successfully', layerId: newLayer.key });
  } catch (error) {
    console.error('Error saving WMS layer:', error);
    res.status(500).json({ error: 'Error processing the request' });
  }
});

router.post('/api/delete-item', async (req, res) => {
  const { type, name, key } = req.body;
  console.log(`Delete request received for type: ${type}, name: ${name}, key: ${key}`);

  // Determinamos archivo de configuración
  const configName = req.query.config || 'default'; 
  const filePath = path.join(configDir, `${configName}.json`);

  try {
    if (type === 'layer') {
      if (!key) {
        console.log('Error: Layer key is missing');
        return res.status(400).json({ error: 'Layer key is missing' });
      }
      await mutateConfig(filePath, config => {
        config.config.layers = config.config.layers || [];
        const layersBefore = config.config.layers.length;
        config.config.layers = config.config.layers.filter(
          layer => layer.key && layer.key.toString() !== key.toString()
        );
        if (layersBefore === config.config.layers.length) {
          throw new ConfigMutationError('Layer not found', 404);
        }
      });
      console.log('Layer deleted successfully');
      return res.status(200).json({ message: 'Item deleted successfully' });
    }

    if (type === 'terrain') {
      if (!name) {
        console.log('Error: Terrain name is missing');
        return res.status(400).json({ error: 'Terrain name is missing' });
      }
      await mutateConfig(filePath, config => {
        config.config.terrains = config.config.terrains || [];
        const terrainsBefore = config.config.terrains.length;
        config.config.terrains = config.config.terrains.filter(terrain => terrain.name !== name);
        if (terrainsBefore === config.config.terrains.length) {
          throw new ConfigMutationError('Terrain not found', 404);
        }
      });
      console.log('Terrain deleted successfully');
      return res.status(200).json({ message: 'Item deleted successfully' });
    }

    // Si no es ni "layer" ni "terrain"
    return res.status(400).json({ error: 'Unknown item type' });

  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(error.status || 500).json({ error: error.message || 'Error deleting item' });
  }
});



router.post('/api/save-layer', async (req, res) => {
  try {
    const newLayer = req.body; // un objeto con { name, type, url, ... }
    const filePath = path.join(__dirname, '..', 'data', '3d-jsons', 'default.json');
    newLayer.key = Date.now();
    await mutateConfig(filePath, config => {
      config.config.layers = config.config.layers || [];
      config.config.layers.push(newLayer);
    });
    res.json({ message: 'Layer added successfully', layerId: newLayer.key });
  } catch (error) {
    console.error('Error saving layer:', error);
    res.status(error.status || 500).json({ message: error.message || 'Error saving layer' });
  }
});


router.get('/api/loadWmsLayers', async (req, res) => {
  const wmsUrl = req.query.url;
  if (!wmsUrl) {
    return res.status(400).json({ error: 'No WMS URL provided' });
  }

  try {
    const response = await axios.get(`${wmsUrl}?service=WMS&version=1.1.1&request=GetCapabilities`);
    if (response.status !== 200) {
      throw new Error('Failed to fetch WMS layers');
    }

    const xmlDoc = new DOMParser().parseFromString(response.data, 'text/xml');
    const layers = Array.from(xmlDoc.getElementsByTagName('Name')).map(layer => ({
      name: layer.textContent
    }));

    res.json(layers);
  } catch (error) {
    console.error('Error loading WMS layers:', error.message);
    res.status(500).json({ error: 'Error loading WMS layers' });
  }
});

router.get('/api/imagery-capabilities', async (req, res) => {
  const type = String(req.query.type || '').toLowerCase();
  const url = req.query.url;
  if (!['wms', 'wmts'].includes(type) || !url) {
    return res.status(400).json({ error: 'A valid WMS/WMTS type and URL are required.' });
  }

  try {
    res.json(await fetchCapabilities(type, url));
  } catch (error) {
    console.error(`Error loading ${type.toUpperCase()} capabilities:`, error.message);
    res.status(502).json({ error: error.message || `Could not read ${type.toUpperCase()} capabilities.` });
  }
});

router.get('/api/imagery-proxy', async (req, res) => {
  try {
    const target = parseHttpUrl(req.query.url);
    for (const [name, value] of Object.entries(req.query)) {
      if (name !== 'url' && typeof value === 'string') {
        for (const existingName of [...target.searchParams.keys()]) {
          if (existingName.toLowerCase() === name.toLowerCase()) {
            target.searchParams.delete(existingName);
          }
        }
        target.searchParams.set(name, value);
      }
    }

    const isWms13 = target.searchParams.get('service')?.toUpperCase() === 'WMS'
      && Number.parseFloat(target.searchParams.get('version')) >= 1.3;
    const usesEpsg4326 = target.searchParams.get('crs')?.toUpperCase() === 'EPSG:4326';
    const bbox = target.searchParams.get('bbox')?.split(',').map(Number);
    if (isWms13 && usesEpsg4326 && bbox?.length === 4 && bbox.every(Number.isFinite)) {
      target.searchParams.set('bbox', [bbox[1], bbox[0], bbox[3], bbox[2]].join(','));
    }

    const response = await axios.get(target.toString(), {
      timeout: 30000,
      responseType: 'arraybuffer',
      validateStatus: status => status >= 200 && status < 300
    });
    res.set('Content-Type', response.headers['content-type'] || 'image/png');
    res.set('Cache-Control', response.headers['cache-control'] || 'public, max-age=3600');
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Imagery proxy error:', error.message);
    res.status(error.response?.status || 502).json({ error: 'Could not retrieve the remote map image.' });
  }
});

// Guardar mensajes
router.post('/api/save-message', (req, res) => {
  const { position, message, icon } = req.body;
  const filePath = path.join(__dirname, '..', 'data', '3d-jsons', 'messages.json');

  fs.readFile(filePath, (err, data) => {
    if (err) throw err;
    const messages = JSON.parse(data);
    messages.push({ position, message, icon });
    fs.writeFile(filePath, JSON.stringify(messages, null, 2), (err) => {
      if (err) throw err;
      res.sendStatus(200);
    });
  });
});



router.post('/api/delete-message', (req, res) => {
  const { longitude, latitude } = req.body;
  const filePath = path.join(__dirname, '..', 'data', '3d-jsons', 'messages.json');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading messages file:', err);
      return res.status(500).json({ error: 'Error reading messages file' });
    }

    let messages = JSON.parse(data);
    messages = messages.filter(msg => msg.position.longitude !== longitude || msg.position.latitude !== latitude);

    fs.writeFile(filePath, JSON.stringify(messages, null, 2), 'utf8', (err) => {
      if (err) {
        console.error('Error writing messages file:', err);
        return res.status(500).json({ error: 'Error saving messages file' });
      }
      res.status(200).json({ message: 'Message deleted successfully' });
    });
  });
});


// Obtener mensajes
router.get('/api/messages', (req, res) => {
  const filePath = path.join(__dirname, '..', 'data', '3d-jsons', 'messages.json');
  fs.readFile(filePath, (err, data) => {
    if (err) throw err;
    res.json(JSON.parse(data));
  });
});


// Nueva ruta para cargar solo el token de Cesium desde default.json
router.get('/api/load-cesium-token', (req, res) => {
  const filePath = path.join(configDir, 'default.json');
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading config file:', err);
      return res.status(500).json({ error: 'Error reading config file' });
    }
    
    try {
      const config = JSON.parse(data);
      res.json({ cesiumToken: config.cesiumToken });
    } catch (parseError) {
      console.error('Error parsing config file:', parseError);
      res.status(500).json({ error: 'Error parsing config file' });
    }
  });
});


//load local terrain

// Ruta para listar todos los terrenos subidos
router.get('/terrain-files', (req, res) => {
  const terrainDirectory = path.join(__dirname, '..', 'data', 'uploaded', '3d', 'terrain');
  
  fs.readdir(terrainDirectory, (err, folders) => {
    if (err) {
      console.error('Error loading terrain files:', err);
      return res.status(500).json({ error: 'Error loading terrain files' });
    }

    // Filtrar solo las carpetas que contienen un archivo terrain.json
    const terrains = folders.filter(folder => {
      const terrainPath = path.join(terrainDirectory, folder);
      return fs.statSync(terrainPath).isDirectory() && fs.existsSync(path.join(terrainPath, 'terrain.json'));
    }).map(folder => ({
      name: folder,
      url: `/terrain/${folder}/` // Asegúrate de que esta ruta sea accesible públicamente
    }));

    res.json(terrains);
  });
});



// Ruta para guardar el terreno local en default.json
router.post('/api/save-local-terrain', async (req, res) => {
  const { name, url, type } = req.body;
  const configName = 'default';
  const filePath = path.join(configDir, `${configName}.json`);

  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    const config = JSON.parse(data);

    // Añadir el terreno al archivo default.json
    const newTerrain = {
      key: Date.now().toString(),
      name,
      url,
      type,
      visible: true  // Puedes modificar esto si deseas un estado diferente
    };

    config.config.layers.push(newTerrain);

    await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
    res.json({ message: 'Terrain saved successfully' });
  } catch (error) {
    console.error('Error saving terrain:', error);
    res.status(500).json({ error: 'Error saving terrain' });
  }
});

// ... (your existing routes)

router.post('/api/save-view', async (req, res) => {
  const { name, position, orientation } = req.body; // Expecting name now
  const configName = 'default';
  const filePath = path.join(configDir, `${configName}.json`);

  try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      const config = JSON.parse(data);

      // Ensure savedViews array exists
      config.savedViews = config.savedViews || [];
      config.savedViews.push({ name, position, orientation }); // Store the name as well

      await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
      res.json({ message: 'View saved successfully' });
  } catch (error) {
      console.error('Error saving view:', error);
      res.status(500).json({ error: 'Error saving view' });
  }
});

router.get('/api/load-views', async (req, res) => {
  const configName = 'default';
  const filePath = path.join(configDir, `${configName}.json`);

  try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      const config = JSON.parse(data);
      res.json(config.savedViews || []);
  } catch (error) {
      console.error('Error loading views:', error);
      res.status(500).json({ error: 'Error loading views' });
  }
});

router.post('/api/delete-view', async (req, res) => {
  const { name } = req.body; // Expecting the name of the view to delete
  const configName = 'default';
  const filePath = path.join(configDir, `${configName}.json`);

  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    const config = JSON.parse(data);

    if (config.savedViews) {
      config.savedViews = config.savedViews.filter(view => view.name !== name);
      await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
      res.json({ message: 'View deleted successfully' });
    } else {
      res.status(404).json({ error: 'No saved views found' });
    }
  } catch (error) {
    console.error('Error deleting view:', error);
    res.status(500).json({ error: 'Error deleting view' });
  }
});

router.post('/api/set-default-view', async (req, res) => {
  const { name } = req.body;
  const configName = 'default';
  const filePath = path.join(configDir, `${configName}.json`);

  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    const config = JSON.parse(data);

    if (config.savedViews) {
      config.savedViews = config.savedViews.map(view => ({
        ...view,
        isDefault: view.name === name
      }));
      await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
      res.json({ message: `View "${name}" set as default successfully` });
    } else {
      res.status(404).json({ error: 'No saved views found' });
    }
  } catch (error) {
    console.error('Error setting default view:', error);
    res.status(500).json({ error: 'Error setting default view' });
  }
});


//save drawing

router.post('/api/save-drawing', (req, res) => {
  const { name, geojson } = req.body;

  console.log('Received data to save:', { name, geojson });

  fs.readFile(modelsFilePath, 'utf8', (err, existingData) => {
    if (err) {
      console.error('Error reading the file:', err);
      return res.status(500).json({ success: false, message: 'Error reading the file.' });
    }

    try {
      const jsonData = JSON.parse(existingData);

      if (!jsonData.drawings) {
        jsonData.drawings = {};
      }

      jsonData.drawings[name] = geojson;

      fs.writeFile(modelsFilePath, JSON.stringify(jsonData, null, 2), 'utf8', (err) => {
        if (err) {
          console.error('Error saving the drawing:', err);
          return res.status(500).json({ success: false, message: 'Error saving the drawing.' });
        }
        res.json({ success: true, message: 'Drawing saved successfully.' });
      });
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      res.status(500).json({ success: false, message: 'Error parsing JSON.' });
    }
  });
});


router.get('/api/load-drawings', async (req, res) => {
  try {
      fs.readFile(modelsFilePath, 'utf8', (err, existingData) => {
          if (err) {
              console.error('Error al leer el archivo:', err);
              return res.status(500).json({ success: false, message: 'Error al leer el archivo de dibujos.' });
          }

          try {
              const jsonData = JSON.parse(existingData);
              if (req.query.name) {
                  // Si se proporciona un nombre, buscar el dibujo específico
                  const drawingName = req.query.name;
                  if (jsonData.drawings && jsonData.drawings[drawingName]) {
                      return res.json({ geojson: jsonData.drawings[drawingName] });
                  } else {
                      return res.status(404).json({ message: 'Drawing not found.' });
                  }
              } else {
                  // Si no se proporciona un nombre, devolver la lista de nombres
                  const drawingNames = jsonData.drawings ? Object.keys(jsonData.drawings) : [];
                  return res.json({ drawings: drawingNames });
              }
          } catch (parseError) {
              console.error('Error parsing JSON:', parseError);
              return res.status(500).json({ success: false, message: 'Error parsing the JSON drawing file.' });
          }
      });
  } catch (error) {
      console.error('Error en la ruta /load-drawings:', error);
      res.status(500).json({ message: 'Error loading the drawing list.' });
  }
});

router.delete('/api/delete-drawing', (req, res) => {
  const drawingName = req.query.name;

  if (!drawingName) {
    return res.status(400).json({ success: false, message: 'Drawing name not provided.' });
  }

  fs.readFile(modelsFilePath, 'utf8', (err, existingData) => {
    if (err) {
      console.error('Error reading the file:', err);
      return res.status(500).json({ success: false, message: 'Error reading the file.' });
    }

    try {
      const jsonData = JSON.parse(existingData);

      if (jsonData.drawings && jsonData.drawings.hasOwnProperty(drawingName)) {
        delete jsonData.drawings[drawingName];

        fs.writeFile(modelsFilePath, JSON.stringify(jsonData, null, 2), 'utf8', (err) => {
          if (err) {
            console.error('Error saving the file after deletion:', err);
            return res.status(500).json({ success: false, message: 'Error saving the file.' });
          }
          res.json({ success: true, message: `Drawing "${drawingName}" deleted successfully.` });
        });
      } else {
        return res.status(404).json({ success: false, message: `Drawing "${drawingName}" not found.` });
      }
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      res.status(500).json({ success: false, message: 'Error parsing JSON.' });
    }
  });
});

module.exports = router;

