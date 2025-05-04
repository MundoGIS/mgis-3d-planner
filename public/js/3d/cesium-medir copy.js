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
  clearMeasurements(); // Limpia mediciones anteriores
  clearMeasureData(); // Limpia datos como puntos y reinicia estados

  measurePoints = [];
  isMeasuring = true; // Indica que estamos en proceso de medir
  let startPosition = null; // Almacenará el primer punto (Cartesian3)
  let startPositionCartographic = null; // Almacenará el primer punto (Cartographic)
  let verticalLineEntity = null; // La entidad para la línea vertical
  let measureLabelEntity = null; // La entidad para la etiqueta de distancia

  // Si no existe el manejador de eventos del ratón, créalo
  if (!measureHandler) {
      measureHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.canvas);
  }

  // --- Acción al hacer clic izquierdo ---
  measureHandler.setInputAction(function (event) {
      // Intenta obtener la posición 3D precisa bajo el cursor
      const pickedPosition = cesiumViewer.scene.pickPosition(event.position);

      // Verifica si se pudo obtener una posición válida
      if (!Cesium.defined(pickedPosition)) {
          console.warn("Could not pick a valid starting position.");
          // Opcional: podrías intentar con globe.pick como fallback si lo deseas
          // const ray = cesiumViewer.camera.getPickRay(event.position);
          // pickedPosition = cesiumViewer.scene.globe.pick(ray, cesiumViewer.scene);
          // if (!Cesium.defined(pickedPosition)) return; // Salir si ni el fallback funciona
           return; // Salir si no se pudo hacer pick
      }

      if (!startPosition) {
          // --- Primer clic: Establecer el punto de inicio ---
          startPosition = pickedPosition;
          startPositionCartographic = Cesium.Cartographic.fromCartesian(startPosition);

          // Guardar el punto inicial (opcional, si necesitas la lista)
          measurePoints.push(startPosition);

          // Crear un punto visual en el inicio (opcional)
          createMeasurePoint(startPosition);

          // Ahora estamos esperando el movimiento del ratón para dibujar la línea

      } else {
          // --- Segundo clic: Finalizar la medición ---

          // Obtener la posición final del clic
          const finalPickedPosition = cesiumViewer.scene.pickPosition(event.position);
           if (!Cesium.defined(finalPickedPosition)) {
               console.warn("Could not pick a valid ending position. Measurement might be inaccurate.");
               // Si no se puede obtener una posición final, podríamos cancelar o usar la última válida del MOUSE_MOVE
               // Por ahora, simplemente finalizamos, la línea/etiqueta se quedarán como estaban en el último MOUSE_MOVE
          } else {
               // Calcular la posición final vertical y la distancia basada en el último clic
               const finalEndCartographic = Cesium.Cartographic.fromCartesian(finalPickedPosition);
               const finalVerticalEndPosition = Cesium.Cartesian3.fromRadians(
                   startPositionCartographic.longitude,
                   startPositionCartographic.latitude,
                   finalEndCartographic.height // Altura del punto final del clic
               );
               const finalVerticalDistance = Math.abs(finalEndCartographic.height - startPositionCartographic.height);
               const finalDistanceDisplay = finalVerticalDistance.toFixed(2) + ' m';

               // Actualizar la línea y etiqueta a sus valores finales
               // Remover CallbackProperty para que no se actualicen más
               if (verticalLineEntity) {
                   verticalLineEntity.polyline.positions = [startPosition, finalVerticalEndPosition];
               }
               if (measureLabelEntity) {
                   measureLabelEntity.position = finalVerticalEndPosition; // O un punto medio/offset si prefieres
                   measureLabelEntity.label.text = finalDistanceDisplay;
               }

               // Añadir el punto final a la lista (opcional)
               measurePoints.push(finalVerticalEndPosition); // Guardamos el punto vertical final
          }


          // Limpiar estado y manejadores para esta medición específica
          isMeasuring = false; // Ya no estamos midiendo activamente (esperando clics)
          startPosition = null; // Resetea para la próxima medición
          startPositionCartographic = null;
          // No destruyas el handler principal aquí si quieres poder hacer otra medición
          // measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
          // measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
          // measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
          // measureHandler = null; // Opcional: Destruir sólo si se cierra la ventana/herramienta

           console.log("Vertical measurement finished.");
           // Podrías actualizar la ventana de mediciones aquí si es necesario
           // updateMeasureWindow(...) o una función específica para vertical.
      }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // --- Acción al mover el ratón ---
  measureHandler.setInputAction(function (movement) {
      // Solo actuar si ya hemos hecho el primer clic (startPosition existe) y aún estamos midiendo
      if (!startPosition || !isMeasuring) {
          return;
      }

      // Obtener la posición 3D bajo el cursor del ratón
      const currentMousePosition = cesiumViewer.scene.pickPosition(movement.endPosition);

      // Si no se puede obtener una posición (ej: el cursor está sobre el cielo), no hacer nada
      if (!Cesium.defined(currentMousePosition)) {
           // Opcional: podrías ocultar la línea/etiqueta temporalmente
           if (verticalLineEntity) verticalLineEntity.show = false;
           if (measureLabelEntity) measureLabelEntity.show = false;
          return;
      } else {
           // Asegurarse de que sean visibles si se ocultaron antes
           if (verticalLineEntity) verticalLineEntity.show = true;
           if (measureLabelEntity) measureLabelEntity.show = true;
      }


      // Obtener la altura del punto actual bajo el ratón
      const currentMouseCartographic = Cesium.Cartographic.fromCartesian(currentMousePosition);
      const currentHeight = currentMouseCartographic.height;

      // Calcular la posición final de la línea vertical:
      // Misma Longitud/Latitud que el punto inicial, pero con la altura del punto bajo el ratón.
      const verticalEndPosition = Cesium.Cartesian3.fromRadians(
          startPositionCartographic.longitude,
          startPositionCartographic.latitude,
          currentHeight // ¡Esta es la clave! Usar la altura del punto actual del ratón
      );

      // Calcular la diferencia de altura (distancia vertical)
      const verticalDistance = Math.abs(currentHeight - startPositionCartographic.height);
      const distanceDisplay = verticalDistance.toFixed(2) + ' m';

      // --- Actualizar o crear la línea vertical ---
      const positions = [startPosition, verticalEndPosition];

      if (!verticalLineEntity) {
          // Crear la entidad de la línea si no existe
          verticalLineEntity = cesiumViewer.entities.add({
              polyline: {
                  // Usar CallbackProperty para eficiencia al actualizar dinámicamente
                  positions: new Cesium.CallbackProperty(() => positions, false),
                  material: Cesium.Color.YELLOW, // Cambiado a amarillo para mejor visibilidad
                  width: 3, // Un poco más gruesa
                  clampToGround: false // ¡MUY IMPORTANTE para líneas verticales!
              },
              properties: { isMeasurement: true } // Identificador
          });
      }
      // Nota: Como usamos CallbackProperty, no necesitamos actualizar explícitamente
      // verticalLineEntity.polyline.positions en cada movimiento.

      // --- Actualizar o crear la etiqueta de la distancia ---
      // Posicionar la etiqueta en el extremo superior de la línea vertical
      const labelPosition = verticalEndPosition;

      if (!measureLabelEntity) {
          // Crear la entidad de la etiqueta si no existe
          measureLabelEntity = cesiumViewer.entities.add({
              position: new Cesium.CallbackProperty(() => labelPosition, false),
              label: {
                  text: distanceDisplay,
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  font: '16px sans-serif', // Tamaño ajustado
                  fillColor: Cesium.Color.YELLOW,
                  outlineColor: Cesium.Color.BLACK,
                  outlineWidth: 2,
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM, // Posicionar encima del punto
                  horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                  pixelOffset: new Cesium.Cartesian2(0, -5), // Pequeño offset hacia arriba
                  heightReference: Cesium.HeightReference.NONE // ¡IMPORTANTE! No fijar al suelo
                  // disableDepthTestDistance: Number.POSITIVE_INFINITY // Opcional: para que siempre sea visible
              },
              properties: { isMeasurement: true } // Identificador
          });
      } else {
          // Actualizar el texto de la etiqueta existente
           // La posición se actualiza vía CallbackProperty
          measureLabelEntity.label.text = distanceDisplay;
      }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // --- Acción al hacer clic derecho (Cancelar/Reiniciar medición actual) ---
  measureHandler.setInputAction(function () {
      if (isMeasuring) {
          // Si estamos en medio de una medición (después del primer clic)
          clearMeasurements(); // Limpia la línea/punto/etiqueta actuales
          startPosition = null; // Resetea el punto de inicio
          startPositionCartographic = null;
          verticalLineEntity = null; // Asegúrate de limpiar las referencias a entidades
          measureLabelEntity = null;
          // No cambies isMeasuring a false aquí, para permitir iniciar otra medición con el siguiente clic izquierdo
          console.log("Vertical measurement cancelled/reset.");
      } else {
           // Si no estábamos midiendo activamente (antes del primer clic o después del segundo)
           // podrías optar por cerrar la herramienta completa o simplemente no hacer nada.
           // closeMeasureWindow(); // Por ejemplo, para cerrar todo
      }

  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

  // Actualiza el estado visual de los botones
  updateMeasureButtonState();
  console.log("Vertical measurement mode started. Click to set start point.");
}

// --- Asegúrate de que clearMeasureData también limpie las nuevas variables ---
function clearMeasureData() {
  // ... (código existente para limpiar la lista y el total)
   if (measureWindow) {
       document.getElementById('measurementsList').innerHTML = '';
       document.getElementById('totalDistance').innerText = 'Total: 0'; // O adaptar para vertical/area
   }

  measurePoints = [];
  floatingMeasurePoint = null; // Si usas esto para MOUSE_MOVE en otras mediciones
  activeMeasureShape = null;   // Si usas esto para MOUSE_MOVE en otras mediciones

  // Limpiar entidades visuales específicas de la medición actual si existen
   clearMeasurements(); // Esto ya debería eliminar entidades con isMeasurement: true

  // Resetea el estado si la herramienta sigue activa pero se cambia de tipo o se limpia
   // No reinicies isMeasuring aquí directamente, setMeasureType lo maneja
   // startPosition = null; // Esto se maneja mejor dentro de startMeasureVertical
   // verticalLineEntity = null;
   // measureLabelEntity = null;

  // Si se llama a clearMeasureData mientras se está midiendo (p.ej. botón de basura),
  // puede ser necesario reiniciar el estado de la medición activa.
  // if (isMeasuring) {
  //     if (measureType === 'distance') {
  //         // startMeasureDistance(); // Cuidado con bucles infinitos si start llama a clear
  //     } else if (measureType === 'area') {
  //         // startMeasureArea();
  //     } else if (measureType === 'vertical') {
  //         // Reiniciar la lógica de startMeasureVertical, quizás solo limpiar variables locales
  //          startPosition = null;
  //          startPositionCartographic = null;
  //          verticalLineEntity = null;
  //          measureLabelEntity = null;
  //     }
  // }
}


