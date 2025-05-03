const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const axios = require('axios');
const { DOMParser } = require('xmldom'); // Usar xmldom para analizar XML
//const { Blob } = require('buffer'); // Asegúrate de usar Blob para manejar archivos binarios si es necesario


// Define la ruta global para la configuración de JSONs
const configDir = path.join(__dirname, '..', 'data', '3d-jsons/');
const mapsDir = path.join(configDir, 'maps'); // Ruta a la carpeta 'maps'
const gltfDir = path.join(__dirname, '..', 'data', 'uploaded', '3d');


// Ruta al archivo donde guardaremos las URLs WMS
const wmsUrlsFilePath = path.join(__dirname, '..', 'data', '3d-jsons', 'wms-urls.json');
const modelsFilePath = path.join(configDir, '3d-modells.json'); 


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

    // 3) Leer el archivo
    let data;
    try {
      data = await fs.promises.readFile(filePath, 'utf8');
    } catch (readError) {
      console.error('Error leyendo el archivo de configuración:', readError);
      return res.status(500).json({ error: 'Error leyendo el archivo de configuración' });
    }

    // 4) Parsear el JSON
    let configData;
    try {
      configData = JSON.parse(data);
    } catch (parseError) {
      console.error('Error parseando el JSON:', parseError);
      return res.status(500).json({ error: 'Error parseando el JSON' });
    }

    // 5) Validar estructura mínima
    if (!configData.config || !Array.isArray(configData.config.layers)) {
      return res.status(400).json({
        error: 'Formato de configuración inválido: falta config o config.layers'
      });
    }

    // 6) Encontrar la capa por 'name'
    const layer = configData.config.layers.find(layer => layer.name === name);
    if (!layer) {
      return res.status(404).json({ error: `Layer "${name}" not found in the config.` });
    }

    // 7) Convertir 'visible' a boolean si viene en string
    //    Este patrón es útil si tu frontend envía "true"/"false" como string.
    const parsedVisible = (visible === 'true' || visible === true);

    // 8) Actualizar la visibilidad en la capa
    layer.visible = parsedVisible;

    console.log('Guardando configData:', JSON.stringify(configData, null, 2));

    // 9) Guardar de nuevo el archivo
    try {
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(configData, null, 2),
        { encoding: 'utf8', flag: 'w' }
      );
    } catch (writeError) {
      console.error('Error writing the configuration file:', writeError);
      return res.status(500).json({ error: 'Error writing the configuration file' });
    }

    // 10) Responder con éxito
    return res.status(200).json({ message: 'Layer visibility updated successfully' });
  } catch (error) {
    console.error('Unexpected error updating layer visibility:', error);
    return res.status(500).json({ error: 'Unexpected error updating layer visibility.' });
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
    const data = await fs.promises.readFile(filePath, 'utf8');
    const config = JSON.parse(data);

    // Inicializar la lista de terrenos si no existe
    config.config.terrains = config.config.terrains || [];

    // Marcar todos los terrenos como no visibles excepto el seleccionado
    config.config.terrains.forEach(terrain => {
      terrain.visible = terrain.url === url;
    });

    // Guardar la configuración actualizada
    await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');

    res.json({ message: 'Selected terrain saved successfully.' });
  } catch (error) {
    console.error('Error updating terrain visibility:', error);
    res.status(500).json({ error: 'Error updating terrain visibility' });
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
    let data = await fs.promises.readFile(filePath, 'utf8');
    let config = JSON.parse(data);

    // Validamos que exista la sección .layers y .terrains
    config.config.layers = config.config.layers || [];
    config.config.terrains = config.config.terrains || [];

    // Lógica para capa
    if (type === 'layer') {
      if (!key) {
        console.log('Error: Layer key is missing');
        return res.status(400).json({ error: 'Layer key is missing' });
      }

      const layersBefore = config.config.layers.length;
      console.log(`Number of layers before deletion: ${layersBefore}`);

      // Filtrar capas que NO coincidan con el key a eliminar
      config.config.layers = config.config.layers.filter(
        layer => layer.key && layer.key.toString() !== key.toString()
      );

      const layersAfter = config.config.layers.length;
      console.log(`Number of layers after deletion: ${layersAfter}`);

      if (layersBefore === layersAfter) {
        console.log('Error: Layer not found');
        return res.status(404).json({ error: 'Layer not found' });
      }

      // Guardar cambios
      await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
      console.log('Layer deleted successfully');
      return res.status(200).json({ message: 'Item deleted successfully' });
    }

    // Lógica para terreno
    if (type === 'terrain') {
      if (!name) {
        console.log('Error: Terrain name is missing');
        return res.status(400).json({ error: 'Terrain name is missing' });
      }

      const terrainsBefore = config.config.terrains.length;
      console.log(`Number of terrains before deletion: ${terrainsBefore}`);

      // Filtrar terrenos que NO coincidan con el nombre a eliminar
      config.config.terrains = config.config.terrains.filter(
        terrain => terrain.name !== name
      );

      const terrainsAfter = config.config.terrains.length;
      console.log(`Number of terrains after deletion: ${terrainsAfter}`);

      if (terrainsBefore === terrainsAfter) {
        console.log('Error: Terrain not found');
        return res.status(404).json({ error: 'Terrain not found' });
      }

      // Guardar cambios
      await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
      console.log('Terrain deleted successfully');
      return res.status(200).json({ message: 'Item deleted successfully' });
    }

    // Si no es ni "layer" ni "terrain"
    return res.status(400).json({ error: 'Unknown item type' });

  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Error deleting item' });
  }
});



router.post('/api/save-layer', async (req, res) => {
  try {
    const newLayer = req.body; // un objeto con { name, type, url, ... }
    const filePath = path.join(__dirname, '..', 'data', '3d-jsons', 'default.json');

    // 1) Leer config
    const data = await fs.promises.readFile(filePath, 'utf8');
    const config = JSON.parse(data);

    // 2) Asignar una key única
    newLayer.key = Date.now();

    // 3) Agregarla a la lista de capas
    config.config.layers.push(newLayer);

    // 4) Guardar en disco
    await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');

    // 5) Responder
    res.json({ message: 'Layer added successfully', layerId: newLayer.key });
  } catch (error) {
    console.error('Error saving layer:', error);
    res.status(500).json({ message: 'Error saving layer' });
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

  console.log('Datos recibidos para guardar:', { name, geojson });

  fs.readFile(modelsFilePath, 'utf8', (err, existingData) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      return res.status(500).json({ success: false, message: 'Error al leer el archivo.' });
    }

    try {
      const jsonData = JSON.parse(existingData);

      if (!jsonData.drawings) {
        jsonData.drawings = {};
      }

      jsonData.drawings[name] = geojson;

      fs.writeFile(modelsFilePath, JSON.stringify(jsonData, null, 2), 'utf8', (err) => {
        if (err) {
          console.error('Error al guardar el dibujo:', err);
          return res.status(500).json({ success: false, message: 'Error al guardar el dibujo.' });
        }
        res.json({ success: true, message: 'Dibujo guardado exitosamente.' });
      });
    } catch (parseError) {
      console.error('Error al parsear JSON:', parseError);
      res.status(500).json({ success: false, message: 'Error al parsear JSON.' });
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
                      return res.status(404).json({ message: 'Dibujo no encontrado.' });
                  }
              } else {
                  // Si no se proporciona un nombre, devolver la lista de nombres
                  const drawingNames = jsonData.drawings ? Object.keys(jsonData.drawings) : [];
                  return res.json({ drawings: drawingNames });
              }
          } catch (parseError) {
              console.error('Error al parsear JSON:', parseError);
              return res.status(500).json({ success: false, message: 'Error al parsear el archivo de dibujos JSON.' });
          }
      });
  } catch (error) {
      console.error('Error en la ruta /load-drawings:', error);
      res.status(500).json({ message: 'Error al cargar la lista de dibujos.' });
  }
});

router.delete('/api/delete-drawing', (req, res) => {
    const drawingName = req.query.name;
  
    if (!drawingName) {
      return res.status(400).json({ success: false, message: 'Nombre del dibujo no proporcionado.' });
    }
  
    fs.readFile(modelsFilePath, 'utf8', (err, existingData) => {
      if (err) {
        console.error('Error al leer el archivo:', err);
        return res.status(500).json({ success: false, message: 'Error al leer el archivo.' });
      }
  
      try {
        const jsonData = JSON.parse(existingData);
  
        if (jsonData.drawings && jsonData.drawings.hasOwnProperty(drawingName)) {
          delete jsonData.drawings[drawingName];
  
          fs.writeFile(modelsFilePath, JSON.stringify(jsonData, null, 2), 'utf8', (err) => {
            if (err) {
              console.error('Error al guardar el archivo después de eliminar:', err);
              return res.status(500).json({ success: false, message: 'Error al guardar el archivo.' });
            }
            res.json({ success: true, message: `Dibujo "${drawingName}" eliminado exitosamente.` });
          });
        } else {
          return res.status(404).json({ success: false, message: `Dibujo "${drawingName}" no encontrado.` });
        }
      } catch (parseError) {
        console.error('Error al parsear JSON:', parseError);
        res.status(500).json({ success: false, message: 'Error al parsear JSON.' });
      }
    });
  });
module.exports = router;

