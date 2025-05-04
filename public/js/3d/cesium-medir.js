// --- Global Variables ---
let measureHandler;
let measurePoints = [];       // Stores Cartesian3 points for the CURRENT measurement being created
let measurePrimitives = [];   // Stores references to ALL finished GroundPolylinePrimitives
let measureEntities = [];     // Stores references to ALL finished Entities (points, labels, vertical lines)
let measureWindow;
let floatingMeasurePoint = null; // Temporary entity for the red point under the cursor
let activeMeasureShape = null; // Holds the dynamically updated shape (Primitive or Entity) during measurement creation
let isMeasuring = false;      // Flag indicating if clicks should add points/finish
let measureType = 'distance'; // Current measurement type ('distance', 'area', 'vertical')
let originalCesiumSelectedEntityDescriptor = null; // For InfoBox override

// --- Entity Creation (Points) ---
// Does NOT add to measureEntities automatically anymore.
function createMeasurePoint(worldPosition) {
    const pointEntity = cesiumViewer.entities.add({
        position: worldPosition,
        point: {
            pixelSize: 8, color: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
            heightReference: Cesium.HeightReference.NONE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        properties: { isMeasurement: true, type: 'point' }
    });
    // REMOVED: measureEntities.push(pointEntity);
    return pointEntity;
}

// --- Ground Polyline Primitive Creation (Distance/Area Lines) ---
// Does NOT add to measurePrimitives automatically anymore.
function drawGroundMeasureShape(positions, loop = false) {
    if (positions.length < 2) return null;
    const groundPolylineGeometry = new Cesium.GroundPolylineGeometry({
        positions: positions, width: 4, loop: loop
    });
    const groundPolylinePrimitive = new Cesium.GroundPolylinePrimitive({
        geometryInstances: new Cesium.GeometryInstance({
            geometry: groundPolylineGeometry,
            attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.YELLOW) },
            id: 'measureGroundPrimitive_' + Date.now()
        }),
        appearance: new Cesium.PolylineMaterialAppearance({
            material: Cesium.Material.fromType('Color', { color: Cesium.Color.YELLOW })
        }),
        asynchronous: false
    });
    cesiumViewer.scene.primitives.add(groundPolylinePrimitive);
    // REMOVED: measurePrimitives.push(groundPolylinePrimitive);
    return groundPolylinePrimitive;
}


// --- Measurement Window UI ---
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
        container.style.width = '250px';
        container.style.borderRadius = '5px';
        container.style.overflowY = 'auto';
        container.style.maxHeight = '250px';

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
        title.style.marginTop = '0px';
        title.style.textAlign = 'center';
        container.appendChild(title);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-around';
        buttonContainer.style.marginBottom = '10px';

        function createButton(id, iconClass, type) {
             const button = document.createElement('i');
             button.id = id; button.className = iconClass; button.title = type.charAt(0).toUpperCase() + type.slice(1);
             button.style.fontSize = '24px'; button.style.cursor = 'pointer'; button.style.padding = '5px';
             button.onclick = () => setMeasureType(type);
             buttonContainer.appendChild(button);
             return button;
        }
        createButton('verticalMeasurementButton', 'bx bx-up-arrow-alt', 'vertical');
        createButton('distanceMeasurementButton', 'bx bx-ruler', 'distance');
        createButton('areaMeasurementButton', 'bx bx-shape-polygon', 'area');

        const clearButton = document.createElement('i');
        clearButton.id = 'clearMeasurementButton'; clearButton.className = 'bx bx-trash';
        clearButton.title = "Clear All Measurements"; clearButton.style.fontSize = '24px';
        clearButton.style.cursor = 'pointer'; clearButton.style.padding = '5px'; clearButton.style.color = '#FF7F7F';
        clearButton.onclick = clearAllMeasurementsAndData; // Call clear all
        buttonContainer.appendChild(clearButton);
        container.appendChild(buttonContainer);

        const currentMeasureDisplay = document.createElement('p');
        currentMeasureDisplay.id = 'currentMeasureDisplay';
        currentMeasureDisplay.style.textAlign = 'center'; currentMeasureDisplay.style.fontWeight = 'bold';
        currentMeasureDisplay.style.minHeight = '1.2em';
        container.appendChild(currentMeasureDisplay);

        const measurementsList = document.createElement('ul');
        measurementsList.id = 'measurementsList';
        measurementsList.style.listStyle = 'none'; measurementsList.style.padding = '0'; measurementsList.style.margin = '0';
        container.appendChild(measurementsList);

        document.body.appendChild(container);
        measureWindow = container;
    }
    updateMeasureButtonState();
}

// --- Update Measurement Display ---
// Creates temporary segment labels for distance
function updateMeasureWindowForDistance(segmentDistance, totalDistance, startPoint, endPoint) {
    if (!measureWindow) createMeasureWindow();
    const currentMeasureDisplay = document.getElementById('currentMeasureDisplay');
    if (!currentMeasureDisplay) return;

    const cameraHeight = cesiumViewer.camera.positionCartographic.height;
    const useMeters = cameraHeight < 5000;
    const segmentDisplay = useMeters ? `${(segmentDistance * 1000).toFixed(0)} m` : `${segmentDistance.toFixed(3)} km`;
    const totalDisplay = useMeters ? `${(totalDistance * 1000).toFixed(0)} m` : `${totalDistance.toFixed(3)} km`;

    currentMeasureDisplay.innerText = `Total: ${totalDisplay}`; // Show running total

    // --- Segment Label Entity (Temporary) ---
    const midpoint = Cesium.Cartesian3.midpoint(startPoint, endPoint, new Cesium.Cartesian3());
    const labelEntity = cesiumViewer.entities.add({
        position: midpoint,
        label: {
            text: segmentDisplay, style: Cesium.LabelStyle.FILL_AND_OUTLINE, font: '14px sans-serif',
            fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM, horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            pixelOffset: new Cesium.Cartesian2(0, -5), heightReference: Cesium.HeightReference.NONE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        properties: { isMeasurement: true, type: 'temp_label' } // Mark as temporary
    });
    // Don't add temp label to measureEntities here, handle cleanup separately if needed,
    // but clearMeasurements should catch it via the 'isMeasurement' property anyway.
}

// Updates list and creates final area label
function updateMeasureWindowForArea(area, points) {
    if (!measureWindow) createMeasureWindow();
    const measurementsList = document.getElementById('measurementsList');
    const currentMeasureDisplay = document.getElementById('currentMeasureDisplay');
    if (!measurementsList || !currentMeasureDisplay) return;

    if (area > 0 && points.length > 2) {
        const cameraHeight = cesiumViewer.camera.positionCartographic.height;
        const useSqMeters = cameraHeight < 10000;
        const areaDisplay = useSqMeters ? `${(area * 1000000).toFixed(0)} m²` : `${area.toFixed(3)} km²`;

        const listItem = document.createElement('li');
        listItem.innerText = `Area: ${areaDisplay}`; listItem.style.borderBottom = '1px solid #555'; listItem.style.padding = '2px 0';
        measurementsList.appendChild(listItem); measurementsList.scrollTop = measurementsList.scrollHeight;
        currentMeasureDisplay.innerText = `Area: ${areaDisplay}`;

        if (typeof turf !== 'undefined') {
            try {
                // Calculate center and sample terrain height (as before)
                const turfCoords = points.map(p => { const c = Cesium.Cartographic.fromCartesian(p); return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)]; });
                 if (turfCoords.length > 0 && (turfCoords[0][0] !== turfCoords[turfCoords.length - 1][0] || turfCoords[0][1] !== turfCoords[turfCoords.length - 1][1])) turfCoords.push([...turfCoords[0]]);
                const turfPolygon = turf.polygon([turfCoords]); const centerOfMass = turf.centerOfMass(turfPolygon);
                const centerCartographic = Cesium.Cartographic.fromDegrees(centerOfMass.geometry.coordinates[0], centerOfMass.geometry.coordinates[1]);

                Cesium.sampleTerrainMostDetailed(cesiumViewer.terrainProvider, [centerCartographic])
                    .then(([updatedCenterCartographic]) => {
                        const height = updatedCenterCartographic?.height ?? 0;
                        const labelPosition = Cesium.Cartesian3.fromRadians(centerCartographic.longitude, centerCartographic.latitude, height + 1.0);
                        // Create FINAL area label entity
                        const labelEntity = cesiumViewer.entities.add({
                            position: labelPosition,
                            label: {
                                text: areaDisplay, style: Cesium.LabelStyle.FILL_AND_OUTLINE, font: '16px sans-serif',
                                fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
                                verticalOrigin: Cesium.VerticalOrigin.BOTTOM, horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                                pixelOffset: new Cesium.Cartesian2(0, 5), heightReference: Cesium.HeightReference.NONE,
                                disableDepthTestDistance: Number.POSITIVE_INFINITY
                            },
                            properties: { isMeasurement: true, type: 'area_label' } // Final Label
                        });
                        measureEntities.push(labelEntity); // <-- TRACK FINAL LABEL
                        console.log("Area label created and tracked.");
                    }).catch(error => { /* ... fallback ... */ });
            } catch (error) { /* ... error handling ... */ }
        } else { console.warn("Turf unavailable for area label."); }
    } else { currentMeasureDisplay.innerText = 'Area: -'; }
}

// Updates list for final height measurement
function updateMeasureWindowForHeight(height) {
     if (!measureWindow) createMeasureWindow();
     const measurementsList = document.getElementById('measurementsList');
     const currentMeasureDisplay = document.getElementById('currentMeasureDisplay');
     if (!measurementsList || !currentMeasureDisplay) return;
     const heightDisplay = `${height.toFixed(2)} m`;
     const listItem = document.createElement('li');
     listItem.innerText = `Height: ${heightDisplay}`; listItem.style.borderBottom = '1px solid #555'; listItem.style.padding = '2px 0';
     measurementsList.appendChild(listItem); measurementsList.scrollTop = measurementsList.scrollHeight;
     currentMeasureDisplay.innerText = `Height: ${heightDisplay}`;
}


// --- Calculation Functions --- (No changes)
function calculateMeasureDistance(point1, point2) {
    const distanceInMeters = Cesium.Cartesian3.distance(point1, point2);
    return distanceInMeters / 1000; // Km
}
function calculateMeasureArea(points) {
    if (typeof turf === 'undefined') { console.error('turf is not defined'); return 0; }
    const turfPoints = points.map(p => { const c=Cesium.Cartographic.fromCartesian(p); return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)]; });
    if (turfPoints.length > 2) {
         if (turfPoints.length > 0 && (turfPoints[0][0] !== turfPoints[turfPoints.length - 1][0] || turfPoints[0][1] !== turfPoints[turfPoints.length - 1][1])) turfPoints.push([...turfPoints[0]]);
        try { const poly = turf.polygon([turfPoints]); const areaM2 = turf.area(poly); return areaM2 / 1000000; } // Sq Km
        catch (e) { console.error("Error calculating area:", e); return 0; }
    } return 0;
}

// --- Measurement Start Functions ---

function startMeasureDistance() {
    measurePoints = [];
    let totalDistance = 0;
    isMeasuring = true;
    activeMeasureShape = null; // Temp primitive
    let tempLabelEntities = []; // Store temp labels specific to this measurement

    if (measureWindow) document.getElementById('currentMeasureDisplay').innerText = 'Click start point...';
    if (!measureHandler) measureHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.canvas);
    else { measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK); measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE); measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK); }

    // --- Left Click ---
    measureHandler.setInputAction(function (event) {
        const pickedPosition = cesiumViewer.scene.pickPosition(event.position);
        if (Cesium.defined(pickedPosition)) {
            const startPoint = measurePoints.length > 0 ? measurePoints[measurePoints.length - 1] : null;
            measurePoints.push(pickedPosition);
            createMeasurePoint(pickedPosition); // Create visual point (but don't track yet)

            if (startPoint) {
                const segmentDistance = calculateMeasureDistance(startPoint, pickedPosition);
                totalDistance += segmentDistance;
                if (activeMeasureShape) cesiumViewer.scene.primitives.remove(activeMeasureShape); // Remove old temp line
                activeMeasureShape = drawGroundMeasureShape(measurePoints); // Draw new temp line
                updateMeasureWindowForDistance(segmentDistance, totalDistance, startPoint, pickedPosition); // Adds temp label
                // Find the label just added and track it temporarily
                 const lastLabel = cesiumViewer.entities.values.find(e => e.properties?.type === 'temp_label' && !tempLabelEntities.includes(e));
                 if(lastLabel) tempLabelEntities.push(lastLabel);
            } else {
                 if (measureWindow) document.getElementById('currentMeasureDisplay').innerText = 'Click next point...';
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // --- Mouse Move ---
    measureHandler.setInputAction(function (movement) {
        if (measurePoints.length > 0 && isMeasuring) {
            const currentMousePosition = cesiumViewer.scene.pickPosition(movement.endPosition);
            if (Cesium.defined(currentMousePosition)) {
                 if (activeMeasureShape) cesiumViewer.scene.primitives.remove(activeMeasureShape);
                 activeMeasureShape = drawGroundMeasureShape(measurePoints.concat(currentMousePosition));
                 if (floatingMeasurePoint) cesiumViewer.entities.remove(floatingMeasurePoint);
                 floatingMeasurePoint = cesiumViewer.entities.add({position: currentMousePosition, point: { pixelSize: 5, color: Cesium.Color.RED }, properties: { isMeasurement: true, type: 'temp' }});
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // --- Right Click: Finalize ---
    measureHandler.setInputAction(function () {
        if (measurePoints.length > 1) {
            isMeasuring = false;

            // 1. Clean temp visuals
            if (activeMeasureShape) { cesiumViewer.scene.primitives.remove(activeMeasureShape); activeMeasureShape = null; }
            if (floatingMeasurePoint) { cesiumViewer.entities.remove(floatingMeasurePoint); floatingMeasurePoint = null; }
            // Remove temp labels
            tempLabelEntities.forEach(lbl => cesiumViewer.entities.remove(lbl));
            tempLabelEntities = [];

            // 2. Draw FINAL primitive and TRACK it
            const finalPrimitive = drawGroundMeasureShape(measurePoints);
            if (finalPrimitive) measurePrimitives.push(finalPrimitive);

            // 3. TRACK final points
            measurePoints.forEach(pos => {
                 const finalPointEntity = createMeasurePoint(pos); // Create point visual again (or find existing?)
                 measureEntities.push(finalPointEntity); // Track the final point entity
            });

            // 4. Add final result to list
             const finalTotalDisplay = (totalDistance * 1000 < 5000) ? `${(totalDistance * 1000).toFixed(0)} m` : `${totalDistance.toFixed(3)} km`;
             const list = document.getElementById('measurementsList');
             const item = document.createElement('li');
             item.innerText = `Distance: ${finalTotalDisplay}`; item.style.borderBottom = '1px solid #555'; item.style.padding = '2px 0';
             list.appendChild(item); list.scrollTop = list.scrollHeight;
             if (measureWindow) document.getElementById('currentMeasureDisplay').innerText = `Finished: ${finalTotalDisplay}`;

            // 5. Clean up ALL handlers for this measurement instance
            measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK); // <-- Remove this too!
            measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);

            measurePoints = []; // Clear points for next measurement
            console.log("Distance measurement finished. Total:", finalTotalDisplay);

        } else { /* ... cancel logic ... */
             isMeasuring = false;
             if (activeMeasureShape) cesiumViewer.scene.primitives.remove(activeMeasureShape);
             if (floatingMeasurePoint) cesiumViewer.entities.remove(floatingMeasurePoint);
             // Remove the single point entity if it exists
             if (measurePoints.length === 1) {
                 const entityToRemove = cesiumViewer.entities.values.find(e => e.properties?.type === 'point' && e.position?.getValue(cesiumViewer.clock.currentTime)?.equals(measurePoints[0]));
                 if (entityToRemove) cesiumViewer.entities.remove(entityToRemove);
             }
             measurePoints = [];
             measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
             measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
             measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
             if (measureWindow) document.getElementById('currentMeasureDisplay').innerText = 'Total: 0 km';
        }
        updateMeasureButtonState();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    updateMeasureButtonState();
}


function startMeasureArea() {
    measurePoints = [];
    isMeasuring = true;
    activeMeasureShape = null; // Temp outline primitive
    let pointEntitiesThisMeasure = []; // Track points just for this measure attempt

    if (measureWindow) document.getElementById('currentMeasureDisplay').innerText = 'Click first point...';
    if (!measureHandler) measureHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.canvas);
    else { measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK); measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE); measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK); }

    // --- Left Click ---
    measureHandler.setInputAction(function (event) {
        const pickedPosition = cesiumViewer.scene.pickPosition(event.position);
        if (Cesium.defined(pickedPosition)) {
            measurePoints.push(pickedPosition);
            const pointEntity = createMeasurePoint(pickedPosition);
            pointEntitiesThisMeasure.push(pointEntity); // Track points for this specific area

            if (activeMeasureShape) cesiumViewer.scene.primitives.remove(activeMeasureShape);
            if (measurePoints.length > 1) {
                const loop = measurePoints.length > 2;
                activeMeasureShape = drawGroundMeasureShape(measurePoints, loop);
            }
            if (measureWindow) {
                 const pointText = measurePoints.length === 1 ? 'point' : 'points';
                 document.getElementById('currentMeasureDisplay').innerText = `${measurePoints.length} ${pointText}. Right-click to finish.`;
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // --- Mouse Move ---
    measureHandler.setInputAction(function (movement) {
        if (measurePoints.length > 0 && isMeasuring) {
            const currentMousePosition = cesiumViewer.scene.pickPosition(movement.endPosition);
            if (Cesium.defined(currentMousePosition)) {
                 if (activeMeasureShape) cesiumViewer.scene.primitives.remove(activeMeasureShape);
                 const tempPositions = [...measurePoints, currentMousePosition];
                 const loop = tempPositions.length > 2;
                 activeMeasureShape = drawGroundMeasureShape(tempPositions, loop);
                 if (floatingMeasurePoint) cesiumViewer.entities.remove(floatingMeasurePoint);
                 floatingMeasurePoint = cesiumViewer.entities.add({position: currentMousePosition, point: { pixelSize: 5, color: Cesium.Color.RED }, properties: { isMeasurement: true, type: 'temp' }});
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // --- Right Click: Finalize ---
    measureHandler.setInputAction(function () {
        if (measurePoints.length > 2) {
            console.log("Area Measure: Right Click Received. Finalizing.");
            isMeasuring = false;

            // 1. Clean temp visuals
            if (activeMeasureShape) { cesiumViewer.scene.primitives.remove(activeMeasureShape); activeMeasureShape = null; }
            if (floatingMeasurePoint) { cesiumViewer.entities.remove(floatingMeasurePoint); floatingMeasurePoint = null; }

            // 2. Draw FINAL outline and TRACK it
            const finalOutlinePrimitive = drawGroundMeasureShape(measurePoints, true);
            if(finalOutlinePrimitive) measurePrimitives.push(finalOutlinePrimitive);

            // 3. Track the FINAL points created for this measure
            pointEntitiesThisMeasure.forEach(pEnt => {
                 if (!measureEntities.includes(pEnt)) measureEntities.push(pEnt);
            });

            // 4. Calculate area and update window/add FINAL label (label entity is tracked inside update func)
            const totalArea = calculateMeasureArea(measurePoints);
            updateMeasureWindowForArea(totalArea, measurePoints);

            // 5. Clean up ALL handlers for this measurement instance
            measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK); // <-- Remove this too!
            measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);

            measurePoints = []; // <-- Clear points for next measurement
            pointEntitiesThisMeasure = []; // Clear temp point tracker
            console.log("Area measurement finished. Total area:", totalArea.toFixed(3), "km²");

        } else {
            console.log("Area Measure: Right Click - Not enough points. Cancelling.");
            isMeasuring = false;
            if (activeMeasureShape) cesiumViewer.scene.primitives.remove(activeMeasureShape);
            if (floatingMeasurePoint) cesiumViewer.entities.remove(floatingMeasurePoint);
            // Remove point entities created during this attempt
            pointEntitiesThisMeasure.forEach(pEnt => cesiumViewer.entities.remove(pEnt));
            pointEntitiesThisMeasure = [];
            measurePoints = [];

            measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
            if (measureWindow) document.getElementById('currentMeasureDisplay').innerText = 'Area: 0 km²';
        }
        updateMeasureButtonState();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    updateMeasureButtonState();
}


// --- Vertical Measurement ---
function startMeasureVertical() {
    measurePoints = [];
    let startPosition = null, startPositionCartographic = null;
    let verticalLineEntity = null, measureLabelEntity = null; // TEMPORARY refs during creation
    let startPointEntity = null, endPointEntity = null;       // TEMPORARY refs during creation
    isMeasuring = true; let isDrawingLine = false;

    if (measureWindow) document.getElementById('currentMeasureDisplay').innerText = 'Height: 0 m';
    else { createMeasureWindow(); document.getElementById('currentMeasureDisplay').innerText = 'Height: 0 m'; }
    console.log("Starting vertical measurement mode...");

    if (!measureHandler) measureHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.canvas);
    else { measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK); measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE); measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK); }

    // --- Left Click ---
    measureHandler.setInputAction(function (event) {
        console.log("Vertical Measure: Left Click. isDrawingLine:", isDrawingLine);
        const pickedPosition = cesiumViewer.scene.pickPosition(event.position);
        if (!Cesium.defined(pickedPosition)) { console.warn("Vertical Measure: Invalid click position."); return; }

        if (!isDrawingLine) {
            // --- First Click ---
            startPosition = pickedPosition; startPositionCartographic = Cesium.Cartographic.fromCartesian(startPosition);
            measurePoints = [startPosition];
            startPointEntity = createMeasurePoint(startPosition); // Create visual start point
            isDrawingLine = true; isMeasuring = true;
            console.log("Vertical Measure: Start point set.");
             if (measureWindow) document.getElementById('currentMeasureDisplay').innerText = 'Click end point...';
            measureHandler.setInputAction(mouseMoveHandlerVertical, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            measureHandler.setInputAction(rightClickHandlerVerticalCancel, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
        } else {
            // --- Second Click: Finish ---
            console.log("Vertical Measure: Second click. Finalizing.");
            isMeasuring = false; isDrawingLine = false;
            measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
            measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK); // <-- Remove this too!

            const finalEndCartographic = Cesium.Cartographic.fromCartesian(pickedPosition);
            const finalVerticalEndPosition = Cesium.Cartesian3.fromRadians( startPositionCartographic.longitude, startPositionCartographic.latitude, finalEndCartographic.height );
            const finalVerticalDistance = Math.abs(finalEndCartographic.height - startPositionCartographic.height);
            const finalDistanceDisplay = finalVerticalDistance.toFixed(2) + ' m';
            console.log("Vertical Measure: Final distance:", finalDistanceDisplay);

            // 1. Clean temp visuals
            if (floatingMeasurePoint) { cesiumViewer.entities.remove(floatingMeasurePoint); floatingMeasurePoint = null; }
             // Remove temporary line/label if they exist (they might be null if user clicked very fast)
             if (verticalLineEntity && verticalLineEntity.properties?.type === 'temp_line') cesiumViewer.entities.remove(verticalLineEntity);
             if (measureLabelEntity && measureLabelEntity.properties?.type === 'temp_label') cesiumViewer.entities.remove(measureLabelEntity);

            // 2. Create FINAL visuals
            const finalPositions = [startPosition, finalVerticalEndPosition];
            const finalLabelPosition = finalVerticalEndPosition;

            const finalLineEntity = cesiumViewer.entities.add({ // Create FINAL line
                polyline: { positions: finalPositions, material: Cesium.Color.CYAN, width: 3, clampToGround: false },
                properties: { isMeasurement: true, type: 'line' }
            });
            const finalLabelEntity = cesiumViewer.entities.add({ // Create FINAL label
                position: finalLabelPosition,
                label: { text: finalDistanceDisplay, style: Cesium.LabelStyle.FILL_AND_OUTLINE, font: '16px sans-serif', fillColor: Cesium.Color.CYAN, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, horizontalOrigin: Cesium.HorizontalOrigin.CENTER, pixelOffset: new Cesium.Cartesian2(0, -5), heightReference: Cesium.HeightReference.NONE, disableDepthTestDistance: Number.POSITIVE_INFINITY },
                properties: { isMeasurement: true, type: 'label' }
            });
            endPointEntity = createMeasurePoint(finalVerticalEndPosition); // Create FINAL end point

            // 3. TRACK final entities
            measureEntities.push(startPointEntity); // Track start point entity
            measureEntities.push(endPointEntity);   // Track end point entity
            measureEntities.push(finalLineEntity);  // Track final line
            measureEntities.push(finalLabelEntity); // Track final label

            // 4. Update UI list
            updateMeasureWindowForHeight(finalVerticalDistance);

            // 5. Reset state for NEXT measurement
            measurePoints = []; // <-- Clear points array
            startPosition = null; startPositionCartographic = null;
            verticalLineEntity = null; measureLabelEntity = null; // Clear local refs
            startPointEntity = null; endPointEntity = null;

            updateMeasureButtonState();
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // --- Mouse Move Handler ---
    function mouseMoveHandlerVertical(movement) {
        if (!isDrawingLine || !startPosition) return;
        const currentMousePosition = cesiumViewer.scene.pickPosition(movement.endPosition);
        if (!Cesium.defined(currentMousePosition)) {
             if (verticalLineEntity) verticalLineEntity.show = false; if (measureLabelEntity) measureLabelEntity.show = false; if (floatingMeasurePoint) floatingMeasurePoint.show = false;
             return;
        }
        if (verticalLineEntity) verticalLineEntity.show = true; if (measureLabelEntity) measureLabelEntity.show = true; if (floatingMeasurePoint) floatingMeasurePoint.show = true;

        const currentMouseCartographic = Cesium.Cartographic.fromCartesian(currentMousePosition); const currentHeight = currentMouseCartographic.height;
        const verticalEndPosition = Cesium.Cartesian3.fromRadians(startPositionCartographic.longitude, startPositionCartographic.latitude, currentHeight);
        const verticalDistance = Math.abs(currentHeight - startPositionCartographic.height); const distanceDisplay = verticalDistance.toFixed(2) + ' m';
        const positions = [startPosition, verticalEndPosition]; const labelPosition = verticalEndPosition;

        // Create/Update TEMP line (remove previous TEMP if exists)
         if (verticalLineEntity && verticalLineEntity.properties?.type === 'temp_line') {
             verticalLineEntity.polyline.positions = positions;
         } else {
             if(verticalLineEntity) cesiumViewer.entities.remove(verticalLineEntity); // Remove if it wasn't temp (shouldn't happen)
             verticalLineEntity = cesiumViewer.entities.add({ polyline: { positions: positions, material: Cesium.Color.CYAN.withAlpha(0.7), width: 3, clampToGround: false }, properties: { isMeasurement: true, type: 'temp_line' } });
         }
        // Create/Update TEMP label
         if (measureLabelEntity && measureLabelEntity.properties?.type === 'temp_label') {
             measureLabelEntity.position = labelPosition; measureLabelEntity.label.text = distanceDisplay;
         } else {
             if(measureLabelEntity) cesiumViewer.entities.remove(measureLabelEntity); // Remove if it wasn't temp
             measureLabelEntity = cesiumViewer.entities.add({ position: labelPosition, label: { text: distanceDisplay, /* styles */ style: Cesium.LabelStyle.FILL_AND_OUTLINE, font: '16px sans-serif', fillColor: Cesium.Color.CYAN.withAlpha(0.7), outlineColor: Cesium.Color.BLACK, outlineWidth: 2, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, horizontalOrigin: Cesium.HorizontalOrigin.CENTER, pixelOffset: new Cesium.Cartesian2(0, -5), heightReference: Cesium.HeightReference.NONE, disableDepthTestDistance: Number.POSITIVE_INFINITY }, properties: { isMeasurement: true, type: 'temp_label' } });
         }
        // Update Floating point
        if (floatingMeasurePoint) cesiumViewer.entities.remove(floatingMeasurePoint);
        floatingMeasurePoint = cesiumViewer.entities.add({ position: currentMousePosition, point: { pixelSize: 5, color: Cesium.Color.RED }, properties: { isMeasurement: true, type: 'temp' } });
        // Update current display
        if (measureWindow) document.getElementById('currentMeasureDisplay').innerText = `Height: ${distanceDisplay}`;
    }

    // --- Right Click Cancel Handler ---
    function rightClickHandlerVerticalCancel() {
        console.log("Vertical Measure: Right Click Cancel.");
        if (!isDrawingLine) return;
        isMeasuring = false; isDrawingLine = false;

        // Clean up visuals associated with THIS attempt
        if (verticalLineEntity) cesiumViewer.entities.remove(verticalLineEntity); // Temp line
        if (measureLabelEntity) cesiumViewer.entities.remove(measureLabelEntity); // Temp label
        if (floatingMeasurePoint) cesiumViewer.entities.remove(floatingMeasurePoint); // Temp point
        if (startPointEntity) cesiumViewer.entities.remove(startPointEntity); // The start point for this attempt

        // Reset state
        startPosition = null; startPositionCartographic = null;
        verticalLineEntity = null; measureLabelEntity = null;
        floatingMeasurePoint = null; startPointEntity = null; endPointEntity = null;
        measurePoints = [];

        // Remove listeners
        measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
        // LEFT_CLICK listener might still be active, remove it too for clean cancel
        measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);


        if (measureWindow) document.getElementById('currentMeasureDisplay').innerText = 'Height: 0 m';
        updateMeasureButtonState();
    }
    updateMeasureButtonState();
    console.log("Vertical measurement mode ready. Click start point.");
}


// --- Cleanup and State Management ---

// Clears ALL finished measurement visuals from the map (Entities and Primitives)
function clearMeasurements() {
  console.log(`Attempting to clear tracked visuals: ${measureEntities.length} Entities, ${measurePrimitives.length} Primitives.`);

  // --- 1. Clear Entities based on isMeasurement property ---
  // (Using your preferred method which iterates all entities)
  const entitiesToRemove = [];
  try {
      cesiumViewer.entities.values.forEach(entity => {
          // Check for the property efficiently
          if (entity?.properties?.isMeasurement?.getValue(cesiumViewer.clock.currentTime)) {
               entitiesToRemove.push(entity);
          }
           // Safety check for floating point just in case it wasn't cleared
           if (entity === floatingMeasurePoint) {
                if (!entitiesToRemove.includes(entity)) {
                     entitiesToRemove.push(entity);
                }
                floatingMeasurePoint = null; // Clear ref immediately
           }
      });

      console.log(`Found ${entitiesToRemove.length} entities with isMeasurement property.`);
      entitiesToRemove.forEach(entity => {
          cesiumViewer.entities.remove(entity);
      });
       console.log("Finished removing entities by property.");

  } catch (e) {
       console.error("Error during entity removal by property:", e);
  }
   // Clear the entity tracking array as we removed based on property, not the array content
   measureEntities = [];


  // --- 2. Clear Primitives tracked in measurePrimitives array ---
  let primitivesToRemove = [...measurePrimitives]; // Clone array
  console.log(`Removing ${primitivesToRemove.length} tracked primitives.`);
  primitivesToRemove.forEach(primitive => {
      if (primitive && !primitive.isDestroyed()) {
          try {
              cesiumViewer.scene.primitives.remove(primitive);
          } catch (e) {
              console.warn("Error removing tracked primitive:", e, primitive?.geometryInstances?.id);
          }
      }
  });
  measurePrimitives = []; // Clear the primitive tracking array

  // --- 3. Reset temporary state ---
  activeMeasureShape = null;
  if (floatingMeasurePoint && cesiumViewer.entities.contains(floatingMeasurePoint)){
       // Should have been caught above, but double check
        cesiumViewer.entities.remove(floatingMeasurePoint);
        floatingMeasurePoint = null;
  }

  console.log("Visual cleanup finished.");
}

// Clears all visuals AND data/UI - Called by Trash button
function clearAllMeasurementsAndData() {
    console.log("Clear All button clicked.");
    clearMeasurements(); // Clear visuals
    measurePoints = [];   // Clear points array from any current measurement

    // Reset UI display completely
    if (measureWindow) {
        document.getElementById('measurementsList').innerHTML = '';
        const display = document.getElementById('currentMeasureDisplay');
        display.innerText = 'Cleared. Select type.'; // Default message
    }

    // Stop any active measurement handlers
    isMeasuring = false;
    if (measureHandler) {
         measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
         measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
         measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }
    measureType = ''; // Clear type
    updateMeasureButtonState(); // Update buttons (none active)
}


function closeMeasureWindow() {
    if (measureHandler) {
        measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
        measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        if (!measureHandler.isDestroyed()) measureHandler.destroy();
        measureHandler = null;
    }
    isMeasuring = false;
    clearMeasurements(); // Clear ALL visuals when closing window

    if (measureWindow) {
        document.body.removeChild(measureWindow);
        measureWindow = null;
    }
    enableDoubleClickZoom();
    enableInfoBoxPicking(); // Use new function
    // updateMeasureButtonState is called implicitly by closing window (measureWindow becomes null)
}

function toggleMeasurement() {
    if (measureWindow) closeMeasureWindow();
    else openMeasureWindow();
}

function updateMeasureButtonState() {
    const activeColor = 'rgba(70, 130, 180, 0.8)';
    const buttons = [ { id: 'distanceMeasurementButton', type: 'distance' }, { id: 'areaMeasurementButton', type: 'area' }, { id: 'verticalMeasurementButton', type: 'vertical' } ];
    buttons.forEach(bInfo => {
        const button = document.getElementById(bInfo.id);
        if (button) {
            if (measureWindow && measureType === bInfo.type) { button.style.backgroundColor = activeColor; button.style.borderRadius = '3px'; }
            else { button.style.backgroundColor = ''; button.style.borderRadius = ''; }
        }
    });
}

function setMeasureType(type) {
    if (!measureWindow) { // Should not happen if called from buttons, but safety check
         openMeasureWindow(); // Open window if not already open
    }

    if (measureHandler) {
        measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    } else {
        measureHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.canvas);
    }

    measureType = type;
    isMeasuring = false; // Reset flag for the new mode

    // Reset the current measure display in the window
     if (measureWindow) {
         const display = document.getElementById('currentMeasureDisplay');
         if (type === 'distance') display.innerText = 'Click start point...';
         else if (type === 'area') display.innerText = 'Click first point...';
         else if (type === 'vertical') display.innerText = 'Click start point...';
     }

    // Start the selected measurement logic
    if (type === 'distance') startMeasureDistance();
    else if (type === 'area') startMeasureArea();
    else if (type === 'vertical') startMeasureVertical();
    updateMeasureButtonState();
}

function openMeasureWindow() {
    if (measureWindow) return;
    createMeasureWindow();
    disableDoubleClickZoom();
    disableInfoBoxPicking(); // Use new override method
    setMeasureType('distance'); // Start with distance mode active
}

// --- Default Interaction Disabling/Enabling ---
function disableDoubleClickZoom() {
    cesiumViewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}
function enableDoubleClickZoom() {
    if (!measureWindow && !measureHandler) { // Only if tool fully closed
         try { cesiumViewer.screenSpaceEventHandler.setInputAction(c => cesiumViewer.camera.zoomIn(), Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK); }
         catch(e) { console.warn("Could not re-enable double click zoom:", e); }
    }
}

// --- InfoBox Management (using selectedEntity override) ---
function disableInfoBoxPicking() {
    try {
        if (!originalCesiumSelectedEntityDescriptor && Object.getOwnPropertyDescriptor(cesiumViewer, 'selectedEntity')) {
             originalCesiumSelectedEntityDescriptor = Object.getOwnPropertyDescriptor(cesiumViewer, 'selectedEntity');
        }
         Object.defineProperty(cesiumViewer, 'selectedEntity', { configurable: true, get: () => undefined, set: (v) => {} });
          if(cesiumViewer.selectedEntityViewModel) cesiumViewer.selectedEntityViewModel.selectedEntity = undefined;
         console.log("InfoBox Picking Disabled");
    } catch (e) { console.error("Error disabling InfoBox:", e); }
}
function enableInfoBoxPicking() {
     try {
         if (originalCesiumSelectedEntityDescriptor) {
             Object.defineProperty(cesiumViewer, 'selectedEntity', originalCesiumSelectedEntityDescriptor);
             originalCesiumSelectedEntityDescriptor = null;
             console.log("InfoBox Picking Enabled");
         }
     } catch(e) { console.error("Error enabling InfoBox:", e); }
}