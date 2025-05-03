let measureHandler;
let measurePoints =[];
let measureWindow;
let floatingMeasurePoint = null;
let activeMeasureShape = null;
let isMeasuring = false;
let measureType = 'distance';
let measureInfoBoxHandler = null;

function createMeasurePoint(worldPosition) {
  return cesiumViewer.entities.add({
    position: worldPosition,
    point: {
      pixelSize: 10,
      color: Cesium.Color.TRANSPARENT,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    properties: { // Añadir propiedad para identificar entidades de medición
      isMeasurement: true
    }
  });
}

function drawMeasureShape(positionData) {
  return cesiumViewer.entities.add({
    polyline: {
      positions: positionData,
      clampToGround: true,
      width: 6, // Make the line a bit thicker
      material: new Cesium.PolylineOutlineMaterialProperty({
        color: Cesium.Color.WHITE, // White line
        outlineWidth: 2,
        outlineColor: Cesium.Color.BLACK, // Black outline
      }),
    },
    properties: { // Añadir propiedad para identificar entidades de medición
      isMeasurement: true
    }
  });
}

function createMeasureWindow() {
  if (!measureWindow) {
    const container = document.createElement('div');
    container.id = 'measurementWindow';
    container.style.position = 'absolute';
    container.style.bottom = '10px';
    container.style.right = '40%';
    container.style.padding = '10px';
    container.style.background = 'rgba(0, 0, 0, 0.75)';
    container.style.color = 'white';
    container.style.zIndex = '1000';
    container.style.width = '200px';
    container.style.borderRadius = '5px';
    container.style.overflowY = 'auto';
    container.style.maxHeight = '200px';

    const closeButton = document.createElement('div');
    closeButton.innerText = '×';
    closeButton.style.float = 'right';
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = 'white';
    closeButton.style.fontSize = '20px';
    closeButton.onclick = closeMeasureWindow;
    container.appendChild(closeButton);

    const title = document.createElement('h3');
    title.innerText = 'Measurements';
    container.appendChild(title);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-around';
    buttonContainer.style.marginBottom = '10px';

    const verticalButton = document.createElement('i');
    verticalButton.id = 'verticalMeasurementButton';
    verticalButton.className = 'bx bx-up-arrow-alt'; // Elige el icono que prefieras
    verticalButton.style.fontSize = '24px';
    verticalButton.style.cursor = 'pointer';
    verticalButton.onclick = () => setMeasureType('vertical');
    buttonContainer.appendChild(verticalButton);

    const distanceButton = document.createElement('i');
    distanceButton.id = 'distanceMeasurementButton';
    distanceButton.className = 'bx bx-ruler';
    distanceButton.style.fontSize = '24px';
    distanceButton.style.cursor = 'pointer';
    distanceButton.onclick = () => setMeasureType('distance');
    buttonContainer.appendChild(distanceButton);

    const areaButton = document.createElement('i');
    areaButton.id = 'areaMeasurementButton';
    areaButton.className = 'bx bx-shape-polygon';
    areaButton.style.fontSize = '24px';
    areaButton.style.cursor = 'pointer';
    areaButton.onclick = () => setMeasureType('area');
    buttonContainer.appendChild(areaButton);


    const clearButton = document.createElement('i');
    clearButton.id = 'clearMeasurementButton';
    clearButton.className = 'bx bx-trash';
    clearButton.style.fontSize = '24px';
    clearButton.style.cursor = 'pointer';
    clearButton.onclick = clearMeasureData;
    buttonContainer.appendChild(clearButton);

    container.appendChild(buttonContainer);

    const totalDistance = document.createElement('p');
    totalDistance.id = 'totalDistance';
    container.appendChild(totalDistance);

    const measurementsList = document.createElement('ul');
    measurementsList.id = 'measurementsList';
    container.appendChild(measurementsList);

    document.body.appendChild(container);
    measureWindow = container;
  }
}

function updateMeasureWindow(distance, totalDistance, point1, point2) {
  createMeasureWindow();
  const measurementsList = document.getElementById('measurementsList');
  const totalDistanceElement = document.getElementById('totalDistance');

  if (distance > 0) {
    const cameraHeight = cesiumViewer.camera.positionCartographic.height;
    let distanceDisplay, totalDistanceDisplay;

    if (cameraHeight < 5000) {
      distanceDisplay = `${(distance * 1000).toFixed(0)} m`;
      totalDistanceDisplay = `${(totalDistance * 1000).toFixed(0)} m`;
    } else {
      distanceDisplay = `${distance.toFixed(3)} km`;
      totalDistanceDisplay = `${totalDistance.toFixed(3)} km`;
    }

    const listItem = document.createElement('li');
    listItem.innerText = distanceDisplay;
    measurementsList.appendChild(listItem);

    totalDistanceElement.innerText = `Total: ${totalDistanceDisplay}`;

    // Crear etiqueta para mostrar la distancia del segmento
    const midpoint = Cesium.Cartesian3.midpoint(point1, point2, new Cesium.Cartesian3());
    cesiumViewer.entities.add({
      position: midpoint,
      label: {
        text: distanceDisplay,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        font: '18px sans-serif', // Aumentar el tamaño de la fuente
        fillColor: Cesium.Color.WHITE, // Texto blanco
        outlineColor: Cesium.Color.BLACK, // Fondo negro (borde)
        outlineWidth: 3, // Aumentar el grosor del borde para el fondo
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
      properties: { // Añadir propiedad para identificar entidades de medición
        isMeasurement: true
      }
    });
  }
}

function updateAreaMeasureWindow(area, points) {
  createMeasureWindow();
  const measurementsList = document.getElementById('measurementsList');
  const totalDistanceElement = document.getElementById('totalDistance');

  if (area > 0) {
    const cameraHeight = cesiumViewer.camera.positionCartographic.height;
    let areaDisplay;

    if (cameraHeight < 5000) {
      areaDisplay = `${(area * 1000000).toFixed(0)} m²`;
    } else {
      areaDisplay = `${area.toFixed(3)} km²`;
    }

    const listItem = document.createElement('li');
    listItem.innerText = areaDisplay;
    measurementsList.appendChild(listItem);

    totalDistanceElement.innerText = `Total: ${areaDisplay}`;

    // Crear etiqueta para mostrar el área total (aproximación al centro)
    if (points.length > 2) {
      const centroid = turf.centroid(turf.polygon([points.map(p => {
        const cartographic = Cesium.Cartographic.fromCartesian(p);
        return [Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)];
      })]));
      const centroidPosition = Cesium.Cartesian3.fromDegrees(centroid.geometry.coordinates[0], centroid.geometry.coordinates[1]);
      cesiumViewer.entities.add({
        position: centroidPosition,
        label: {
          text: areaDisplay,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          font: '20px sans-serif', // Aumentar el tamaño de la fuente
          fillColor: Cesium.Color.WHITE, // Texto blanco
          outlineColor: Cesium.Color.BLACK, // Fondo negro (borde)
          outlineWidth: 3, // Aumentar el grosor del borde para el fondo
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        properties: { // Añadir propiedad para identificar entidades de medición
          isMeasurement: true
        }
      });
    }
  }
}

function calculateMeasureDistance(point1, point2) {
  if (typeof turf === 'undefined') {
    console.error('turf is not defined');
    return 0;
  }

  const cartographic1 = Cesium.Cartographic.fromCartesian(point1);
  const cartographic2 = Cesium.Cartographic.fromCartesian(point2);

  cartographic1.height = 0;
  cartographic2.height = 0;

  const longitude1 = Cesium.Math.toDegrees(cartographic1.longitude);
  const latitude1 = Cesium.Math.toDegrees(cartographic1.latitude);
  const longitude2 = Cesium.Math.toDegrees(cartographic2.longitude);
  const latitude2 = Cesium.Math.toDegrees(cartographic2.latitude);

  const turfPoint1 = turf.point([longitude1, latitude1]);
  const turfPoint2 = turf.point([longitude2, latitude2]);

  const options = { units: 'kilometers' };
  return turf.distance(turfPoint1, turfPoint2, options);
}

function calculateMeasureArea(points) {
  if (typeof turf === 'undefined') {
    console.error('turf is not defined');
    return 0;
  }

  const turfPoints = points.map((point) => {
    const cartographic = Cesium.Cartographic.fromCartesian(point);
    return [Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)];
  });
  if (turfPoints.length > 2) {
    turfPoints.push(turfPoints[0]); // Ensure the first and last points are the same
    const polygon = turf.polygon([turfPoints]);
    return turf.area(polygon) / 1000000; // Returns area in square kilometers
  }
  return 0;
}

function startMeasureDistance() {
  clearMeasurements();
  let totalDistance = 0;
  measurePoints =[];
  isMeasuring = true;

  if (!measureHandler) {
    measureHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.canvas);
  }

  measureHandler.setInputAction(function (event) {
    const earthPosition = cesiumViewer.scene.pickPosition(event.position);
    if (Cesium.defined(earthPosition)) {
      measurePoints.push(earthPosition);
      createMeasurePoint(earthPosition);

      if (measurePoints.length > 1) {
        const previousPoint = measurePoints[measurePoints.length - 2];
        const distance = calculateMeasureDistance(previousPoint, earthPosition);
        totalDistance += distance;
        updateMeasureWindow(distance, totalDistance, previousPoint, earthPosition); // Pasar los puntos
        drawMeasureShape(measurePoints);
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  measureHandler.setInputAction(function () {
    isMeasuring = false;
    console.log("Measurement finished. Total distance: " + totalDistance.toFixed(3) + " km");
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}

function startMeasureArea() {
  clearMeasurements();
  let totalArea = 0;
  measurePoints =[];
  isMeasuring = true;

  if (!measureHandler) {
    measureHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.canvas);
  }

  measureHandler.setInputAction(function (event) {
    const earthPosition = cesiumViewer.scene.pickPosition(event.position);
    if (Cesium.defined(earthPosition)) {
      measurePoints.push(earthPosition);
      createMeasurePoint(earthPosition);

      if (measurePoints.length > 2) {
        drawMeasureShape(measurePoints.concat([measurePoints[0]]));
      } else if (measurePoints.length > 1) {
        drawMeasureShape(measurePoints);
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  measureHandler.setInputAction(function () {
    if (measurePoints.length > 2) {
      totalArea = calculateMeasureArea(measurePoints);
      updateAreaMeasureWindow(totalArea);
    }
    isMeasuring = false;
    console.log("Measurement finished. Total area: " + totalArea.toFixed(3) + " km²");
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}

function clearMeasurements() {
  const entitiesToRemove =[];
  cesiumViewer.entities.values.forEach(entity => {
    if (entity.properties && entity.properties.isMeasurement) {
      entitiesToRemove.push(entity);
    }
  });
  entitiesToRemove.forEach(entity => cesiumViewer.entities.remove(entity));
}

function clearMeasureData() {
  if (measureWindow) {
    document.getElementById('measurementsList').innerHTML = '';
    document.getElementById('totalDistance').innerText = 'Total: 0';
  }
  measurePoints =[];
  floatingMeasurePoint = null;
  activeMeasureShape = null;
  if (isMeasuring) {
    if (measureType === 'distance') {
      startMeasureDistance();
    } else if (measureType === 'area') {
      startMeasureArea();
    }
  }
}

function closeMeasureWindow() {
  if (measureHandler) {
    measureHandler.destroy();
    measureHandler = null;
  }
  isMeasuring = false;
  clearMeasurements();
  clearMeasureData();
  if (measureWindow) {
    document.body.removeChild(measureWindow);
    measureWindow = null;
  }
  updateMeasureButtonState();
}

function toggleMeasurement() {
  if (isMeasuring) {
    closeMeasureWindow();
    enableDoubleClickZoom();
    enableInfoBoxClick();
  } else {
    openMeasureWindow();
    setMeasureType('distance');
  }
  updateMeasureButtonState();
}

function updateMeasureButtonState() {
  const distanceButton = document.getElementById('distanceMeasurementButton');
  const areaButton = document.getElementById('areaMeasurementButton');
  const verticalButton = document.getElementById('verticalMeasurementButton');
  if (distanceButton && areaButton && verticalButton) {
    if (isMeasuring) {
      if (measureType === 'distance') {
        distanceButton.style.backgroundColor = 'green';
        areaButton.style.backgroundColor = '';
        verticalButton.style.backgroundColor = '';
      } else if (measureType === 'area') {
        distanceButton.style.backgroundColor = '';
        areaButton.style.backgroundColor = 'green';
        verticalButton.style.backgroundColor = '';
      } else if (measureType === 'vertical') {
        distanceButton.style.backgroundColor = '';
        areaButton.style.backgroundColor = '';
        verticalButton.style.backgroundColor = 'green';
      }
    } else {
      distanceButton.style.backgroundColor = '';
      areaButton.style.backgroundColor = '';
      verticalButton.style.backgroundColor = '';
    }
  }
}

function setMeasureType(type) {
  measureType = type;
  isMeasuring = false;
  clearMeasureData();
  if (type === 'distance') {
    startMeasureDistance();
  } else if (type === 'area') {
    startMeasureArea();
  } else if (type === 'vertical') {
    startMeasureVertical();
  }
  updateMeasureButtonState();
}

function openMeasureWindow() {
  if (!isMeasuring) {
    createMeasureWindow();
    isMeasuring = true;
    setMeasureType('distance');
    disableDoubleClickZoom();
    disableInfoBoxClick();
  }
}

function disableDoubleClickZoom() {
  cesiumViewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}

function enableDoubleClickZoom() {
  cesiumViewer.screenSpaceEventHandler.setInputAction(function (click) {
    cesiumViewer.camera.zoomIn();
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}

function disableInfoBoxClick() {
  if (!measureInfoBoxHandler) {
    measureInfoBoxHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.scene.canvas);
    measureInfoBoxHandler.setInputAction(function () {
      // Do nothing to disable the infoBox click action
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }
}

function enableInfoBoxClick() {
  if (measureInfoBoxHandler) {
    measureInfoBoxHandler.destroy();
    measureInfoBoxHandler = null;
  }
}


function startMeasureVertical() {
  clearMeasurements();
  measurePoints =[];
  isMeasuring = true;
  let startPosition = null;
  let verticalLineEntity = null;
  let measureLabelEntity = null;

  if (!measureHandler) {
    measureHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.canvas);
  }

  measureHandler.setInputAction(function (event) {
    if (!startPosition) {
      const pickedObject = cesiumViewer.scene.pick(event.position);
      if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.position)) {
        startPosition = pickedObject.position;
        // Or pick the terrain intersection
        // const ray = cesiumViewer.camera.getPickRay(event.position);
        // startPosition = cesiumViewer.scene.globe.pick(ray, cesiumViewer.scene);

        if (startPosition) {
          measurePoints.push(startPosition);
          createMeasurePoint(startPosition);
          // Start tracking mouse movement
        }
      } else {
        const ray = cesiumViewer.camera.getPickRay(event.position);
        startPosition = cesiumViewer.scene.globe.pick(ray, cesiumViewer.scene);
        if (startPosition) {
          measurePoints.push(startPosition);
          createMeasurePoint(startPosition);
        }
      }
    } else {
      // Measurement finished on second click
      isMeasuring = false;
      measureHandler.destroy();
      measureHandler = null;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  measureHandler.setInputAction(function (movement) {
    if (startPosition && isMeasuring) {
      const ray = cesiumViewer.camera.getPickRay(movement.endPosition);
      const endPosition = cesiumViewer.scene.globe.pick(ray, cesiumViewer.scene);

      if (Cesium.defined(endPosition)) {
        const startCartographic = Cesium.Cartographic.fromCartesian(startPosition);
        const endCartographic = Cesium.Cartographic.fromCartesian(endPosition);

        // Approximate vertical distance (height difference)
        const verticalDistance = Math.abs(endCartographic.height - startCartographic.height);
        const distanceDisplay = verticalDistance.toFixed(2) + ' m';

        const verticalEndPosition = Cesium.Cartesian3.fromRadians(
          startCartographic.longitude,
          startCartographic.latitude,
          endCartographic.height // Use the height from the mouse position
        );

        const positions = [startPosition, verticalEndPosition];

        if (!verticalLineEntity) {
          verticalLineEntity = cesiumViewer.entities.add({
            polyline: {
              positions: positions,
              material: Cesium.Color.WHITE,
              width: 2,
              clampToGround: false // Important for vertical lines
            },
            properties: { // Añadir propiedad para identificar entidades de medición
              isMeasurement: true
            }
          });
        } else {
          verticalLineEntity.polyline.positions = new Cesium.CallbackProperty(function () {
            return positions;
          }, false);
        }

        // Update or create label
        const labelPosition = verticalEndPosition; // Position label at the end
        if (!measureLabelEntity) {
          measureLabelEntity = cesiumViewer.entities.add({
            position: labelPosition,
            label: {
              text: distanceDisplay,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              font: '14px sans-serif',
              fillColor: Cesium.Color.YELLOW,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND // Or NONE
            },
            properties: { // Añadir propiedad para identificar entidades de medición
              isMeasurement: true
            }
          });
        } else {
          measureLabelEntity.position = labelPosition;
          measureLabelEntity.label.text = distanceDisplay;
        }
      }
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // Optional: End measurement on right click
  measureHandler.setInputAction(function () {
    isMeasuring = false;
    measureHandler.destroy();
    measureHandler = null;
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}