let cesiumViewer;

// Ajustes de extensiones por tipo
const acceptFormats = {
  /* '2d': ['.jpeg', '.jpg', '.png', '.geotif', '.tiff'], */
  '3d': ['.gltf', '.glb', '.czml', '.kml', '.kmz'],
  '3Dtiles': ['.zip'],
  'terrain': ['.zip']
};

document.addEventListener('DOMContentLoaded', async function () {

  const depthTestToggle = document.getElementById('depthTestToggle');
      if (depthTestToggle) {
        depthTestToggle.checked = false;
      }

  function toggleDepthTestAgainstTerrain(enabled) {
    // Para el globo
    cesiumViewer.scene.globe.depthTestAgainstTerrain = enabled;

    // Para el modelo GLTF
    if (model) {
      model.depthTestAgainstTerrain = enabled;
    }

    // Para el tileset 3D Tiles
    if (currentTileset) {
      currentTileset.depthTestAgainstTerrain = enabled;
    }
  }

  function toggleDepthTest(enabled) {
    // Esto controla el globo (terreno)
    cesiumViewer.scene.globe.depthTestAgainstTerrain = enabled;

    // Esto controla los modelos GLTF/GLB
    if (model) {
      model.depthTestAgainstTerrain = enabled;
    }

    // Esto controla un tileset (si lo has guardado en una variable global)
    if (currentTileset) {
      currentTileset.depthTestAgainstTerrain = enabled;
    }
  }



  // Elementos del DOM
  const fileInput = document.getElementById('fileInput');
  const radios = document.querySelectorAll('input[name="uploadType"]');
  const previewContainer = document.getElementById('imagePreview');
  const terrainHeightInput = document.getElementById('terrainHeight');
  const terrainSelect = document.getElementById('terrainSelect');
  const uploadForm = document.getElementById('uploadForm');
  const modal = document.getElementById("view-modal");
  const span = document.getElementsByClassName("close")[0];
  const lockButton = document.getElementById('lockButton');
  const xCoordinateInput = document.getElementById('xCoordinate');
  const yCoordinateInput = document.getElementById('yCoordinate');
  const zCoordinateInput = document.getElementById('zCoordinate');
  const scaleInput = document.getElementById('scaleInput');
  const horizontalRotationInput = document.getElementById('horizontalRotationInput');
  const verticalRotationInput = document.getElementById('verticalRotationInput');
  const lateralRotationInput = document.getElementById('lateralRotationInput');
  const uploadButton = document.getElementById('uploadButton');
  const tilesetSelect = document.getElementById('tilesetSelect');



  // Botón para copiar link
  const copyLinkButton = document.getElementById('copyLinkButton');
  copyLinkButton.addEventListener('click', copyDataLink);

  // Variable para almacenar la URL cruda de un .gltf/.glb
  let currentDataLink = null;
  let cesiumViewer, model, origin, currentFileName;
  let minimumPixelSize = 128;
  let isLocked = false;
  let isClampToGround = false;
  let currentTileset;

  function showCopyLinkButton() {
    const copyLinkButton = document.getElementById('copyLinkButton');
    if (copyLinkButton) {
      copyLinkButton.style.display = 'inline-block';
    }
  }

  function hideCopyLinkButton() {
    const copyLinkButton = document.getElementById('copyLinkButton');
    if (copyLinkButton) {
      copyLinkButton.style.display = 'none';
    }
  }

  function showLockButton() {
    const lockButton = document.getElementById('lockButton');
    if (lockButton) {
      lockButton.style.display = 'block';
    }
  }
  function hideLockButton() {
    const lockButton = document.getElementById('lockButton');
    if (lockButton) {
      lockButton.style.display = 'none';
    }
  }

  function hideTerrainTable() {
    const terrainTable = document.getElementById('terrainTable');
    if (terrainTable) {
      terrainTable.style.display = 'none';
    }
  }

  function showTerrainTable() {
    const terrainTable = document.getElementById('terrainTable');
    if (terrainTable) {
      terrainTable.style.display = 'block';
    }
  }

  function showCoordinateTable() {
    const coordTable = document.getElementById('coordinateTable');
    if (coordTable) {
      coordTable.style.display = 'block';
    }
  }

  function hideCoordinateTable() {
    const coordTable = document.getElementById('coordinateTable');
    if (coordTable) {
      coordTable.style.display = 'none';
    }
  }


  // 1) Configurar "accept" según el radio seleccionado
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      const uploadType = radio.value;
      const exts = acceptFormats[uploadType] || [];
      fileInput.accept = exts.join(',');
      // Limpiar vista previa
      previewContainer.innerHTML = '';
      fileInput.value = '';
    });
  });


  // Forzar un cambio inicial (para el radio marcado como checked)
  const checkedRadio = [...radios].find(r => r.checked);
  if (checkedRadio) {
    fileInput.accept = acceptFormats[checkedRadio.value].join(',');
  }

  // 2) Mostrar vista previa (3cm x 3cm) SOLO si es imagen
  fileInput.addEventListener('change', function (event) {
    previewContainer.innerHTML = ''; // limpia previews anteriores

    const files = event.target.files;
    if (!files || !files.length) return;

    for (let file of files) {
      // Verificar si es imagen por su MIME type
      if (!file.type.startsWith('image/')) {
        continue; // si no es imagen, se ignora para la vista previa
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        // Ajustar estilo para max 3cm x 3cm
        img.style.maxWidth = '3cm';
        img.style.maxHeight = '3cm';
        img.style.objectFit = 'cover';

        // Muestra el nombre de archivo
        const info = document.createElement('p');
        info.textContent = file.name;

        const wrapper = document.createElement('div');
        wrapper.style.margin = '0.5em 0';
        wrapper.appendChild(info);
        wrapper.appendChild(img);

        previewContainer.appendChild(wrapper);
      };
      reader.readAsDataURL(file);
    }
  });

  uploadForm.addEventListener('submit', function (event) {
    event.preventDefault();

    const formData = new FormData(this);
    const uploadType = document.querySelector('input[name="uploadType"]:checked').value;
    formData.append('uploadType', uploadType);

    const uploadEndpoint = '/data/api/files'; // Siempre usaremos esta ruta

    disableButtons();

    fetch(uploadEndpoint, {
      method: 'POST',
      body: formData,
    })
      .then(response => {
        if (!response.ok) {
          // Intentar leer la respuesta como texto si no es JSON
          return response.text().then(text => {
            throw new Error(text || 'Upload failed');
          });
        }
        return response.json();
      })
      .then(result => {
        enableButtons();
        if (result.message) {
          showMessage(result.message, 'is-success');
          loadFiles(); // Recargar lista de archivos después de la carga
        } else {
          showMessage('Error uploading files', 'is-danger');
        }
      })
      .catch(error => {
        console.error('Upload error:', error);
        showMessage('Error: ' + error.message, 'is-danger');
        enableButtons();
      });

  });

  // 3) Cargar el token de Cesium desde el servidor y configurarlo
  try {
    const config = await fetch('/3d/api/load-cesium-token').then(res => res.json());
    Cesium.Ion.defaultAccessToken = config.cesiumToken;
    console.log('Cesium Ion token loaded:', Cesium.Ion.defaultAccessToken);

    // Cargar terrenos de Ion después de configurar el token
    await loadIonTerrains(config);
  } catch (error) {
    console.error('Error loading Cesium token configuration:', error);
    showMessage('Error loading Cesium token. Check the console for details.', 'is-danger');
  }

  // 4) Cargar terrenos locales
  loadLocalTerrains();

  // 5) Cargar 3D Tiles locales
  loadLocal3DTiles();

  // 6) Configurar el manejador de selección de terrenos
  // 6) Configurar el manejador de selección de terrenos
terrainSelect.addEventListener('change', async function () {
  const selectedTerrain = terrainSelect.value;

  if (!cesiumViewer) {
    console.error('Cesium viewer is not initialized');
    showMessage('Cesium viewer is not initialized.', 'is-danger');
    return;
  }

  // Resetea cualquier terreno actual al predeterminado
  cesiumViewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();

  if (selectedTerrain === 'cesiumIon') {
    // 1) Opción "Flat Terrain" => usar el elipsoide plano
    cesiumViewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    console.log('Using flat ellipsoid terrain.');
    showMessage('Using flat ellipsoid terrain.', 'is-success');

  } else if (selectedTerrain.startsWith('Ion Terrain: ')) {
    // 2) Manejo de terrenos Ion con assetId
    const assetIdStr = selectedTerrain.split(':')[1]?.trim();
    const assetId = parseInt(assetIdStr, 10);

    if (!isNaN(assetId)) {
      try {
        const terrainProvider = new Cesium.CesiumTerrainProvider({
          url: await Cesium.IonResource.fromAssetId(assetId),
          requestVertexNormals: true,
          requestWaterMask: true,
        });
        cesiumViewer.scene.terrainProvider = terrainProvider;
        console.log(`Cesium Ion Terrain loaded with assetId: ${assetId}`);
        showMessage(`Ion Terrain "${selectedTerrain}" loaded successfully.`, 'is-success');
      } catch (error) {
        console.error(`Error loading Cesium Ion Terrain with assetId ${assetId}:`, error);
        showMessage('Failed to load Cesium Ion Terrain. Please check the assetId or your Ion token.', 'is-danger');
      }
    } else {
      console.error('Invalid Ion Terrain assetId');
      showMessage('Invalid Ion Terrain assetId. Please select a valid terrain.', 'is-danger');
    }

  } else if (selectedTerrain.startsWith('Local Terrain: ')) {
    // 3) Manejo de terrenos locales
    const terrainName = selectedTerrain.replace('Local Terrain: ', '').trim();

    if (terrainName) {
      try {
        const terrainProvider = new Cesium.CesiumTerrainProvider({
          url: `/terrain/${terrainName}/`, // Asegúrate de que termina con "/"
          requestVertexNormals: true,
          requestWaterMask: true,
        });
        cesiumViewer.scene.terrainProvider = terrainProvider;
        console.log(`Local Terrain loaded: /terrain/${terrainName}/`);
        showMessage(`Local Terrain "${terrainName}" loaded successfully.`, 'is-success');
      } catch (error) {
        console.error(`Error loading Local Terrain: ${terrainName}`, error);
        showMessage('Failed to load local terrain. Please check the terrain folder structure.', 'is-danger');
      }
    } else {
      console.error('Invalid Local Terrain name');
      showMessage('Invalid Local Terrain name. Please select a valid terrain.', 'is-danger');
    }

  } else {
    // 4) Si no coincide con nada
    console.warn('Unknown terrain selection');
    showMessage('Unknown terrain selection. Please choose a valid option.', 'is-warning');
  }
});




  // Función para cargar los terrenos locales
  function loadLocalTerrains() {
    fetch('/data/api/getLocalTerrains')
      .then(response => response.json())
      .then(terrains => {
        terrains.forEach(terrain => {
          const option = document.createElement('option');
          option.value = `Local Terrain: ${terrain}`;
          option.textContent = `Local Terrain: ${terrain}`;
          terrainSelect.appendChild(option);
        });
      })
      .catch(error => {
        console.error('Error loading local terrains:', error);
        showMessage('Error loading local terrains. Check the console for details.', 'is-danger');
      });
  }


  // Función para cargar los terrenos de Cesium Ion
  async function loadIonTerrains(config) {
    console.log('Cargando terrenos de Cesium Ion...');

    try {
      // Asegura que el token esté configurado
      if (config.cesiumToken && !Cesium.Ion.defaultAccessToken) {
        Cesium.Ion.defaultAccessToken = config.cesiumToken;
      }

      // Solicita la lista de assets desde la API de Cesium Ion
      const response = await fetch('https://api.cesium.com/v1/assets', {
        headers: {
          'Authorization': `Bearer ${config.cesiumToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Ion assets: ${response.status} ${response.statusText}`);
      }

      const assetData = await response.json();
      const terrains = assetData.items.filter(item => item.type === 'TERRAIN');

      if (terrains.length === 0) {
        console.warn('No se encontraron terrenos en Cesium Ion.');
        showMessage('No Ion terrains found.', 'is-warning');
        return;
      }

      // Renderiza los terrenos en la interfaz
      renderIonTerrains(terrains);

      // Opcional: Seleccionar automáticamente el primer terreno
      const firstTerrain = terrains[0];
      if (firstTerrain) {
        console.log(`Seleccionando el primer terreno de Ion: ${firstTerrain.name}`);
        terrainSelect.value = `Ion Terrain: ${firstTerrain.id}`;
        terrainSelect.dispatchEvent(new Event('change')); // Cargar el terreno automáticamente
      }
    } catch (error) {
      console.error('Error al cargar los terrenos de Cesium Ion:', error);
      showMessage('Error loading Ion terrains. Check the console for details.', 'is-danger');
    }
  }

  // Función para renderizar los terrenos de Cesium Ion en el selector
  function renderIonTerrains(terrains) {
    terrains.forEach(terrain => {
      const option = document.createElement('option');
      option.value = `Ion Terrain: ${terrain.id}`;
      option.textContent = `Ion Terrain: ${terrain.name}`;
      terrainSelect.appendChild(option);
    });
  }

  // Función para cargar los 3D Tiles locales en el dropdown
  function loadLocal3DTiles() {
    fetch('/data/api/getLocal3DTiles')
      .then(response => response.json())
      .then(tilesets => {
        tilesets.forEach(tileset => {
          const option = document.createElement('option');
          option.value = tileset;
          option.textContent = tileset; // Mostrar el nombre del tileset
          tilesetSelect.appendChild(option);
        });
      })
      .catch(error => {
        console.error('Error loading local 3D Tiles:', error);
        showMessage('Error loading local 3D Tiles. Check the console for details.', 'is-danger');
      });
  }

  // Función para descargar archivos
  function downloadFile(fileName, type) {
    const link = document.createElement('a');
    link.href = `/data/api/files/${fileName}?type=${type}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Función para mostrar mensajes
  function showMessage(message, type) {
    const messageBox = document.createElement('div');
    messageBox.className = `notification ${type}`;
    messageBox.textContent = message;

    const modalContent = document.querySelector('.modal-content');
    modalContent.insertBefore(messageBox, modalContent.firstChild);

    setTimeout(() => {
      messageBox.remove();
    }, 2000);
  }

  // Función para cerrar el modal
  span.onclick = function () {
    closeModal();
  };

  window.onclick = function (event) {
    if (event.target == modal) {
      closeModal();
    }
  };

  function closeModal() {
    const modal = document.getElementById("view-modal");
    modal.style.display = "none";

    if (cesiumViewer && !cesiumViewer.isDestroyed()) {
      cesiumViewer.destroy();
      cesiumViewer = undefined;
    }

    const cesiumContainer = document.getElementById('cesiumContainer');
    cesiumContainer.innerHTML = '';

    const coordTable = document.querySelector('.coordinate-table');
    if (coordTable) coordTable.style.display = 'block';

  }

  function viewImage(fileName) {
    closeModal();

    // Mostrar el modal
    const modal = document.getElementById("view-modal");
    modal.style.display = "block";

    // Ocultar la tabla de coordenadas
    hideCoordinateTable()
    hideTerrainTable()
    hideLockButton()

    // Limpiar contenedor "Cesium"
    const cesiumContainer = document.getElementById('cesiumContainer');
    cesiumContainer.innerHTML = '';
    cesiumContainer.style.display = 'block';

    // Construimos la URL cruda => http://localhost:3005/2d/<fileName>
    const fileUrl = `${window.location.origin}/2d/${fileName}`;

    // Asignamos al global
    currentDataLink = fileUrl;

    // Creamos contenedor
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.padding = '1rem';

    // Imagen
    const imageElement = document.createElement('img');
    imageElement.src = fileUrl;
    imageElement.style.maxWidth = '80%';
    imageElement.style.maxHeight = '80%';
    imageElement.alt = fileName;

    // Link directo
    const linkElement = document.createElement('a');
    linkElement.href = fileUrl;
    linkElement.textContent = 'Open raw image in new tab';
    linkElement.target = '_blank';
    linkElement.style.marginTop = '1rem';

    // Párrafo extra
    const urlParagraph = document.createElement('p');
    urlParagraph.textContent = `Link: ${fileUrl}`;

    // Insertar en wrapper
    wrapper.appendChild(imageElement);
    wrapper.appendChild(linkElement);
    wrapper.appendChild(urlParagraph);

    // Insertar en el cesiumContainer
    cesiumContainer.appendChild(wrapper);
  }

  // ----------------------------------------------------------------
  // Función para copiar el link (solo si currentDataLink != null)
  // ----------------------------------------------------------------
  function copyDataLink() {
    if (!currentDataLink) {
      showMessage('No link available to copy', 'is-warning');
      return;
    }
    navigator.clipboard.writeText(currentDataLink)
      .then(() => {
        showMessage('Data link copied to clipboard!', 'is-success');
      })
      .catch(err => {
        console.error('Error copying link:', err);
        showMessage('Error copying link.', 'is-danger');
      });
  }





  // Función para actualizar la configuración del modelo
  function updateModelConfiguration() {
    if (!model || !origin) return Promise.resolve(); // nada que guardar

    const cartographic = Cesium.Cartographic.fromCartesian(origin);
    const position = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [
              Cesium.Math.toDegrees(cartographic.longitude),
              Cesium.Math.toDegrees(cartographic.latitude),
              cartographic.height
            ]
          },
          properties: {
            name: currentFileName || '3d-modells',
            scale: parseFloat(scaleInput.value),
            // La clave: si está locked => 1, si no => 128
            minimumPixelSize: isLocked ? 1 : 128,
            horizontalRotation: parseFloat(horizontalRotationInput.value),
            verticalRotation: parseFloat(verticalRotationInput.value),
            lateralRotation: parseFloat(lateralRotationInput.value)
          }
        }
      ]
    };

    const positionPath = `/data/api/savePosition/${currentFileName}`;

    // retornar la promesa para poder hacer .then o await
    return fetch(positionPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(position)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} saving position`);
        }
        return response.json();
      })
      .then(result => {
        console.log('Configuration updated:', result);
        showMessage('Configuration updated successfully', 'is-success');
      })
      .catch(error => {
        console.error('Update configuration error:', error);
        showMessage('Error updating configuration.', 'is-danger');
        throw error;
      });
  }


  function disableButtons() {
    uploadButton.disabled = true;
    const actionButtons = document.querySelectorAll('.buttons button');
    actionButtons.forEach(button => button.disabled = true);
  }

  function enableButtons() {
    uploadButton.disabled = false;
    const actionButtons = document.querySelectorAll('.buttons button');
    actionButtons.forEach(button => button.disabled = false);
  }

  function viewFile(fileName) {
    closeModal(); // Cerrar modal previo
    const modal = document.getElementById("view-modal");
    modal.style.display = "block";
    initializeViewer();


    // Reiniciamos el link global
    currentDataLink = null;

    // Limpia links viejos en .modal-content (si aún existían)
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
      const oldLinks = modalContent.querySelectorAll('.raw-gltf-link, .gltf-url-paragraph');
      oldLinks.forEach(el => el.remove());
    }

    // Nombre base sin extensión
    currentFileName = fileName.split('.').slice(0, -1).join('.');
    // Ruta interna para Cesium
    const filePath = `/data/api/files/${fileName}?type=3d`;

    // Por defecto, ocultamos el botón
    hideCopyLinkButton();

    // Si es .gltf/.glb => habilitar configuración y asignar link
    if (fileName.toLowerCase().endsWith('.gltf') || fileName.toLowerCase().endsWith('.glb')) {
      enableModelConfiguration(true);

      // Link crudo: http://localhost:3005/3d/<fileName>
      const directGltfUrl = `${window.location.origin}/3d/${fileName}`;
      currentDataLink = directGltfUrl;  // lo usaremos en copyLinkButton
      // Mostrar botón
      showCopyLinkButton();
      showTerrainTable()
      loadModelWithPosition(filePath, fileName);

    } else {
      // No es gltf => sin link
      disableModelConfiguration();

      // Ver otros casos
      if (fileName.toLowerCase().endsWith('.czml')) {
        hideCoordinateTable()
        hideLockButton()
        showTerrainTable()
        loadCZMLFile(filePath);
      } else if (fileName.toLowerCase().endsWith('.kml') ||
        fileName.toLowerCase().endsWith('.kmz')) {
        hideCoordinateTable()
        showTerrainTable()
        hideLockButton()
        loadKMLFile(filePath);
      }
    }

    loadOrCreateConfiguration(fileName);
  }


  // Función para ver archivos de Terreno
  function viewTerrain(fileName) {
    console.log("viewTerrain called with fileName:", fileName);
    closeModal();
    currentDataLink = null;
    hideCopyLinkButton();
    hideTerrainTable();
    hideLockButton();
    hideCoordinateTable();
    modal.style.display = "block";
    initializeViewer();

    // Extraer el nombre del terreno sin la extensión
    let terrainName = fileName.includes('.')
      ? fileName.substring(0, fileName.lastIndexOf('.'))
      : fileName;
    console.log('terrainName:', terrainName);

    try {
      const terrainProvider = new Cesium.CesiumTerrainProvider({
        url: `/terrain/${terrainName}/`,
        requestVertexNormals: true,
        requestWaterMask: true,
      });
      cesiumViewer.scene.terrainProvider = terrainProvider;
      console.log(`Local Terrain loaded: /terrain/${terrainName}/`);
      showMessage(`Local Terrain "${terrainName}" loaded successfully.`, 'is-success');

      // Verificar que la prueba de profundidad esté activada
      console.log("depthTestAgainstTerrain (globe):", cesiumViewer.scene.globe.depthTestAgainstTerrain);

      // Actualizar el dropdown para reflejar el terreno seleccionado
      const dropdown = document.getElementById('terrainSelect');
      if (dropdown) {
        dropdown.value = `Local Terrain: ${terrainName}`;
      } else {
        console.warn('Dropdown de terrenos no encontrado.');
      }

      // Obtener el bounding rectangle del terreno de manera dinámica
      fetch(`/data/api/terrainExtent/${terrainName}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch terrain extent');
          }
          return response.json();
        })
        .then(extent => {
          console.log('Fetched terrain extent:', extent);
          const rectangle = Cesium.Rectangle.fromDegrees(extent.west, extent.south, extent.east, extent.north);
          cesiumViewer.camera.flyTo({
            destination: rectangle,
            duration: 2,
            complete: () => {
              console.log(`Camera flew to the extent of terrain "${terrainName}".`);
            }
          });
        })
        .catch(error => {
          console.error('Error fetching terrain extent:', error);
          cesiumViewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(0, 0, 10000000),
            duration: 2
          });
          showMessage('Error fetching terrain extent. Zooming to default location.', 'is-warning');
        });

      disableModelConfiguration();
    } catch (error) {
      console.error(`Error loading Local Terrain: ${terrainName}`, error);
      showMessage('Failed to load local terrain. Please check the terrain folder structure.', 'is-danger');
    }
  }



  // Función para ver 3D Tiles
  function viewTiles(folderName) {
    // Cierra el modal antiguo e inicia el viewer
    closeModal();
    currentDataLink = null;
    hideCopyLinkButton();
    hideLockButton()
    hideCoordinateTable();
    showTerrainTable();
    modal.style.display = "block";
    initializeViewer();  // Asumiendo que esto crea tu `cesiumViewer`

    const tilesetUrl = `/tiles/${folderName}/tileset.json`;

    // Cargar el tileset en Cesium
    const tileset = new Cesium.Cesium3DTileset({ url: tilesetUrl });
    tileset.depthTestAgainstTerrain = true; // Habilitar la prueba de profundidad para los 3D Tiles
    currentTileset = tileset;

    // Agregarlo a la escena y, cuando esté listo, hacer un zoom 
    cesiumViewer.scene.primitives.add(tileset);

    tileset.readyPromise
      .then(() => {
        cesiumViewer.zoomTo(tileset);
        showMessage('3D Tiles loaded successfully.', 'is-success');

        // Deshabilitar configuraciones ya que no son aplicables a 3D Tiles
        disableModelConfiguration();
      })
      .catch((error) => {
        console.error('Error cargando 3D Tiles:', error);
        showMessage('Error loading 3D Tiles.', 'is-danger');
      });
  }


  function initializeViewer() {
    if (!cesiumViewer) {
      const viewerElement = document.getElementById("cesiumContainer");
      viewerElement.innerHTML = ''; // Limpiar el contenido anterior

      cesiumViewer = new Cesium.Viewer('cesiumContainer', {
        timeline: true,
        geocoder: true,
        vrButton: false,
        baseLayerPicker: true,
        navigationHelpButton: false,
        shadows: false,
        shouldAnimate: true,
        animation: true,
        sceneModePicker: false,
        fullscreenButton: false,
        sceneMode: Cesium.SceneMode.SCENE3D,
        terrainShadows: Cesium.ShadowMode.DISABLED,
        homeButton: false,
      });

      

      cesiumViewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();

      if (Cesium.viewerCesiumNavigationMixin) {
        const options = {
          defaultResetView: Cesium.Rectangle.fromDegrees(10, 55, 24, 69),
          enableCompass: true,
          enableZoomControls: true,
          enableDistanceLegend: true,
          enableCompassOuterRing: true,
        };
        cesiumViewer.extend(Cesium.viewerCesiumNavigationMixin, options);
      } else {
        console.warn("Cesium Navigation Mixin is not loaded.");
      }


      // Configurar depthTestAgainstTerrain para el globo
      cesiumViewer.scene.globe.depthTestAgainstTerrain = false;


      // Configurar depthTestAgainstTerrain para modelos y tilesets
      cesiumViewer.scene.globe.show = true;
      cesiumViewer.scene.globe.translucency.enabled = false;
      cesiumViewer.scene.requestRender();

      const scene = cesiumViewer.scene;
      scene.globe.show = true;
      scene.globe.translucency.enabled = false;
      scene.globe.showGroundAtmosphere = false;
      scene.globe.baseColor = Cesium.Color.DARKGRAY;
      scene.globe.depthTestAgainstTerrain = true;
      scene.globe.enableLighting = false;
      scene.sun.show = true;
      scene.moon.show = true;
      scene.highDynamicRange = true;
      scene.skyBox.show = false;

      scene.requestRender();

      scene.light = new Cesium.DirectionalLight({
        direction: new Cesium.Cartesian3(-1, -1, -1),
        intensity: 2.0
      });

      scene.skyAtmosphere.show = true;
      cesiumViewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date(Date.UTC(2025, 1, 1, 12)));
      cesiumViewer.clock.shouldAnimate = false;

      enableDragDrop();
      setScreenSpaceEventHandlers();

      const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
      handler.setInputAction(updateTerrainHeight, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      if (terrainSelect) {
        terrainSelect.value = "cesiumIon";
      }
    }
  }

  // Definición de setScreenSpaceEventHandlers
  function setScreenSpaceEventHandlers() {
    if (!cesiumViewer) {
      console.error('Cesium viewer is not initialized.');
      return;
    }

    var screenSpaceEventHandler = cesiumViewer.screenSpaceEventHandler;
    screenSpaceEventHandler.setInputAction(function () {
      cesiumViewer.scene.screenSpaceCameraController.enableZoom = false;
    }, Cesium.ScreenSpaceEventType.RIGHT_DOWN);

    screenSpaceEventHandler.setInputAction(function () {
      cesiumViewer.scene.screenSpaceCameraController.enableZoom = true;
    }, Cesium.ScreenSpaceEventType.RIGHT_UP);
  }

  function enableDragDrop() {
    if (cesiumViewer) {
      cesiumViewer.extend(Cesium.viewerDragDropMixin, {
        clearOnDrop: false,
        clampToGround: true
      });

      cesiumViewer.dropError.addEventListener(function (viewerArg, source, error) {
        window.alert('Error processing ' + source + ': ' + error);
      });
    }
  }

  function loadCZMLFile(filePath) {
    cesiumViewer.dataSources.add(Cesium.CzmlDataSource.load(filePath))
      .then(dataSource => {
        cesiumViewer.zoomTo(dataSource);
      })
      .catch(error => {
        console.error('Error loading CZML file:', error);
        showMessage('Error loading CZML file.', 'is-danger');
      });
  }

  function loadKMLFile(filePath) {
    cesiumViewer.dataSources.add(Cesium.KmlDataSource.load(filePath, {
      camera: cesiumViewer.scene.camera,
      canvas: cesiumViewer.scene.canvas
    }))
      .then(dataSource => {
        cesiumViewer.zoomTo(dataSource);
      })
      .catch(error => {
        console.error('Error loading KML file:', error);
        showMessage('Error loading KML file.', 'is-danger');
      });
  }

  function loadModelWithPosition(filePath, fileName) {
    const modelName = fileName.split('.').slice(0, -1).join('.');
    const positionPath = `/data/api/positions/${modelName}.geojson`;

    fetch(positionPath)
      .then(response => {
        if (!response.ok) {
          throw new Error('GeoJSON file not found');
        }
        return response.json();
      })
      .then(data => {
        const coordinates = data.features[0].geometry.coordinates;
        const longitude = coordinates[0];
        const latitude = coordinates[1];
        const height = coordinates[2];
        const properties = data.features[0].properties;

        // Aquí se cargan las rotaciones incluyendo la lateral
        const hRotation = Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(properties.horizontalRotation || 0));
        const vRotation = Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(properties.verticalRotation || 0));
        const lRotation = Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(properties.lateralRotation || 0));

        const modelPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
        const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(modelPosition);

        // Aplica las escalas y rotaciones incluyendo la lateral
        Cesium.Matrix4.multiplyByScale(modelMatrix, new Cesium.Cartesian3(properties.scale || 1, properties.scale || 1, properties.scale || 1), modelMatrix);
        Cesium.Matrix4.multiplyByMatrix3(modelMatrix, hRotation, modelMatrix);
        Cesium.Matrix4.multiplyByMatrix3(modelMatrix, vRotation, modelMatrix);
        Cesium.Matrix4.multiplyByMatrix3(modelMatrix, lRotation, modelMatrix); // Aplica la rotación lateral

        Cesium.Model.fromGltfAsync({
          url: filePath,
          modelMatrix: modelMatrix,
          minimumPixelSize: properties.minimumPixelSize || 128,
          clampToGround: isClampToGround,
          enableDracoDecompression: true
        }).then(loadedModel => {
          loadedModel.depthTestAgainstTerrain = true;

          cesiumViewer.scene.primitives.add(loadedModel);
          cesiumViewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height + 500),
            duration: 2
          });
          model = loadedModel;
          origin = modelPosition;
          updateCoordinateTable(modelPosition);
          enableModelDragging();
          //reloadModelButton.disabled = false;
          isLocked = properties.minimumPixelSize === 1;
          lockButton.checked = isLocked;
          if (isLocked) {
            cesiumViewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
          }
        }).catch(error => {
          console.error('Error loading GLTF/GLB file:', error);
          showMessage('Error loading 3D model.', 'is-danger');
        });
      })
      .catch(error => {
        console.error('GeoJSON file not found, loading model at default position');
        showMessage('GeoJSON configuration not found. Loading model at default position.', 'is-warning');

        const defaultPosition = Cesium.Cartesian3.fromDegrees(18.643501, 60.128161, 200); // Centrando en Suecia
        const defaultModelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(defaultPosition);

        Cesium.Model.fromGltfAsync({
          url: filePath,
          modelMatrix: defaultModelMatrix,
          minimumPixelSize: 128,
          clampToGround: isClampToGround,
          scale: 1.0
        }).then(loadedModel => {
          cesiumViewer.scene.primitives.add(loadedModel);
          cesiumViewer.camera.flyTo({
            destination: defaultPosition,
            duration: 2
          });
          model = loadedModel;
          origin = defaultPosition;
          updateCoordinateTable(defaultPosition);
          enableModelDragging();
          //reloadModelButton.disabled = true;
          lockButton.checked = false;
        }).catch(error => {
          console.error('Error loading GLTF/GLB file:', error);
          showMessage('Error loading 3D model.', 'is-danger');
        });
      });
  }

  // Función para habilitar configuraciones del modelo
  function enableModelConfiguration(enable) {
    const lockButton = document.getElementById('lockButton');
    //const reloadModelButton = document.getElementById('reloadModelButton');

    if (lockButton) {
      lockButton.disabled = !enable;
      //reloadModelButton.disabled = !enable;
    }
  }

  // Función para deshabilitar configuraciones del modelo
  function disableModelConfiguration() {
    enableModelConfiguration(false);
  }


  // Función para habilitar el arrastre del modelo
  function enableModelDragging() {
    const scene = cesiumViewer.scene;
    const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

    handler.setInputAction(function (click) {
      const pickedObject = scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.primitive === model && !isLocked) {
        handler.setInputAction(function (movement) {
          const ray = cesiumViewer.camera.getPickRay(movement.endPosition);
          const cartesian = cesiumViewer.scene.globe.pick(ray, cesiumViewer.scene);
          if (Cesium.defined(cartesian)) {
            const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(cartesian);

            // Aplicar las escalas
            Cesium.Matrix4.multiplyByScale(modelMatrix, new Cesium.Cartesian3(scaleInput.value, scaleInput.value, scaleInput.value), modelMatrix);

            // Aplicar las rotaciones (horizontal, vertical, lateral)
            const hRotationMatrix = Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(horizontalRotationInput.value));
            const vRotationMatrix = Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(verticalRotationInput.value));
            const lRotationMatrix = Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(lateralRotationInput.value));

            // Combina las rotaciones y aplícalas al modelo
            let rotationMatrix = Cesium.Matrix3.multiply(hRotationMatrix, vRotationMatrix, new Cesium.Matrix3());
            rotationMatrix = Cesium.Matrix3.multiply(rotationMatrix, lRotationMatrix, new Cesium.Matrix3());
            Cesium.Matrix4.multiplyByMatrix3(modelMatrix, rotationMatrix, modelMatrix);

            // Aplicar la nueva matriz al modelo
            model.modelMatrix = modelMatrix;

            // Actualizar la posición y configuración
            updateCoordinateTable(cartesian);
            origin = cartesian; // Actualizar la nueva posición
            updateModelConfiguration(); // Guardar la configuración con la nueva posición y rotaciones
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    handler.setInputAction(function () {
      handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }, Cesium.ScreenSpaceEventType.LEFT_UP);
  }

  function updateCoordinateTable(cartesian) {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    xCoordinateInput.value = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
    yCoordinateInput.value = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
    zCoordinateInput.value = cartographic.height.toFixed(2);
  }


  // Función para actualizar la altura del terreno en función de la posición del mouse
  function updateTerrainHeight(movement) {
    const scene = cesiumViewer.scene;
    const ray = cesiumViewer.camera.getPickRay(movement.endPosition);
    const cartesian = scene.globe.pick(ray, scene);

    if (Cesium.defined(cartesian)) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const terrainHeight = cartographic.height; // Obtener la altura del terreno

      // Actualizar el input con la altura del terreno
      terrainHeightInput.value = terrainHeight.toFixed(2) + ' m';
    } else {
      // Si el terreno no está definido (por ejemplo, si el mouse está sobre el cielo)
      terrainHeightInput.value = 'No terrain';
    }
  }

  // Función para manejar el scroll del ratón en los inputs
  function handleScroll(event) {
    event.preventDefault(); // Evita que la página se desplace

    const input = event.target;
    let value = parseFloat(input.value) || 0;

    // Calcula la cantidad de incremento/decremento basado en la precisión actual
    const precision = input.value.split('.')[1]?.length || 0; // Mantén el número de decimales actual
    const step = Math.pow(10, -precision); // Incremento/decremento basado en la precisión

    if (event.deltaY < 0) {
      // Scroll hacia arriba - Incrementar
      value += step;
    } else {
      // Scroll hacia abajo - Decrementar
      value -= step;
    }

    input.value = value.toFixed(precision); // Mantén el número de decimales

    applyModelTransformations(); // Aplicar transformaciones al modelo
    updateModelConfiguration(); // Actualizar configuración del modelo
  }

  // Añadir evento de scroll a los inputs de coordenadas
  xCoordinateInput.addEventListener('wheel', handleScroll);
  yCoordinateInput.addEventListener('wheel', handleScroll);
  zCoordinateInput.addEventListener('wheel', handleScroll);

  // Función para aplicar transformaciones al modelo
  function applyModelTransformations() {
    if (!model) return;

    const longitude = parseFloat(xCoordinateInput.value);
    const latitude = parseFloat(yCoordinateInput.value);
    const height = parseFloat(zCoordinateInput.value);

    const scale = parseFloat(scaleInput.value);
    const hRotation = parseFloat(horizontalRotationInput.value);
    const vRotation = parseFloat(verticalRotationInput.value);
    const lRotation = parseFloat(lateralRotationInput.value);

    // 1) Crear la posición
    const modelPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
    // 2) Crear la matriz base
    const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(modelPosition);

    // 3) Escala
    Cesium.Matrix4.multiplyByUniformScale(modelMatrix, scale, modelMatrix);

    // 4) Rotaciones
    const hRotationMatrix = Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(hRotation));
    const vRotationMatrix = Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(vRotation));
    const lRotationMatrix = Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(lRotation));

    let rotationMatrix = Cesium.Matrix3.multiply(hRotationMatrix, lRotationMatrix, new Cesium.Matrix3());
    rotationMatrix = Cesium.Matrix3.multiply(rotationMatrix, vRotationMatrix, new Cesium.Matrix3());

    Cesium.Matrix4.multiplyByMatrix3(modelMatrix, rotationMatrix, modelMatrix);

    // 5) Asignar a 'model'
    model.modelMatrix = modelMatrix;

    // 6) Actualizar la variable 'origin'
    origin = modelPosition;
  }


  // Función para cargar la lista de archivos
  function loadFiles() {
    fetch('/data/api/files')
      .then(response => response.json())
      .then(data => {
        //const fileList2D = document.getElementById('fileList2D');
        const fileList3D = document.getElementById('fileList3D');
        const fileListTerrain = document.getElementById('fileListTerrain'); // Añadir una lista de terrenos
        const fileList3Dtiles = document.getElementById('fileList3Dtiles');
        //fileList2D.innerHTML = '';
        fileList3D.innerHTML = '';
        fileListTerrain.innerHTML = ''; // Limpiar la lista de terrenos
        fileList3Dtiles.innerHTML = '';

        /* data.files2D.forEach(file => {
          addFileToList(file, fileList2D);
        }); */

        data.files3D.forEach(file => {
          if (!file.name.endsWith('.geojson')) {
            addFileToList(file, fileList3D);
          }
        });

        data.filesTerrain.forEach(file => { // Cargar la lista de terrenos
          addFileToList(file, fileListTerrain);
        });

        data.files3Dtiles.forEach(file => { // Cargar la lista de 3Dtiles
          addFileToList(file, fileList3Dtiles);
        });
      })
      .catch(error => {
        console.error('Load files error:', error);
        showMessage('Error loading files.', 'is-danger');
      });
  }

  // Función para añadir archivos a la lista
  function addFileToList(file, container) {
    const listItem = document.createElement('div');
    listItem.className = 'box';
    const fileName = file.name;
    const media = document.createElement('article');
    media.className = 'media';

    const mediaLeft = document.createElement('div');
    mediaLeft.className = 'media-left';

    const mediaContent = document.createElement('div');
    mediaContent.className = 'media-content';
    const content = document.createElement('div');
    const fileNameElement = document.createElement('strong');
    fileNameElement.textContent = fileName;
    content.appendChild(fileNameElement);
    mediaContent.appendChild(content);

    media.appendChild(mediaLeft);
    media.appendChild(mediaContent);

    const buttons = document.createElement('div');
    buttons.className = 'buttons';

    const deleteButton = createButton('Delete', 'is-danger');
    deleteButton.onclick = () => deleteFile(file.name, file.type); // Corregido aquí

    buttons.appendChild(deleteButton);

    // Solo mostrar el botón de descarga si no es tipo 'terrain'
    if (file.type !== 'terrain') {
      const downloadButton = createButton('Download', 'is-info');
      downloadButton.onclick = () => downloadFile(file.name, file.type);
      buttons.appendChild(downloadButton);
    }

    if (file.type === 'terrain') {
      const viewButton = createButton('View', 'is-success');
      viewButton.onclick = () => viewTerrain(file.name);
      buttons.appendChild(viewButton);
    }

    if (file.type === '3d') {
      const viewButton = createButton('View', 'is-success');
      viewButton.onclick = () => viewFile(file.name);
      buttons.appendChild(viewButton);
    }

    // ... dentro de addFileToList ...
    /* if (file.type === '2d') {
      const viewImgButton = createButton('View', 'is-success');
      viewImgButton.onclick = () => viewImage(file.name);
      buttons.appendChild(viewImgButton);
    } */


    if (file.type === '3Dtiles') {
      const viewButton = createButton('View', 'is-success');
      viewButton.onclick = () => viewTiles(file.name); // Función distinta
      buttons.appendChild(viewButton);
    }

    listItem.appendChild(media);
    listItem.appendChild(buttons);
    container.appendChild(listItem);
  }


  // Función para crear botones
  function createButton(text, className) {
    const button = document.createElement('button');
    button.className = `button ${className}`;
    button.textContent = text;
    return button;
  }

  // Función para eliminar archivos
  function deleteFile(fileName, type) {
    fetch(`/data/api/files/${fileName}?type=${type}`, { method: 'DELETE' })
      .then(response => {
        // Verifica si la respuesta es JSON o un error
        if (!response.ok) {
          // Si no es una respuesta exitosa (2xx), intenta leerla como texto plano
          return response.text().then(text => {
            throw new Error(text || 'Error deleting file');
          });
        }
        return response.json();
      })
      .then(result => {
        console.log('Delete result:', result);
        showMessage('File deleted successfully', 'is-success');

        // Si es un terreno, eliminar el directorio completo
        if (type === 'terrain') {
          const terrainFolderPath = fileName;  // No necesitas agregar `/data/terrain/` aquí
          fetch(`/data/api/files/${terrainFolderPath}?type=terrain`, { method: 'DELETE' })
            .then(() => {
              loadFiles(); // Recargar la lista de archivos después de eliminar
            })
            .catch(error => {
              console.error('Error deleting terrain file:', error);
              showMessage('Error deleting terrain file: ' + error.message, 'is-danger');
            });
        } else {
          loadFiles(); // Recargar la lista de archivos
        }
      })
      .catch(error => {
        console.error('Delete error:', error);
        showMessage('Error deleting file: ' + error.message, 'is-danger');
      });
  }



  // Función para cargar o crear la configuración del modelo
  function loadOrCreateConfiguration(fileName) {
    const modelName = fileName.split('.').slice(0, -1).join('.'); // Elimina la extensión del archivo
    const configPath = `/data/api/positions/${modelName}.geojson`;

    fetch(configPath)
      .then(response => {
        if (!response.ok) {
          const defaultConfig = {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [0, 0, 0] },
                properties: {
                  name: modelName || '3d-modells', // Usa el nombre sin la extensión
                  scale: 1,
                  minimumPixelSize: 128,
                  horizontalRotation: 0,
                  verticalRotation: 0,
                  lateralRotation: 0
                }
              }
            ]
          };
          return fetch(`/data/api/savePosition/${modelName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(defaultConfig)
          }).then(() => defaultConfig);
        }
        return response.json();
      })
      .then(data => {
        if (data) {
          xCoordinateInput.value = data.features[0].geometry.coordinates[0];
          yCoordinateInput.value = data.features[0].geometry.coordinates[1];
          zCoordinateInput.value = data.features[0].geometry.coordinates[2];
          scaleInput.value = data.features[0].properties.scale;
          horizontalRotationInput.value = data.features[0].properties.horizontalRotation;
          verticalRotationInput.value = data.features[0].properties.verticalRotation;
          lateralRotationInput.value = data.features[0].properties.lateralRotation;
        }
      })
      .catch(error => console.error('Error loading or creating configuration:', error));
  }

  // Función para recargar el modelo



  // Función para bloquear/desbloquear el modelo
  // Bloquear/Desbloquear el modelo
  lockButton.addEventListener('change', async function () {
    if (this.checked) {
      minimumPixelSize = 1;
      isLocked = true;
    } else {
      minimumPixelSize = 128;
      isLocked = false;
    }

    try {
      // Esperar a que se termine de actualizar la configuración en el servidor
      async function updateModelConfigurationAsync() {
        if (model && origin) {
          const cartographic = Cesium.Cartographic.fromCartesian(origin);
          const position = {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [
                    Cesium.Math.toDegrees(cartographic.longitude),
                    Cesium.Math.toDegrees(cartographic.latitude),
                    cartographic.height
                  ]
                },
                properties: {
                  name: currentFileName || '3d-modells',
                  scale: parseFloat(scaleInput.value),
                  minimumPixelSize: isLocked ? 1 : 128,
                  horizontalRotation: parseFloat(horizontalRotationInput.value),
                  verticalRotation: parseFloat(verticalRotationInput.value),
                  lateralRotation: parseFloat(lateralRotationInput.value)
                }
              }
            ]
          };

          const positionPath = `/data/api/savePosition/${currentFileName}`;

          const response = await fetch(positionPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(position)
          });

          if (!response.ok) {
            throw new Error(`Failed to save position. HTTP ${response.status}`);
          }

          const result = await response.json();
          console.log('Configuration updated:', result);
          showMessage('Configuration updated successfully', 'is-success');
        }
      }

    } catch (error) {
      console.error('Error updating lock state:', error);
    }
  });

  // Añadir eventos de input para actualizar la configuración del modelo
  xCoordinateInput.addEventListener('input', () => {
    applyModelTransformations();       // 1) Mover el modelo en Cesium en tiempo real
    updateModelConfiguration();       // 2) Guardar la nueva posición en el .geojson
  });

  yCoordinateInput.addEventListener('input', () => {
    applyModelTransformations();
    updateModelConfiguration();
  });
  zCoordinateInput.addEventListener('input', () => {
    applyModelTransformations();       // 1) Mover el modelo en Cesium en tiempo real
    updateModelConfiguration();       // 2) Guardar la nueva posición en el .geojson
  });

  zCoordinateInput.addEventListener('input', () => {
    applyModelTransformations();
    updateModelConfiguration();
  });

  scaleInput.addEventListener('input', () => {
    applyModelTransformations();       // 1) Mover el modelo en Cesium en tiempo real
    updateModelConfiguration();       // 2) Guardar la nueva posición en el .geojson
  });

  horizontalRotationInput.addEventListener('input', () => {
    applyModelTransformations();
    updateModelConfiguration();
  });
  verticalRotationInput.addEventListener('input', () => {
    applyModelTransformations();       // 1) Mover el modelo en Cesium en tiempo real
    updateModelConfiguration();       // 2) Guardar la nueva posición en el .geojson
  });

  lateralRotationInput.addEventListener('input', () => {
    applyModelTransformations();
    updateModelConfiguration();
  });

  // Inicializar la carga de la lista de archivos
  loadFiles();
});



// Función para eliminar archivos
function deleteFile(fileName, type) {
  fetch(`/data/api/files/${fileName}?type=${type}`, { method: 'DELETE' })
    .then(response => {
      // Verifica si la respuesta es JSON o un error
      if (!response.ok) {
        // Si no es una respuesta exitosa (2xx), intenta leerla como texto plano
        return response.text().then(text => {
          throw new Error(text || 'Error deleting file');
        });
      }
      return response.json();
    })
    .then(result => {
      console.log('Delete result:', result);
      showMessage('File deleted successfully', 'is-success');

      // Si es un terreno, eliminar el directorio completo
      if (type === 'terrain') {
        const terrainFolderPath = fileName;  // No necesitas agregar `/data/terrain/` aquí
        fetch(`/data/api/files/${terrainFolderPath}?type=terrain`, { method: 'DELETE' })
          .then(() => {
            loadFiles(); // Recargar la lista de archivos después de eliminar
          })
          .catch(error => {
            console.error('Error deleting terrain file:', error);
            showMessage('Error deleting terrain file: ' + error.message, 'is-danger');
          });
      } else {
        loadFiles(); // Recargar la lista de archivos
      }
    })
    .catch(error => {
      console.error('Delete error:', error);
      showMessage('Error deleting file: ' + error.message, 'is-danger');
    });
}


function showMessage(message, type, duration = 2000) {
  const messageBox = document.createElement('div');
  messageBox.className = `notification ${type}`;
  messageBox.textContent = message;

  const modalContent = document.querySelector('.modal-content');
  modalContent.insertBefore(messageBox, modalContent.firstChild);

  setTimeout(() => {
    messageBox.remove();
  }, duration);
}



