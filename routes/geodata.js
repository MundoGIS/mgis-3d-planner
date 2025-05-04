const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const fsExtra = require('fs-extra');
const extractZip = require('extract-zip'); // Para descomprimir .zip
const router = express.Router();


async function moveFileOrDirectory(source, destination) {
  try {
    await fsExtra.move(source, destination, { overwrite: true });
    console.log(`Moved ${source} a ${destination}`);
  } catch (error) {
    console.error(`Error moving ${source} a ${destination}:`, error);
    throw error;
  }
}

async function findFileRecursive(dir, fileName) {
  const files = await fs.promises.readdir(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = await fs.promises.stat(fullPath);
    if (stat.isDirectory()) {
      const result = await findFileRecursive(fullPath, fileName);
      if (result) return result;
    } else if (file.toLowerCase() === fileName.toLowerCase()) {
      return fullPath;
    }
  }
  return null;
}

async function decompressZip(inputPath, outputPath) {
  const absoluteOutput = path.resolve(outputPath);
  console.log('Unzipping ZIP in:', absoluteOutput);
  if (!path.isAbsolute(absoluteOutput)) {
    throw new Error(`The output path is not absolute: ${absoluteOutput}`);
  }
  try {
    await extractZip(inputPath, { dir: absoluteOutput });
    console.log('ZIP extraction successful:', absoluteOutput);
  } catch (err) {
    console.error('Error extracting the ZIP:', err);
    throw err;
  }
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

// Definición de rutas y paths
const assimpPath = path.join(__dirname, '..', 'public', 'Thirdparty', 'Assimp', 'bin', 'x64', 'assimp.exe');
const tilesDir = path.join(__dirname, '..', 'data', 'uploaded', '3d', '3dtiles');
const tredDir = path.join(__dirname, '..', 'data', 'uploaded', '3d');
const terrainDir = path.join(__dirname, '..', 'data', 'uploaded', '3d', 'terrain');
//const twodDir = path.join(__dirname, '..', 'data', 'uploaded', '2d');

router.use(express.json({ limit: '900mb' }));
router.use(express.urlencoded({ limit: '900mb', extended: true }));

// Configurar el tamaño máximo de archivos a 2 GB
router.use(fileUpload({
  limits: { fileSize: 2000 * 1024 * 1024 }, // 2 GB
  abortOnLimit: true,
}));

// Middleware para cargar paths desde geodata.json
router.use((req, res, next) => {
  const filePath = path.resolve(__dirname, '..', 'data', '3d-jsons', 'geodata.json');
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(filePath));
  } catch (error) {
    console.error('Error al leer el archivo geodata.json:', error);
  }
  req.paths = data;
  next();
});

// Definir formatos permitidos sin incluir .7z
const allowedFormats3D = [
  '.czml', '.kml', '.kmz', '.geojson', '.gltf', '.glb', '.zip'
];

// 3D Tiles suele incluir b3dm, i3dm, pnts
const allowedFormats3DTiles = [
  '.zip', '.b3dm', '.i3dm', '.pnts'
];

const allowedFormatsTerrain = [
  '.zip'
];

const allowedFormats2D = [
  '.jpeg', '.jpg', '.png', '.geotif', '.tiff'
];

// Función para optimizar GLTF utilizando gltf-transform
async function optimizeGltf(inputPath, outputPath) {
  console.log(`Starting optimization for file: ${inputPath}`);
  console.time('Optimization Time');

  return new Promise((resolve, reject) => {
    const command = `gltf-transform optimize ${inputPath} ${outputPath} --compress draco --texture-compress webp --no-join --no-prune --no-simplify`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error optimizing GLTF: ${stderr}`);
        return reject(error);
      }

      console.log(`Optimization output: ${stdout}`);
      console.timeEnd('Optimization Time');
      resolve();
    });
  });
}

router.post('/api/files', async (req, res) => {
  let uploadType = req.body.uploadType;

  console.log('uploadType from client:', req.body.uploadType);
  console.log('files received:', req.files);

  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ error: 'No files were uploaded.' });
  }

  // Si uploadType llega como array (por ejemplo al marcar varios checkboxes), tomamos el primero
  if (Array.isArray(uploadType)) {
    uploadType = uploadType[0];
  }

  // Verificar que req.paths tenga las rutas correctas
  if (
    !req.paths ||
    typeof req.paths !== 'object' ||
    !req.paths['3dPath'] ||
    !req.paths['3dtilesPath'] ||
    !req.paths['TerrainPath'] ||
    !req.paths['2dPath']
  ) {
    return res.status(400).json({ error: 'Invalid configuration paths.' });
  }

  // Seleccionar formatos permitidos según uploadType
  let allowedFormats;
  switch (uploadType) {
    case '3d':
      allowedFormats = allowedFormats3D;
      break;
    case 'terrain':
      allowedFormats = allowedFormatsTerrain;
      break;
    case '3Dtiles':
      allowedFormats = allowedFormats3DTiles;
      break;
    case '2d':
    default:
      allowedFormats = allowedFormats2D;
  }

  // Seleccionar carpeta de destino
  let uploadPath;
  switch (uploadType) {
    case '3d':
      uploadPath = req.paths['3dPath'];
      break;
    case 'terrain':
      uploadPath = req.paths['TerrainPath'];
      break;
    case '3Dtiles':
      uploadPath = req.paths['3dtilesPath'];
      break;
    default:
      uploadPath = req.paths['2dPath'];
  }

  // Convertir a array por si suben un solo archivo
  const files = Array.isArray(req.files.files)
    ? req.files.files
    : [req.files.files];

  const uploadedFiles = [];
  const unsupportedFiles = [];

  for (const file of files) {
    const fileExtension = path.extname(file.name).toLowerCase();
    const filePath = path.join(uploadPath, file.name);

    // 1) Revisar extensión
    if (!allowedFormats.includes(fileExtension)) {
      unsupportedFiles.push({
        name: file.name,
        error: 'File format not allowed.'
      });
      continue;
    }

    // 2) Mover archivo a la carpeta final
    try {
      await file.mv(filePath);
      console.log(`File moved to: ${filePath}`);
    } catch (err) {
      console.error(`Error moving file ${file.name}:`, err);
      unsupportedFiles.push({
        name: file.name,
        error: 'Error moving file.'
      });
      continue;
    }

    // 3) Si es terrain o 3Dtiles y es .zip => descomprimir
    if ((uploadType === 'terrain' || uploadType === '3Dtiles') && fileExtension === '.zip') {
      // Determinar si buscamos tileset.json (3Dtiles) o layer.json (terrain)
      const neededFile = (uploadType === 'terrain') ? 'layer.json' : 'tileset.json';
      let unzipDir;

      try {
        // Crear subcarpeta sin el ".zip"
        unzipDir = path.join(uploadPath, path.basename(file.name, '.zip'));
        fsExtra.ensureDirSync(unzipDir);
        console.log(`Folder created for extraction: ${unzipDir}`);

        // Descomprimir
        await decompressZip(filePath, unzipDir);
        console.log(`Files ${file.name} unziped to ${unzipDir}`);

        // Buscar el archivo "neededFile" de forma recursiva
        const requiredFilePath = await findFileRecursive(unzipDir, neededFile);

        if (!requiredFilePath) {
          console.warn(`Not found${neededFile} en ${unzipDir}`);
          fsExtra.removeSync(unzipDir);  // Borrar carpeta descomprimida
          fsExtra.removeSync(filePath);  // Borrar el ZIP
          unsupportedFiles.push({
            name: file.name,
            error: `Not found ${neededFile}. Please, try again.`
          });
          continue; // saltar
        }

        console.log(`Found ${neededFile} en ${requiredFilePath}`);
        const requiredFileDir = path.dirname(requiredFilePath);
        console.log(`Folder containing ${neededFile}: ${requiredFileDir}`);

        // Solo movemos si la carpeta que contiene neededFile es distinta de la base
        if (requiredFileDir !== unzipDir) {
          // Mover el archivo .json al nivel superior
          const destinationRequiredFilePath = path.join(unzipDir, neededFile);

          // Evitar mover si source == destination
          if (requiredFilePath !== destinationRequiredFilePath) {
            await moveFileOrDirectory(requiredFilePath, destinationRequiredFilePath);
          }

          // Dependiendo del tipo:
          if (uploadType === '3Dtiles') {
            // Mover cualquier otro archivo/carpeta (pueden ser carpetas con gltf, etc.)
            const items = fs.readdirSync(requiredFileDir);
            for (const item of items) {
              // Si es el mismo neededFile, saltamos
              if (item.toLowerCase() === neededFile.toLowerCase()) {
                continue;
              }
              const itemPath = path.join(requiredFileDir, item);
              const destinationPath = path.join(unzipDir, item);

              // Evitar mover si source == destination
              if (itemPath !== destinationPath) {
                await moveFileOrDirectory(itemPath, destinationPath);
              }
            }
          } else if (uploadType === 'terrain') {
            // Mover subcarpetas del requiredFileDir al unzipDir
            const items = fs.readdirSync(requiredFileDir);
            for (const item of items) {
              const itemPath = path.join(requiredFileDir, item);
              const stats = fs.statSync(itemPath);
              if (stats.isDirectory()) {
                const destinationItemPath = path.join(unzipDir, item);
                if (itemPath !== destinationItemPath) {
                  await moveFileOrDirectory(itemPath, destinationItemPath);
                  console.log(`Subdirectory moved ${item} a ${destinationItemPath}`);
                }
              }
            }
          }

          // Borrar la carpeta original
          fsExtra.removeSync(requiredFileDir);
          console.log(`Original folder ${requiredFileDir} detelted`);
        } else {
          // Si requiredFileDir === unzipDir => ya está todo en el "nivel raíz"
          console.log(`Not needed to move; ${requiredFileDir} Already base folder.`);
        }

        // Borrar el ZIP original
        fsExtra.removeSync(filePath);
        console.log(`Original ZIP folder ${filePath} deleted`);

      } catch (err) {
        console.error('Error unzipping or validating .zip:', err);
        if (unzipDir && fs.existsSync(unzipDir)) {
          fsExtra.removeSync(unzipDir); // Limpieza
          console.log(`Folder unzipped ${unzipDir} deleted due to an error`);
        }
        fsExtra.removeSync(filePath); // Borrar ZIP
        unsupportedFiles.push({
          name: file.name,
          error: 'Error al descomprimir el archivo. Por favor, inténtalo de nuevo.'
        });
        continue;
      }
    }

    // 4) Si todo fue bien
    uploadedFiles.push(file.name);
  }

  // Mensaje final
  let message;
  if (uploadedFiles.length > 0 && unsupportedFiles.length === 0) {
    message = 'All files were uploaded and processed successfully.';
  } else if (uploadedFiles.length > 0 && unsupportedFiles.length > 0) {
    message = 'Some files were uploaded successfully, but others failed.';
  } else {
    message = 'No files were uploaded successfully.';
  }

  return res.status(uploadedFiles.length > 0 ? 200 : 400).json({
    message,
    uploadedFiles,
    unsupportedFiles
  });
});


// Ruta para obtener el extent de un terreno directamente desde layer.json
router.get('/api/terrainExtent/:terrainName', (req, res) => {
  const terrainName = req.params.terrainName;
  const layerJsonPath = path.join(terrainDir, terrainName, 'layer.json');

  fs.readFile(layerJsonPath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading layer.json for the terrain "${terrainName}":`, err);
      return res.status(404).json({ error: 'layer.json not found for the specified terrain.' });
    }

    try {
      const layerData = JSON.parse(data);

      // Verificar que bounds existan y tengan al menos 4 elementos
      if (
        !layerData.bounds ||
        !Array.isArray(layerData.bounds) ||
        layerData.bounds.length < 4
      ) {
        throw new Error('Bounding bounds invalid in layer.json.');
      }

      const [west, south, east, north] = layerData.bounds;

      const extent = {
        west,
        south,
        east,
        north
      };

      res.json(extent);
    } catch (parseErr) {
      console.error(`Error procesando layer.json para el terreno "${terrainName}":`, parseErr);
      res.status(500).json({ error: 'Error processing layer.json. Ensure it is correctly formatted.' });
    }
  });
});

// Resto de las rutas (sin modificaciones)
router.get('/geodata', (req, res) => {
  //const files2DPath = twodDir;
  const files3DPath = tredDir;
  const files3DtilesPath = tilesDir;
  const filesTerrainPath = terrainDir;
  //const folderNames2D = fs.readdirSync(files2DPath);
  const folderNames3D = fs.readdirSync(files3DPath);
  const folderNames3Dtiles = fs.readdirSync(files3DtilesPath);
  const folderNamesTerrain = fs.readdirSync(filesTerrainPath);

  res.render('geodata', {
    //folderNames2D,
    folderNames3D,
    folderNames3Dtiles,
    folderNamesTerrain,
    isAuthenticated: !!req.session.user, // Comprueba si el usuario está autenticado
    userRole: req.session.user ? req.session.user.role : null // Pasa el rol del usuario si existe
  });
});


router.get('/api/files', (req, res, next) => {
  try {
    //const files2D = [];
    const files3D = [];
    const files3Dtiles = [];
    const filesTerrain = [];

    const paths = {
      //files2DPath: path.resolve(__dirname, '..', req.paths['2dPath']),
      files3DPath: path.resolve(__dirname, '..', req.paths['3dPath']),
      files3DtilesPath: path.resolve(__dirname, '..', req.paths['3dtilesPath']),
      filesTerrainPath: path.resolve(__dirname, '..', req.paths['TerrainPath']),
    };

    for (const [key, dirPath] of Object.entries(paths)) {
      if (!fs.existsSync(dirPath)) {
        console.warn(`${key} does not exist.`);
        continue;
      }

      fs.readdirSync(dirPath).forEach((file) => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);

        // ==== 2D ====
        // Si quieres que .geojson y .kml vayan a 2D en lugar de 3D, podrías ajustarlo aquí.
        // Por ahora, asumo que 2D son tus shapefiles, tiffs, imágenes, etc.
       /*  if (stats.isFile() && key === 'files2DPath') {
          files2D.push({ name: file, type: '2d' });
        } */

        // ==== 3D ====
        // Agregamos las extensiones que quieres en la sección 3D:
        // .gltf, .glb (ya estaban), .kml, .kmz, .geojson, .czml
        if (
          stats.isFile() &&
          key === 'files3DPath' &&
          (
            file.endsWith('.gltf') ||
            file.endsWith('.glb') ||
            file.endsWith('.kml') ||
            file.endsWith('.kmz') ||
            file.endsWith('.geojson') ||
            file.endsWith('.czml')
          )
        ) {
          files3D.push({ name: file, type: '3d' });
        }

        // ==== 3D Tiles ====
        else if (key === 'files3DtilesPath') {
          if (stats.isDirectory()) {
            // Directorio => suele contener tileset.json
            files3Dtiles.push({ name: file, type: '3Dtiles' });
          } else if (stats.isFile()) {
            // Archivos .b3dm, .i3dm, .pnts (etc.)
            if (
              file.endsWith('.b3dm') ||
              file.endsWith('.i3dm') ||
              file.endsWith('.pnts')
            ) {
              files3Dtiles.push({ name: file, type: '3Dtiles' });
            }
            // Si deseas incluir, por ejemplo, .json sueltos, agrégalo aquí
          }
        }

        // ==== Terreno ====
        else if (stats.isDirectory() && key === 'filesTerrainPath') {
          filesTerrain.push({ name: file, type: 'terrain' });
        }

      });
    }

    res.json({ /* files2D,  */files3D, files3Dtiles, filesTerrain });
  } catch (err) {
    console.error('Error reading files:', err);
    res.status(500).json({ error: 'Error reading files.' });
  }
});

// Ejemplo en tu backend (Node.js/Express)
/* router.get('/api/getIonTerrains', (req, res) => {
  try {
    const defaultJsonPath = path.join(__dirname, '..', 'data', '3d-jsons', 'default.json');
    const data = JSON.parse(fs.readFileSync(defaultJsonPath, 'utf8'));
    // data.terrains es un array con { name, url }

    return res.json(data.terrains || []); 
  } catch (error) {
    console.error('Error reading default.json for Ion terrains:', error);
    return res.status(500).json({ error: 'Could not read Ion terrains.' });
  }
}); */


// Endpoint para obtener terrenos de Cesium Ion






router.get('/api/files/:fileName', (req, res) => {
  const fileType = req.query.type;
  let folderPath;

  if (fileType === '3d') {
    folderPath = req.paths['3dPath'];
  } else if (fileType === 'terrain') {
    folderPath = req.paths['TerrainPath'];
  } else if (fileType === '3Dtiles') {
    folderPath = req.paths['3dtilesPath'];
  } /* else {
    folderPath = req.paths['2dPath'];
  } */

  const filePath = path.join(__dirname, '..', folderPath, req.params.fileName);
  res.sendFile(filePath);
});




router.delete('/api/files/:fileName', (req, res, next) => {
  const fileType = req.query.type;
  let filePath;

  if (!fileType) {
    return res.status(400).json({ message: 'Invalid file type.' });
  }

  if (fileType === 'terrain') {
    // Terreno => directorio
    filePath = path.resolve(__dirname, '..', req.paths['TerrainPath'], req.params.fileName);
  } else if (fileType === '3Dtiles') {
    filePath = path.join(__dirname, '..', req.paths['3dtilesPath'], req.params.fileName);
  } else {
    filePath = path.join(__dirname, '..', req.paths[`${fileType}Path`], req.params.fileName);
  }

  if (!filePath) {
    return res.status(400).json({ message: 'Invalid file path.' });
  }

  // Caso especial: Terrain y 3Dtiles (pueden ser carpetas)
  if (fileType === 'terrain' || fileType === '3Dtiles') {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        console.error(`Error accessing path ${filePath}: ${err.message}`);
        return res.status(500).json({ message: 'Error accessing file or directory.', error: err.message });
      }

      if (stats.isDirectory()) {
        // Borramos directorio completo
        fsExtra.remove(filePath, (err) => {
          if (err) {
            console.error(`Error removing directory ${filePath}: ${err.message}`);
            return res.status(500).json({ message: 'Error removing directory', error: err.message });
          }
          return res.json({ message: `${fileType} directory removed successfully` });
        });
      } else {
        // Es un archivo suelto (e.g. .b3dm, .i3dm, .pnts)
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(`Error deleting file ${filePath}: ${err.message}`);
            return res.status(500).json({ message: 'Error deleting file.', error: err.message });
          }
          return res.json({ message: '3Dtiles file deleted successfully' });
        });
      }
    });
  } else {
    // Resto de tipos (2d, 3d, etc.)
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`Error deleting file ${filePath}: ${err.message}`);
        return res.status(500).json({ message: 'Error deleting file.', error: err.message });
      }

      // Ejemplo: si es 3d y .gltf => borrar .geojson
      if (fileType === '3d' && (filePath.endsWith('.gltf') || filePath.endsWith('.glf'))) {
        const geoJsonFileName = `${path.basename(req.params.fileName, path.extname(req.params.fileName))}.geojson`;
        const geoJsonFilePath = path.join(__dirname, '..', 'data', 'uploaded', '3d', 'geojson-conf', geoJsonFileName);

        fs.unlink(geoJsonFilePath, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.error(`Error deleting geojson file ${geoJsonFilePath}: ${err.message}`);
            return res.status(500).json({ message: 'Error deleting geojson file.', error: err.message });
          }
          res.json({ message: 'File and its configuration deleted successfully' });
        });
      } else {
        res.json({ message: 'File deleted successfully' });
      }
    });
  }
});


router.get('/api/getLocalTerrains', (req, res) => {
  const terrainPath = terrainDir;
  console.log('Terrain Directory:', terrainPath);

  if (!fs.existsSync(terrainPath)) {
    console.error('Terrain directory does not exist.');
    return res.status(500).send('Terrain directory does not exist.');
  }

  fs.readdir(terrainPath, (err, files) => {
    if (err) {
      console.error('Error reading terrain directory:', err);
      return res.status(500).send('Error reading terrain directory');
    }

    const terrainFolders = files.filter(file => fs.statSync(path.join(terrainPath, file)).isDirectory());
    res.json(terrainFolders);
  });
});

/* router.get('/api/loadTerrainConfig', (req, res) => {
  const configPath = path.join(__dirname, '..', 'data', '3d-jsons', 'default.json');

  fs.readFile(configPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error loading terrain configuration:', err);
      return res.status(500).send('Error loading terrain configuration');
    }
    const terrainConfig = JSON.parse(data);
    res.json(terrainConfig);
  });
});
 */

// Ruta para guardar la configuración del terreno
/* router.post('/api/saveTerrainConfig', (req, res) => {
  const configPath = path.join(__dirname, '..', 'data', '3d-jsons', 'default.json');
  const terrainConfig = req.body;

  fs.writeFile(configPath, JSON.stringify(terrainConfig, null, 2), (err) => {
    if (err) {
      console.error('Error saving terrain configuration:', err);
      return res.status(500).send('Error saving terrain configuration');
    }
    res.json({ message: 'Terrain configuration saved successfully' });
  });
}); */

router.post('/api/savePosition/:filename', (req, res) => {
  const fileName = req.params.filename;
  const data = req.body;

  // Asegúrate de que el directorio existe antes de intentar escribir el archivo
  const directoryPath = path.join(__dirname, '..', 'data', 'uploaded', '3d', 'geojson-conf');
  const filePath = path.join(directoryPath, `${fileName}.geojson`);

  // Crear el directorio si no existe
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  // Guardar el archivo
  fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error('Error saving position:', err);
      return res.status(500).send('Error saving position');
    }
    console.log('Position saved successfully:', fileName);
    res.json({ message: 'Position saved successfully' });
  });
});


router.use('/api/positions', express.static(path.join(__dirname, '..', 'data', 'uploaded', '3d', 'geojson-conf')));


router.get('/api/positions/:fileName', isAuthenticated, (req, res) => {
  const filePath = path.join(__dirname, '..', 'data', 'uploaded', '3d', 'geojson-conf', req.params.fileName);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('File not found');
    }

    res.sendFile(filePath);
  });
});

router.use((req, res) => {
  res.status(404).send('Not Found');
});

router.use((err, req, res) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});


// Ruta para listar los 3D Tiles locales disponibles
router.get('/api/getLocal3DTiles', (req, res) => {
  console.log('Tiles Directory:', tilesDir);

  if (!fs.existsSync(tilesDir)) {
    console.error('Tiles directory does not exist:', tilesDir);
    return res.status(404).json({ error: 'Tiles directory does not exist' });
  }

  try {
    const tilesets = fs.readdirSync(tilesDir).filter(dir => {
      const tilesetPath = path.join(tilesDir, dir, 'tileset.json');
      console.log('Checking for tileset.json at:', tilesetPath);
      return fs.existsSync(tilesetPath);
    });

    console.log('Found tilesets:', tilesets);
    res.json(tilesets);
  } catch (err) {
    console.error('Error reading tiles directory:', err);
    res.status(500).json({ error: 'Error reading tiles directory' });
  }
});



module.exports = router;
