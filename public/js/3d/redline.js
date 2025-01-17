

// Remover el doble clic predeterminado en Cesium
cesiumViewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
let selectedModel = null;
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
var extrudedHeight = 30000;
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


window.toggleTool = toggleTool;

document.addEventListener("DOMContentLoaded", function () {
  // Llamar `toggleTool` al hacer clic en los botones de la barra de herramientas
  document.querySelectorAll('#toolbarContainer button').forEach(button => {
    button.addEventListener('click', function () {
      const tool = this.id.replace('Button', '');
      toggleTool(tool);
    });
  });
});

// Función para activar y desactivar herramientas
function toggleTool(tool) {
  deactivateTool();
  if (tool === activeTool) {
    return; // Si la herramienta ya está activa, salir
  }

  if (tool === 'gltfModel') {
    loadGltfModels();
    document.getElementById('inputDialogModel').style.display = 'block';
  } else {
    const dialogMap = {
      point: 'inputDialog',
      line: 'inputDialogLine',
      polygon: 'inputDialogPolygon',
      extrudedPolygon: 'inputDialogExtruded',
      text: 'inputDialogText',
      circle: 'inputDialogCircle'
    };
    if (dialogMap[tool]) {
      document.getElementById(dialogMap[tool]).style.display = 'block';
    }
  }
  activeTool = tool;
}

// Función para desactivar la herramienta
function deactivateTool() {
  if (activeTool) {
    document.getElementById(activeTool + 'Button')?.classList.remove('active');
  }
  activeTool = null;
  if (handler) {
    handler.destroy();
    handler = null;
  }
  activeShapePoints = [];
  activeShape = null;
  floatingPoint = null;

  // Ocultar todos los diálogos de entrada
  const dialogs = [
    'inputDialog', 'inputDialogModel', 'inputDialogLine', 'inputDialogPolygon',
    'inputDialogExtruded', 'inputDialogText', 'inputDialogRectangle', 'inputDialogCircle'
  ];
  dialogs.forEach(dialogId => document.getElementById(dialogId).style.display = 'none');
}

// Llamar `toggleTool` al hacer clic en los botones de la barra de herramientas
document.querySelectorAll('#toolbarContainer button').forEach(button => {
  button.addEventListener('click', function () {
    const tool = this.id.replace('Button', '');
    toggleTool(tool);
  });
});

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
    activateTool('gltfModel'); // Activa la herramienta para permitir la selección en el mapa
  }
}

// Modificar la función `activateTool` para mantener la herramienta activa
function activateTool(tool) {
  activeTool = tool;
  document.getElementById(tool + 'Button').classList.add('active'); // Añade la clase activa al botón

  if (cesiumViewer && cesiumViewer.scene && cesiumViewer.scene.canvas) {
    handler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.scene.canvas);
  } else {
    console.error('Cesium viewer or scene not initialized');
    return;
  }

  handler.setInputAction(function (event) {
    var earthPosition = cesiumViewer.scene.pickPosition(event.position);
    if (Cesium.defined(earthPosition)) {
      if (activeTool === 'point') {
        createPoint(earthPosition);
      } else if (activeTool === 'gltfModel' && window.selectedGltfModelUrl) {
        // Coloca el modelo GLTF en la posición del clic
        createGltfModel(earthPosition, window.selectedGltfModelUrl);
        // La herramienta permanece activa para permitir más clics y añadir más modelos
      } else if (activeTool === 'text') {
        createText(earthPosition);
      } else {
        if (activeShapePoints.length === 0) {
          floatingPoint = createFloatingPoint(earthPosition);
          activeShapePoints.push(earthPosition);
          var dynamicPositions = new Cesium.CallbackProperty(function () {
            return activeTool === 'line' ? activeShapePoints : new Cesium.PolygonHierarchy(activeShapePoints);
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
        activeShapePoints.pop();
        activeShapePoints.push(newPosition);
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
        }
    }
}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

  handler.setInputAction(function () {
    finalizeShape();
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}

// Función para cerrar el diálogo y desactivar la herramienta
function closeModelDialog() {
  document.getElementById('inputDialogModel').style.display = 'none';
  deactivateTool(); // Desactiva la herramienta al cerrar el diálogo
}

// Modificar el botón de cerrar en HTML para llamar a `closeModelDialog`




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
    return cesiumViewer.entities.add({
      position: positionData[0],
      ellipse: {
        semiMajorAxis: circleRadius,
        semiMinorAxis: circleRadius,
        material: new Cesium.Color.fromCssColorString(circleColor).withAlpha(circleTransparency),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, circleZoom)
      }
    });
  }
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
  activateTool('point');
}





function applyLineSettings() {
  lineColor = document.getElementById('lineColorInput').value;
  lineWidth = parseFloat(document.getElementById('lineWidthInput').value);
  lineStyle = document.getElementById('lineStyleInput').value;
  lineZoom = parseFloat(document.getElementById('lineZoomInput').value);
  lineTransparency = parseFloat(document.getElementById('lineTransparencyInput').value);
  document.getElementById('inputDialogLine').style.display = 'none';
  showMessage("Click to start drawing a line. Double-click to finish.");
  activateTool('line');
}

function applyPolygonSettings() {
  polygonColor = document.getElementById('polygonColorInput').value;
  polygonZoom = parseFloat(document.getElementById('polygonZoomInput').value);
  polygonTransparency = parseFloat(document.getElementById('polygonTransparencyInput').value);
  document.getElementById('inputDialogPolygon').style.display = 'none';
  showMessage("Click to start drawing a polygon. Double-click to finish.");
  activateTool('polygon');
}

function applyExtrudedSettings() {
  extrudedColor = document.getElementById('extrudedColorInput').value;
  extrudedHeight = parseFloat(document.getElementById('extrudedHeightInput').value);
  extrudedZoom = parseFloat(document.getElementById('extrudedZoomInput').value);
  extrudedTransparency = parseFloat(document.getElementById('extrudedTransparencyInput').value);
  document.getElementById('inputDialogExtruded').style.display = 'none';
  showMessage("Click to start drawing an extruded polygon. Double-click to finish.");
  activateTool('extrudedPolygon');
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
  activateTool('text');
}



function applyCircleSettings() {
  circleColor = document.getElementById('circleColorInput').value;
  circleRadius = parseFloat(document.getElementById('circleRadiusInput').value);
  circleZoom = parseFloat(document.getElementById('circleZoomInput').value);
  circleTransparency = parseFloat(document.getElementById('circleTransparencyInput').value);
  document.getElementById('inputDialogCircle').style.display = 'none';
  showMessage("Click to place a circle center, then drag to set the radius.");
  activateTool('circle');
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

async function loadGltfModels() {
  try {
    const response = await fetch('/3d/api/gltf-files');
    const data = await response.json();
    const modelSelect = document.getElementById('gltfModelSelect');
    modelSelect.innerHTML = ''; // Limpiar opciones previas
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

  selectedModel = modelEntity;

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



