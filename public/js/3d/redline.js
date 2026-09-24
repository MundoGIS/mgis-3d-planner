

function openSaveDrawingModal() {
  console.log('Botón de guardar dibujo clickeado'); // Añade esta línea
  document.getElementById('saveDrawingModal').classList.add('is-active');
}

// Función para cerrar el modal de guardar dibujo
function closeSaveDrawingModal() {
  document.getElementById('saveDrawingModal').classList.remove('is-active');
}

// Función para guardar el dibujo actual
async function saveCurrentDrawing() {
  const drawingName = document.getElementById('drawingNameInput').value;
  if (!drawingName) {
    alert('Please enter a name for the drawing.');
    return;
  }

  const drawingEntities = [];
  const entities = cesiumViewer.entities.values;

  console.log('Todas las entidades en el viewer:', entities); // Añade esta línea

  for (const entity of entities) {
    if (entity.polyline || entity.polygon || entity.point || entity.label || entity.ellipse || entity.model) {
      drawingEntities.push(entity);
    }
  }

  console.log('Entidades de dibujo encontradas:', drawingEntities); // Añade esta línea

  if (drawingEntities.length === 0) {
    alert('No drawings to save.');
    closeSaveDrawingModal();
    return;
  }

  const features = [];
  for (const entity of drawingEntities) {
    let geometry = [];
    let properties = {};

    console.log('Procesando entidad:', entity); // Añade esta línea

    if (entity.polyline) {
      console.log('Es una polilínea. Propiedades:', entity.polyline); // Añade esta línea
      const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
      console.log('Posiciones de la polilínea antes del filtro:', positions); // Añade esta línea
      const definedPositions = positions.filter(position => Cesium.defined(position));
      console.log('Posiciones definidas de la polilínea:', definedPositions); // Añade esta línea
      const coordinates = definedPositions
        .map(cartesian => {
          console.log('Cartesian antes de fromCartesian (polyline):', cartesian); // Añade esta línea
          return Cesium.Cartographic.fromCartesian(cartesian);
        })
        .filter(cartographic => Cesium.defined(cartographic))
        .map(cartographic => [
          Cesium.Math.toDegrees(cartographic.longitude),
          Cesium.Math.toDegrees(cartographic.latitude),
          cartographic.height
        ]);
      geometry = { type: 'LineString', coordinates: coordinates };
      properties = {
        color: entity.polyline.material.color.getValue(Cesium.JulianDate.now()).toCssColorString(),
        width: entity.polyline.width.getValue(),
        style: entity.polyline.material.hasOwnProperty('dashPattern') ? 'dashed' : 'solid'
      };
    } else if (entity.polygon) {
      console.log('Es un polígono. Propiedades:', entity.polygon); // Añade esta línea
      const hierarchy = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
      console.log('Jerarquía del polígono antes del filtro:', hierarchy); // Añade esta línea
      if (hierarchy && hierarchy.positions) {
        console.log('Posiciones de la jerarquía del polígono antes del filtro:', hierarchy.positions); // Añade esta línea
        const definedPositions = hierarchy.positions.filter(position => Cesium.defined(position));
        console.log('Posiciones definidas del polígono:', definedPositions); // Añade esta línea

        // Inspeccionar cada posición individualmente
        definedPositions.forEach((position, index) => {
          console.log(`Posición ${index}:`, position); // Añade esta línea
          if (position) {
            console.log(`  x: ${position.x}, y: ${position.y}, z: ${position.z}`); // Intenta acceder a las propiedades
            console.log(`  toString(): ${position.toString()}`); // Ver la representación en string
          } else {
            console.log(`  La posición ${index} es null o undefined.`);
          }
        });

        const coordinates = definedPositions
          .map(cartesian => {
            console.log('Cartesian antes de fromCartesian (polygon):', cartesian); // Añade esta línea
            return Cesium.Cartographic.fromCartesian(cartesian);
          })
          .filter(cartographic => Cesium.defined(cartographic))
          .map(cartographic => [
            Cesium.Math.toDegrees(cartographic.longitude),
            Cesium.Math.toDegrees(cartographic.latitude),
            cartographic.height || 0 // Añade altura si está disponible
          ]);

        // Asegurar que el polígono esté cerrado añadiendo la primera coordenada al final si no está ya
        if (coordinates.length > 0) {
          const firstCoordinate = coordinates[0];
          const lastCoordinate = coordinates[coordinates.length - 1];
          // Comparar si la primera y la última coordenada son diferentes
          if (firstCoordinate[0] !== lastCoordinate[0] || firstCoordinate[1] !== lastCoordinate[1] || firstCoordinate[2] !== lastCoordinate[2]) {
            coordinates.push([...firstCoordinate]); // Añadir una copia de la primera coordenada
          }
        }

        geometry = { type: 'Polygon', coordinates: [coordinates] };
        properties = {
          color: entity.polygon.material.color.getValue(Cesium.JulianDate.now()).toCssColorString(),
        };
        if (Cesium.defined(entity.polygon.extrudedHeight)) {
          properties.extrudedHeight = entity.polygon.extrudedHeight.getValue();
        }
      }
    } else if (entity.point) {
      const position = Cesium.Cartographic.fromCartesian(entity.position.getValue(Cesium.JulianDate.now()));
      geometry = {
        type: 'Point',
        coordinates: [
          Cesium.Math.toDegrees(position.longitude),
          Cesium.Math.toDegrees(position.latitude),
          position.height
        ]
      };
      properties = {
        color: entity.point.color.getValue(Cesium.JulianDate.now()).toCssColorString(),
        pixelSize: entity.point.pixelSize.getValue(),
        height: entity.position.getValue(Cesium.JulianDate.now()).z // Obtener la altura
      };
    } else if (entity.label) {
      const position = Cesium.Cartographic.fromCartesian(entity.position.getValue(Cesium.JulianDate.now()));
      geometry = {
        type: 'Point',
        coordinates: [
          Cesium.Math.toDegrees(position.longitude),
          Cesium.Math.toDegrees(position.latitude),
          position.height
        ]
      };
      properties = {
        text: entity.label.text.getValue(),
        color: entity.label.fillColor.getValue(Cesium.JulianDate.now()).toCssColorString(),
        size: entity.label.font.getValue().match(/(\d+)px/)?.[1]
      };
    } else if (entity.ellipse) {
      const position = Cesium.Cartographic.fromCartesian(entity.position.getValue(Cesium.JulianDate.now()));
      geometry = {
        type: 'Point',
        coordinates: [
          Cesium.Math.toDegrees(position.longitude),
          Cesium.Math.toDegrees(position.latitude),
          position.height
        ]
      };
      properties = {
        color: entity.ellipse.material.color.getValue(Cesium.JulianDate.now()).toCssColorString(),
        radius: entity.ellipse.semiMajorAxis.getValue() // Suponiendo que es un círculo
      };
    } else if (entity.model) {
      console.log('GUARDANDO: Procesando entidad de modelo:', entity.id); // <-- LOG

      console.log('Es un modelo GLTF. Propiedades:', entity.model);
      const position = entity.position.getValue(Cesium.JulianDate.now());
      const cartographicPosition = Cesium.Cartographic.fromCartesian(position);
      const longitude = Cesium.Math.toDegrees(cartographicPosition.longitude);
      const latitude = Cesium.Math.toDegrees(cartographicPosition.latitude);
      const height = cartographicPosition.height;
      const modelUrl = entity.model.uri.getValue();
      console.log('GUARDANDO: URL del modelo obtenida:', modelUrl); // <-- LOG
      if (!modelUrl) {
        console.error('GUARDANDO: ¡URL del modelo está vacía!', entity.id); // <-- ERROR LOG
      }

      geometry = { type: 'Model', coordinates: [longitude, latitude, height] };
      properties = {
        gltfModelUrl: modelUrl,
        scale: entity.model.scale ? entity.model.scale.getValue() : 1.0,
        minimumPixelSize: entity.model.minimumPixelSize ? entity.model.minimumPixelSize.getValue() : 0,
        maximumScale: entity.model.maximumScale ? entity.model.maximumScale.getValue() : 1.0,
      };
    }

    if (geometry) {
      features.push({ type: 'Feature', geometry: geometry, properties: properties });
    }
  }

  const geojson = { type: 'FeatureCollection', features: features };

  try {
    const response = await fetch('/3d/api/save-drawing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: drawingName, geojson: geojson }),
    });

    const data = await response.json();
    alert(data.message);
    closeSaveDrawingModal();
  } catch (error) {
    console.error('Error saving drawing:', error);
    alert('Failed to save drawing.');
  }
}

//showing drawings

// Función para abrir el modal de cargar dibujo
function openLoadDrawingModal() {
  console.log('Botón de cargar dibujo clickeado');
  document.getElementById('loadDrawingModal').classList.add('is-active');
  loadDrawingList(); // Cargar la lista de dibujos al abrir el modal
}

// Función para cerrar el modal de cargar dibujo
function closeLoadDrawingModal() {
  document.getElementById('loadDrawingModal').classList.remove('is-active');
}

// Función para cargar la lista de dibujos guardados desde el servidor
async function loadDrawingList() {
  const savedDrawingsListDiv = document.getElementById('savedDrawingsList');
  savedDrawingsListDiv.innerHTML = '<p>Loading drawing list...</p>';
  try {
    const response = await fetch('/3d/api/load-drawings');
    console.log('Server response:', response); // Added this line
    const data = await response.json();
    console.log('Data received from server:', data); // Added this line
    if (data.drawings && data.drawings.length > 0) {
      savedDrawingsListDiv.innerHTML = '';
      const ul = document.createElement('ul');
      data.drawings.forEach(drawingName => {
        console.log('Drawing name in loop:', drawingName); // Added this line
        const li = document.createElement('li');

        const loadButton = document.createElement('button');
        loadButton.textContent = drawingName;
        loadButton.classList.add('button', 'is-small');
        loadButton.style.marginBottom = '5px';
        loadButton.onclick = () => loadSelectedDrawing(drawingName);
        li.appendChild(loadButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('button', 'is-small', 'is-danger');
        deleteButton.style.marginBottom = '5px';
        deleteButton.style.marginLeft = '5px';
        deleteButton.onclick = () => confirmDeleteDrawing(drawingName);
        li.appendChild(deleteButton);

        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download';
        downloadButton.classList.add('button', 'is-small', 'is-info');
        downloadButton.style.marginBottom = '5px';
        downloadButton.style.marginLeft = '5px';
        downloadButton.onclick = () => downloadDrawing(drawingName); // Calls the download function
        li.appendChild(downloadButton);

        const divButtons = document.createElement('div');
        divButtons.classList.add('buttons');
        divButtons.appendChild(loadButton);
        divButtons.appendChild(deleteButton);
        divButtons.appendChild(downloadButton);
        li.appendChild(divButtons);

        ul.appendChild(li);
      });
      savedDrawingsListDiv.appendChild(ul);
    } else {
      savedDrawingsListDiv.innerHTML = '<p>No saved drawings found.</p>';
    }
  } catch (error) {
    console.error('Error loading the drawing list:', error);
    savedDrawingsListDiv.innerHTML = '<p>Error loading the drawing list.</p>';
  }
}


// Función para descargar el dibujo como GeoJSON
async function downloadDrawing(drawingName) {
  try {
    const response = await fetch(`/3d/api/load-drawings?name=${encodeURIComponent(drawingName)}`);
    const data = await response.json();
    if (data && data.geojson) {
      const geojsonString = JSON.stringify(data.geojson, null, 2);
      const blob = new Blob([geojsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${drawingName}.geojson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      alert('Error retrieving the drawing for download.');
    }
  } catch (error) {
    console.error('Error downloading the drawing:', error);
    alert('Error downloading the drawing.');
  }
}


// Función para confirmar la eliminación del dibujo
function confirmDeleteDrawing(drawingName) {
  if (confirm('Are you sure you want to delete this drawing?')) {
    deleteDrawing(drawingName);
  }
}

// Función para eliminar el dibujo del servidor
async function deleteDrawing(drawingName) {
  try {
    const response = await fetch(`/3d/api/delete-drawing?name=${encodeURIComponent(drawingName)}`, {
      method: 'DELETE',
    });

    const data = await response.json();
    if (data.success) {
      alert(`Drawing "${drawingName}" deleted.`);
      loadDrawingList(); // Recargar la lista de dibujos después de eliminar
    } else {
      alert(`Error deleting drawing "${drawingName}": ${data.message}`);
    }
  } catch (error) {
    console.error('Error al eliminar el dibujo:', error);
    alert(`Error deleting drawing "${drawingName}".`);
  }
}

// Función para cargar el dibujo seleccionado desde el servidor y añadirlo al mapa
async function loadSelectedDrawing(drawingName) {
  try {
    const response = await fetch(`/3d/api/load-drawings?name=${encodeURIComponent(drawingName)}`);
    const data = await response.json();
    if (data && data.geojson && data.geojson.features) {
      addGeoJsonToMap(data.geojson);
      closeLoadDrawingModal();
      alert(`Drawing "${drawingName}" loaded.`);
    } else {
      alert('Error loading the selected drawing.');
    }
  } catch (error) {
    console.error('Error loading the selected drawing:', error);
    alert('Error loading the selected drawing.');
  }
}


// Función para añadir features de GeoJSON al mapa de Cesium
function addGeoJsonToMap(geojson) {
  geojson.features.forEach(feature => {
    const geometryType = feature.geometry.type;
    const coordinates = feature.geometry.coordinates;
    const properties = feature.properties || {};

    if (geometryType === 'LineString') {
      const positions = coordinates.map(coord => Cesium.Cartesian3.fromDegrees(coord[0], coord[1], coord[2] || 0));
      let alpha = 1.0;
      if (properties.transparency !== undefined) {
        const parsedTransparency = parseFloat(properties.transparency);
        if (!isNaN(parsedTransparency)) {
          alpha = parsedTransparency;
        }
      } else if (lineTransparency !== undefined) {
        const parsedLineTransparency = parseFloat(lineTransparency);
        if (!isNaN(parsedLineTransparency)) {
          alpha = parsedLineTransparency;
        }
      }
      cesiumViewer.entities.add({
        polyline: {
          positions: positions,
          material: Cesium.Color.fromCssColorString(properties.color || lineColor).withAlpha(alpha),
          width: properties.width || lineWidth,
          clampToGround: true,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, properties.zoom || lineZoom)
        }
      });
    } else if (geometryType === 'Polygon') {
      const rings = coordinates.map(ring => ring.map(coord => Cesium.Cartesian3.fromDegrees(coord[0], coord[1], coord[2] || 0)));
      let alpha = 1.0;
      if (properties.transparency !== undefined) {
        const parsedTransparency = parseFloat(properties.transparency);
        if (!isNaN(parsedTransparency)) {
          alpha = parsedTransparency;
        }
      } else if (polygonTransparency !== undefined) {
        const parsedPolygonTransparency = parseFloat(polygonTransparency);
        if (!isNaN(parsedPolygonTransparency)) {
          alpha = parsedPolygonTransparency;
        }
      }
      cesiumViewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(rings[0], rings.slice(1).map(r => new Cesium.PolygonHierarchy(r))),
          material: Cesium.Color.fromCssColorString(properties.color || polygonColor).withAlpha(alpha),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          extrudedHeight: properties.extrudedHeight,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, properties.zoom || polygonZoom)
        }
      });
    } else if (geometryType === 'Point') {
      let alpha = 1.0;
      if (properties.transparency !== undefined) {
        const parsedTransparency = parseFloat(properties.transparency);
        if (!isNaN(parsedTransparency)) {
          alpha = parsedTransparency;
        }
      } else if (pointTransparency !== undefined) {
        const parsedPointTransparency = parseFloat(pointTransparency);
        if (!isNaN(parsedPointTransparency)) {
          alpha = parsedPointTransparency;
        }
      }
      cesiumViewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1], coordinates[2] || 0),
        point: {
          color: Cesium.Color.fromCssColorString(properties.color || pointColor).withAlpha(alpha),
          pixelSize: properties.pixelSize || pointSize,
          heightReference: properties.height === 0 ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, properties.zoom || pointZoom)
        }
      });
    } else if (geometryType === 'Label') {
      cesiumViewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1], coordinates[2] || 0),
        label: {
          text: properties.text || textValue,
          font: `${properties.size || textSize}px sans-serif`,
          fillColor: Cesium.Color.fromCssColorString(properties.color || textColor).withAlpha(parseFloat(properties.transparency || textTransparency)),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, properties.zoom || textZoom),
          heightReference: properties.height === 0 ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE
        }
      });
    } else if (geometryType === 'Ellipse') {
      cesiumViewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1], coordinates[2] || 0),
        ellipse: {
          semiMajorAxis: properties.radius || circleRadius,
          semiMinorAxis: properties.radius || circleRadius,
          material: Cesium.Color.fromCssColorString(properties.color || circleColor).withAlpha(parseFloat(properties.transparency || circleTransparency)),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, properties.zoom || circleZoom)
        }
      });
    } else if (geometryType === 'Model') {
      const longitude = coordinates[0];
      const latitude = coordinates[1];
      const height = coordinates[2] || 0;
      const modelUrl = properties.gltfModelUrl;
      const scale = properties.scale || 1.0;
      const minimumPixelSize = properties.minimumPixelSize || 0;
      const maximumScale = properties.maximumScale || 1.0;

      if (modelUrl) {
        cesiumViewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
          model: {
            uri: modelUrl,
            scale: scale,
            minimumPixelSize: minimumPixelSize,
            maximumScale: maximumScale,
            allowPicking: true
          },
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 50000.0) // Ajusta la distancia si es necesario
        });
      }
    }
    // Puedes añadir más tipos de geometría si es necesario
  });
}



// Remover el doble clic predeterminado en Cesium
cesiumViewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
window.selectedModel = null;
var handler;
var activeTool = null;
var activeShapePoints = [];
var activeShape;
var floatingPoint;
var pointColor = "#FF0000";
var pointHeight = 0;
var pointSize = 10;
var pointZoom = 1000;
var pointTransparency = 1;
var lineColor = "#0000FF";
var lineWidth = 3;
var lineStyle = "solid";
var lineZoom = 1000;
var lineTransparency = 1;
var polygonColor = "#00FF00";
var polygonZoom = 1000;
var polygonTransparency = 1;
var extrudedColor = "#FFA500";
var extrudedHeight = 5;
var extrudedZoom = 1000;
var extrudedTransparency = 1;
var textColor = "#FFFFFF";
var textHeight = 0;
var textSize = 20;
var textValue = "Sample Text";
var textZoom = 1000;
var textTransparency = 1;
var circleColor = "#FF69B4";
var circleRadius = 1000;
var circleZoom = 1000;
var circleTransparency = 1;
var activeVertexEntities = []; 


window.toggleTool = toggleTool;
window.closeDrawingTools = closeDrawingTools; // Exponer la nueva función al window

// Función para mostrar las herramientas de dibujo
function showDrawingTools() {
  var toolbarContainer = document.getElementById('toolbarContainer');
  if (toolbarContainer) {
    toolbarContainer.style.display = 'block';
  }
}

// Función para cerrar todos los diálogos de configuración de herramientas
function closeAllDialogs() {
  console.log("[DEBUG] closeAllDialogs llamado"); // Log opcional para depuración
  const dialogIds = [
    'inputDialog',
    'inputDialogModel',
    'inputDialogLine',
    'inputDialogPolygon',
    'inputDialogExtruded',
    'inputDialogText',
    // 'inputDialogRectangle', // Si tienes este diálogo, inclúyelo
    'inputDialogCircle'
    // Añade aquí los IDs de cualquier otro diálogo de configuración que tengas
  ];

  dialogIds.forEach(id => {
    const dialog = document.getElementById(id);
    if (dialog) {
      // La forma más simple es usar style.display = 'none'.
      // Esto generalmente funciona tanto para divs normales como para modales de Bulma.
      dialog.style.display = 'none';

      // Si usas modales de Bulma y quieres ser más explícito (opcional):
      // if (dialog.classList.contains('modal')) {
      //    dialog.classList.remove('is-active');
      // }
    } else {
      // Advertencia si un ID esperado no se encuentra, puede indicar un error tipográfico en la lista.
      console.warn(`[DEBUG] Diálogo con ID "${id}" no encontrado en closeAllDialogs.`);
    }
  });
}

// Función para activar/desactivar y mostrar el diálogo correcto
function toggleTool(tool) {
  console.log(`[DEBUG] toggleTool iniciado para: ${tool}`); // <-- LOG

  // Si haces clic en la misma herramienta activa, desactívala.
  if (tool === activeTool) {
    console.log(`[DEBUG] Desactivando la herramienta actual: ${tool}`);
    deactivateTool();
    closeAllDialogs(); // Cierra el diálogo al desactivar
    return;
  }

  // Desactivar herramienta anterior ANTES de activar la nueva
  deactivateTool();
  activeTool = tool; // Establece la nueva herramienta activa

  showDrawingTools(); // Asegura que la barra esté visible

  // Resalta el botón activo (opcional)
  document.getElementById(tool + 'Button')?.classList.add('is-active');

  // Mapeo de herramienta a ID de diálogo
  const dialogMap = {
    point: 'inputDialog', // <--- Asegúrate que este ID existe en tu HTML!
    gltfModel: 'inputDialogModel',
    line: 'inputDialogLine',
    polygon: 'inputDialogPolygon',
    extrudedPolygon: 'inputDialogExtruded',
    text: 'inputDialogText',
    circle: 'inputDialogCircle'
    // Añade otros si existen
  };

  if (dialogMap[tool]) {
    const dialogId = dialogMap[tool];
    console.log(`[DEBUG] Mapping found. Dialog ID: ${dialogId}`); // <-- LOG
  
    // Specific logic BEFORE opening the dialog
    if (tool === 'gltfModel') {
      loadGltfModels(); // Load models when opening its dialog
    } else if (tool === 'point') {
      // Call the function that updates the internal UI of the point dialog
      handlePointTypeChange(); // Show/hide Icon/Standard fields
      const pointType = document.querySelector('input[name="pointType"]:checked')?.value;
      if (pointType === 'icon') {
        loadAvailableIcons(); // Load icons if the icon type is selected
      }
    }
    // Open the corresponding dialog
    openDialog(dialogId);
  } else {
    console.warn(`[DEBUG] No dialog mapped for the tool: ${tool}`);
    // Handling tools without a dialog (like 'clear')
    if (tool === 'clear') {
      clearEntities();
      activeTool = null; // 'clear' does not remain active
      // No need to call deactivateTool here because it was already done at the beginning
      return;
    }
    // If a tool should have a dialog but is not in the map
    console.error(`Tool ${tool} selected but no configured dialog was found.`);
    activeTool = null; // Do not leave the tool active if configuration is missing
  }
}
  

// Función para abrir un diálogo específico (modal o div)
function openDialog(dialogId) {
  console.log(`[DEBUG] openDialog called with ID: ${dialogId}`); // <-- LOG
  closeAllDialogs(); // Close other dialogs first (GOOD PRACTICE)
  const dialog = document.getElementById(dialogId);
  console.log(`[DEBUG] Searching for element with ID: ${dialogId}. Found:`, dialog); // <-- LOG

  if (dialog) {
    // Check if it's a Bulma modal
    if (dialog.classList.contains('modal')) {
      dialog.classList.add('is-active');
      console.log(`[DEBUG] Added 'is-active' class to modal. Current classes:`, dialog.classList); // <-- LOG
    } else {
      // If not a modal, assume it's a normal div and use display
      dialog.style.display = 'block';
      console.log(`[DEBUG] Set display='block' to div.`); // <-- LOG
    }
    console.log(`[DEBUG] Dialog opened: ${dialogId}`);
  } else {
    // This error is a very likely cause if the dialog doesn't open!
    console.error(`[DEBUG] ERROR! Dialog with ID "${dialogId}" not found in the DOM.`); // <-- LOG
    alert(`Error: Configuration panel for this tool (${dialogId}) not found.`); // Inform the user
    // You might want to deactivate the tool if its dialog doesn't exist
    // deactivateTool(); // Uncomment if this is the desired behavior
  }
}


// Nueva función para cerrar las herramientas de dibujo y desactivar la herramienta activa
function closeDrawingTools() {
  deactivateTool();
  var toolbarContainer = document.getElementById('toolbarContainer');
  if (toolbarContainer) {
    toolbarContainer.style.display = 'none'; // Ocultar la barra de herramientas si lo deseas al cerrar
  }
}

// Función para desactivar la herramienta
function deactivateTool() {
  console.log("deactivateTool: Executing..."); // <-- ADD LOG
  if (activeTool) {
    document.getElementById(activeTool + 'Button')?.classList.remove('active');
  }
  activeTool = null;
  console.log("deactivateTool: Handler before destruction:", handler); // <-- ADD LOG
  if (handler) {
    handler.destroy();
    handler = null;
    console.log("deactivateTool: Handler destroyed."); // <-- ADD LOG
  } else {
    console.log("deactivateTool: No handler to destroy."); // <-- ADD LOG
  };
  activeShapePoints = [];
  activeShape = null;
  floatingPoint = null;

  // Hide all input dialogs
  const dialogs = [
    'inputDialog', 'inputDialogModel', 'inputDialogLine', 'inputDialogPolygon',
    'inputDialogExtruded', 'inputDialogText', 'inputDialogRectangle', 'inputDialogCircle'
  ];
  dialogs.forEach(dialogId => document.getElementById(dialogId).style.display = 'none');
}


// Llamar `toggleTool` al hacer clic en los botones de la barra de herramientas
const toolbar = document.getElementById('toolbar');
if (toolbar) {
  Array.from(toolbar.children).forEach(button => {
    if (button.id !== 'closeDrawingToolsButton') { // Excluir el botón de cerrar
      button.addEventListener('click', function () {
        const tool = this.id.replace('Button', '');
        toggleTool(tool);
      });
    }
  });
}

// Cargar modelos GLTF en el selector
async function loadGltfModels() {
  try {
    const response = await fetch('/3d/api/gltf-files');
    const data = await response.json();
    const modelSelect = document.getElementById('gltfModelSelect');
    modelSelect.innerHTML = '';
    data.files3D.forEach(file => {
      const option = document.createElement('option');
      option.value = `/3d/${file.name}`;
      option.text = file.name;
      modelSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading GLTF models:', error);
  }
}

// Aplicar configuración del modelo GLTF y mantener la ventana abierta
function applyModelSettings() {
  const modelUrl = document.getElementById('gltfModelSelect').value;
  if (modelUrl) {
    // Guarda el modelo seleccionado en una variable global
    window.selectedGltfModelUrl = modelUrl;
    showMessage("Click on the map to place the GLTF model.");
    activateToolHandler('gltfModel'); // Activa la herramienta para permitir la selección en el mapa
  }
}

// Modificar la función `activateTool` a `activateToolHandler` para manejar la activación de la herramienta
function activateToolHandler(tool) {
  console.log(`[DEBUG] activateToolHandler llamado para: ${tool}`); // Log
  if (handler) {
    console.log("[DEBUG] activateToolHandler: Destruyendo handler existente antes de crear uno nuevo.");
    handler.destroy();
    handler = null;
  }

  if (cesiumViewer && cesiumViewer.scene && cesiumViewer.scene.canvas) {
    handler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.scene.canvas);
  } else {
    console.error('Cesium viewer or scene not initialized');
    return;
  }

  handler.setInputAction(function (event) {
    console.log(`[DEBUG] activateToolHandler llamado para: ${tool}`); // Log

    var earthPosition = cesiumViewer.scene.pickPosition(event.position);
    if (Cesium.defined(earthPosition)) {
      if (tool === 'point') {
        createPoint(earthPosition);
      } else if (tool === 'gltfModel' && window.selectedGltfModelUrl) {
        // Coloca el modelo GLTF en la posición del clic
        createGltfModel(earthPosition, window.selectedGltfModelUrl);
        // La herramienta permanece activa para permitir más clics y añadir más modelos
      } else if (tool === 'text') {
        createText(earthPosition);
      } else if (tool === 'circle') {
        if (activeShapePoints.length === 0) {
          activeShapePoints.push(earthPosition);
          floatingPoint = createFloatingPoint(earthPosition);
          activeShape = createShape(activeShapePoints); // Para el círculo, el primer clic establece el centro
        }
      }
      else {
        if (activeShapePoints.length === 0) {
          floatingPoint = createFloatingPoint(earthPosition);
          activeShapePoints.push(earthPosition);
          var dynamicPositions = new Cesium.CallbackProperty(function () {
            return tool === 'line' ? activeShapePoints : new Cesium.PolygonHierarchy(activeShapePoints);
          }, false);
          activeShape = createShape(dynamicPositions);
        }
        activeShapePoints.push(earthPosition);
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction(function (event) {
    if (Cesium.defined(activeShape)) {
      var newPosition = cesiumViewer.scene.pickPosition(event.endPosition);
      if (Cesium.defined(newPosition)) {
        if (tool === 'circle') {
          // Para el círculo, actualiza el radio basado en la posición del mouse
          if (activeShapePoints.length > 0) {
            const center = activeShapePoints[0];
            const radius = Cesium.Cartesian3.distance(center, newPosition);
            activeShape.ellipse.semiMajorAxis = radius;
            activeShape.ellipse.semiMinorAxis = radius;
          }
        } else {
          activeShapePoints.pop();
          activeShapePoints.push(newPosition);
        }
      }
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(function (event) {
    const pickedObject = cesiumViewer.scene.pick(event.position);
    if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
      const entity = pickedObject.id;
      if (entity.model && entity.model.uri) {
        // Es un modelo GLTF, eliminarlo
        cesiumViewer.entities.remove(entity);
        showMessage("GLTF model removed.");
      } else if (entity.properties && entity.properties.isSimulation) {
        // Es una línea de simulación, eliminarla
        cesiumViewer.entities.remove(entity);
        showMessage("Simulation line removed.");
      } else if (entity.properties && entity.properties.isDrawing) { // Añadida condición para eliminar objetos de dibujo
        // Es un objeto de dibujo, eliminarlo
        cesiumViewer.entities.remove(entity);
        showMessage("Drawing object removed.");
      }
    }
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

  handler.setInputAction(function () {
    finalizeShape();
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}

// Función para cerrar el diálogo y desactivar la herramienta
function closeModelDialog() {
  console.log("closeModelDialog: Ejecutando..."); // <-- AÑADIR LOG
  document.getElementById('inputDialogModel').style.display = 'none';
  deactivateTool();
}

function createPoint(worldPosition) {
  return cesiumViewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(
      Cesium.Cartographic.fromCartesian(worldPosition).longitude * (180 / Math.PI),
      Cesium.Cartographic.fromCartesian(worldPosition).latitude * (180 / Math.PI),
      pointHeight + (pointHeight === 0 ? 0 : Cesium.Cartographic.fromCartesian(worldPosition).height)
    ),
    point: {
      color: new Cesium.Color.fromCssColorString(pointColor).withAlpha(pointTransparency),
      pixelSize: pointSize,
      heightReference: pointHeight === 0 ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, pointZoom)
    },
    properties: { // Añadir propiedad
      isDrawing: true
    }
  });
}

function createFloatingPoint(worldPosition) {
  return cesiumViewer.entities.add({
    position: worldPosition,
    point: {
      color: Cesium.Color.RED,
      pixelSize: 5,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  });
}

function createShape(positionData) {
  if (activeTool === 'line') {
    let material;
    if (lineStyle === "dashed") {
      material = new Cesium.PolylineDashMaterialProperty({
        color: new Cesium.Color.fromCssColorString(lineColor).withAlpha(lineTransparency)
      });
    } else if (lineStyle === "dotted") {
      material = new Cesium.PolylineDashMaterialProperty({
        color: new Cesium.Color.fromCssColorString(lineColor).withAlpha(lineTransparency),
        dashPattern: 255 // Makes the line dotted
      });
    } else {
      material = new Cesium.Color.fromCssColorString(lineColor).withAlpha(lineTransparency);
    }

    return cesiumViewer.entities.add({
      polyline: {
        positions: positionData,
        width: lineWidth,
        material: material,
        clampToGround: true,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, lineZoom)
      }
    });
  } else if (activeTool === 'polygon') {
    return cesiumViewer.entities.add({
      polygon: {
        hierarchy: positionData,
        material: new Cesium.Color.fromCssColorString(polygonColor).withAlpha(polygonTransparency),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, polygonZoom)
      }
    });
  } else if (activeTool === 'extrudedPolygon') {
    return cesiumViewer.entities.add({
      polygon: {
        hierarchy: positionData,
        material: new Cesium.Color.fromCssColorString(extrudedColor).withAlpha(extrudedTransparency),
        extrudedHeight: extrudedHeight,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, extrudedZoom)
      }
    });
  } else if (activeTool === 'circle') {
    entityOptions = {
      position: positionData[0],
      ellipse: {
        semiMajorAxis: circleRadius,
        semiMinorAxis: circleRadius,
        material: new Cesium.Color.fromCssColorString(circleColor).withAlpha(circleTransparency),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, circleZoom)
      }
    };
  }
  entityOptions.properties = { // Añadir propiedad
    isDrawing: true
  };
  return cesiumViewer.entities.add(entityOptions);
}

function finalizeShape() {
  if (Cesium.defined(activeShape)) {
    cesiumViewer.entities.remove(activeShape);
    var cleanedPositions = activeShapePoints.filter(function (position) {
      return Cesium.defined(position);
    });
    if (activeTool === 'rectangle') {
      var rectangleCoordinates = calculateRectangleCoordinates(cleanedPositions);
      createShape(rectangleCoordinates);
    } else {
      createShape(cleanedPositions);
    }
  }
  activeShapePoints = [];
  activeShape = null;
  cesiumViewer.entities.remove(floatingPoint);
  floatingPoint = null;
}

function calculateRectangleCoordinates(positions) {
  var firstPoint = Cesium.Cartographic.fromCartesian(positions[0]);
  var secondPoint = Cesium.Cartographic.fromCartesian(positions[1]);
  var thirdPoint = Cesium.Cartographic.fromCartesian(positions[2]);

  var width = Cesium.Cartesian3.distance(positions[0], positions[1]);
  var height = Cesium.Cartesian3.distance(positions[1], positions[2]);

  var angle = Math.atan2(secondPoint.longitude - firstPoint.longitude, secondPoint.latitude - firstPoint.latitude);

  var halfWidth = width / 2.0;
  var halfHeight = height / 2.0;

  var centerX = (firstPoint.longitude + secondPoint.longitude + thirdPoint.longitude) / 3.0;
  var centerY = (firstPoint.latitude + secondPoint.latitude + thirdPoint.latitude) / 3.0;

  var center = new Cesium.Cartesian3(centerX, centerY, 0);

  var rectangle = Cesium.Rectangle.fromCenter(center, halfWidth, halfHeight);
  return rectangle;
}

function createText(worldPosition) {
  return cesiumViewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(
      Cesium.Cartographic.fromCartesian(worldPosition).longitude * (180 / Math.PI),
      Cesium.Cartographic.fromCartesian(worldPosition).latitude * (180 / Math.PI),
      textHeight + (textHeight === 0 ? 0 : Cesium.Cartographic.fromCartesian(worldPosition).height)
    ),
    label: {
      text: textValue,
      font: `${textSize}px sans-serif`,
      fillColor: new Cesium.Color.fromCssColorString(textColor).withAlpha(textTransparency),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, textZoom),
      heightReference: textHeight === 0 ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE
    },
    properties: { // Añadir propiedad
      isDrawing: true
    }
  });
}

function applyPointSettings() {
  pointColor = document.getElementById('pointColorInput').value;
  pointHeight = parseFloat(document.getElementById('pointHeightInput').value);
  pointSize = parseFloat(document.getElementById('pointSizeInput').value);
  pointZoom = parseFloat(document.getElementById('pointZoomInput').value);
  pointTransparency = parseFloat(document.getElementById('pointTransparencyInput').value);
  document.getElementById('inputDialog').style.display = 'none';
  showMessage("Click to place a point on the map.");
  activateToolHandler('point');;
}





function applyLineSettings() {
  lineColor = document.getElementById('lineColorInput').value;
  lineWidth = parseFloat(document.getElementById('lineWidthInput').value);
  lineStyle = document.getElementById('lineStyleInput').value;
  lineZoom = parseFloat(document.getElementById('lineZoomInput').value);
  lineTransparency = parseFloat(document.getElementById('lineTransparencyInput').value);
  document.getElementById('inputDialogLine').style.display = 'none';
  showMessage("Click to start drawing a line. Double-click to finish.");
  activateToolHandler('line');;
}

function applyPolygonSettings() {
  polygonColor = document.getElementById('polygonColorInput').value;
  polygonZoom = parseFloat(document.getElementById('polygonZoomInput').value);
  polygonTransparency = parseFloat(document.getElementById('polygonTransparencyInput').value);
  document.getElementById('inputDialogPolygon').style.display = 'none';
  showMessage("Click to start drawing a polygon. Double-click to finish.");
  activateToolHandler('polygon');;
}

function applyExtrudedSettings() {
  extrudedColor = document.getElementById('extrudedColorInput').value;
  extrudedHeight = parseFloat(document.getElementById('extrudedHeightInput').value);
  extrudedZoom = parseFloat(document.getElementById('extrudedZoomInput').value);
  extrudedTransparency = parseFloat(document.getElementById('extrudedTransparencyInput').value);
  document.getElementById('inputDialogExtruded').style.display = 'none';
  showMessage("Click to start drawing an extruded polygon. Double-click to finish.");
  activateToolHandler('extrudedPolygon');;
}

function applyTextSettings() {
  textColor = document.getElementById('textColorInput').value;
  textHeight = parseFloat(document.getElementById('textHeightInput').value);
  textSize = parseFloat(document.getElementById('textSizeInput').value);
  textValue = document.getElementById('textInput').value;
  textZoom = parseFloat(document.getElementById('textZoomInput').value);
  textTransparency = parseFloat(document.getElementById('textTransparencyInput').value);
  document.getElementById('inputDialogText').style.display = 'none';
  showMessage("Click to place text on the map.");
  activateToolHandler('text');
}



function applyCircleSettings() {
  circleColor = document.getElementById('circleColorInput').value;
  circleRadius = parseFloat(document.getElementById('circleRadiusInput').value);
  circleZoom = parseFloat(document.getElementById('circleZoomInput').value);
  circleTransparency = parseFloat(document.getElementById('circleTransparencyInput').value);
  document.getElementById('inputDialogCircle').style.display = 'none';
  showMessage("Click to place a circle center, then drag to set the radius.");
  activateToolHandler('circle');
}

function closeDialog(dialogId) {
  document.getElementById(dialogId).style.display = 'none';
}

function clearEntities() {
  cesiumViewer.entities.removeAll();
}

function showMessage(message) {
  var messageBox = document.getElementById('messageBox');
  messageBox.innerHTML = message;
  messageBox.style.display = 'block';
  setTimeout(function () {
    messageBox.style.display = 'none';
  }, 4000);
}

function toggleToolbox() {
  var toolbar = document.getElementById('toolbar');
  if (toolbar.style.display === 'block') {
    toolbar.style.display = 'none';
  } else {
    toolbar.style.display = 'block';
  }
}


function createGltfModelAtSelectedLocation(modelUrl) {
  // Supón que worldPosition es la ubicación en el mapa donde se colocará el modelo
  var worldPosition = cesiumViewer.camera.position; // Ejemplo de posición, ajustar según necesidad
  createGltfModel(worldPosition, modelUrl);
}


// Crear y mostrar modelos GLTF
function createGltfModel(worldPosition, modelUrl) {
  const modelEntity = cesiumViewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(
      Cesium.Cartographic.fromCartesian(worldPosition).longitude * (180 / Math.PI),
      Cesium.Cartographic.fromCartesian(worldPosition).latitude * (180 / Math.PI),
      Cesium.Cartographic.fromCartesian(worldPosition).height
    ),
    model: {
      uri: modelUrl,
      scale: 1.0,
      minimumPixelSize: 0,
      maximumScale: 1.0,
      allowPicking: true
    },
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 50000.0)
  });

  window.selectedModel = modelEntity;

  // Configurar clic derecho para abrir el cuadro de rotación
  cesiumViewer.screenSpaceEventHandler.setInputAction(function (event) {
    const pickedObject = cesiumViewer.scene.pick(event.position);
    if (Cesium.defined(pickedObject) && pickedObject.id === selectedModel) {
      openRotationDialog(event.position.x, event.position.y);
    }
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

// Función para abrir el cuadro de rotación
function openRotationDialog(x, y) {
  const dialog = document.getElementById('rotationDialog');
  if (dialog) {
    dialog.style.display = 'block';
    dialog.style.left = `${x}px`;
    dialog.style.top = `${y}px`;
    dialog.oncontextmenu = (event) => event.preventDefault(); // Desactiva menú contextual
  } else {
    console.error("El elemento 'rotationDialog' no está presente en el DOM.");
  }
}

// Cerrar cuadro de rotación
function closeRotationDialog() {
  document.getElementById('rotationDialog').style.display = 'none';
}

// Aplicar rotación al modelo seleccionado
function applyDynamicRotation() {
  if (selectedModel) {
    const rotationX = parseFloat(document.getElementById('rotationX').value) || 0;
    const rotationY = parseFloat(document.getElementById('rotationY').value) || 0;
    const rotationZ = parseFloat(document.getElementById('rotationZ').value) || 0;

    const rotationMatrixX = Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(rotationX));
    const rotationMatrixY = Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(rotationY));
    const rotationMatrixZ = Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(rotationZ));

    let rotationMatrix = Cesium.Matrix3.multiply(rotationMatrixX, rotationMatrixY, new Cesium.Matrix3());
    rotationMatrix = Cesium.Matrix3.multiply(rotationMatrix, rotationMatrixZ, new Cesium.Matrix3());

    const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(selectedModel.position.getValue(Cesium.JulianDate.now()));
    Cesium.Matrix4.multiplyByMatrix3(modelMatrix, rotationMatrix, modelMatrix);

    selectedModel.modelMatrix = modelMatrix;
  }
}

// Configurar el listener del clic derecho para abrir el cuadro de rotación (se ejecuta solo una vez)
if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id === window.selectedModel) {
  cesiumViewer.screenSpaceEventHandler.setInputAction(function (event) {
    const pickedObject = cesiumViewer.scene.pick(event.position);
    if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id === selectedModel) {
      openRotationDialog(event.position.x, event.position.y);
    }
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}