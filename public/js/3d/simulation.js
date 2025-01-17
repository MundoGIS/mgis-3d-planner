
function resetSimulationState() {
    // Limpiar la línea activa
    if (simulationActiveShape) {
        cesiumViewer.entities.remove(simulationActiveShape);
        simulationActiveShape = null;
    }

    // Limpiar puntos de la simulación
    if (simulationActiveShapePoints) {
        simulationActiveShapePoints.length = 0;
    }

    // Limpiar el punto de enfoque
    if (focusPointEntity) {
        cesiumViewer.entities.remove(focusPointEntity);
        focusPointEntity = null;
    }
    focusPoint = null;

    // Destruir el handler si está activo
    if (simulationHandler) {
        simulationHandler.destroy();
        simulationHandler = null;
    }

    console.log("Simulation state has been reset.");
}


document.getElementById('cameraHeight').addEventListener('input', async () => {
    if (simulationActiveShapePoints && simulationActiveShapePoints.length > 0) {
        const newAdjustedPositions = await adjustPositionsToTerrain(simulationActiveShapePoints);
        // Puedes aplicar el nuevo conjunto de posiciones ajustadas aquí si es necesario
        console.log('Positions recalculated with new height offset');
    }
});


function createSimulationLine(positionData) {
    console.log("createSimulationLine called with:", positionData);

    if (!Array.isArray(positionData) || positionData.length < 2) {
        console.error("Invalid position data for simulation line:", positionData);
        return null;
    }

    const validPositions = positionData.filter(pos => Cesium.defined(pos)); // Filtrar posiciones válidas
    if (validPositions.length < 2) {
        console.error("Not enough valid positions for simulation line:", validPositions);
        return null;
    }

    return cesiumViewer.entities.add({
        polyline: {
            positions: validPositions,
            width: 5,
            material: Cesium.Color.WHITE,
            clampToGround: true,
        },
        properties: { isSimulation: true },
    });
}






function startFocusPointSelection() {
    closeFocusPointDialog(); // Cierra el diálogo antes de empezar
    if (!cesiumViewer || !cesiumViewer.scene || !cesiumViewer.scene.canvas) {
        console.error("Cesium viewer or scene not initialized");
        return;
    }

    if (simulationHandler) simulationHandler.destroy(); // Limpia cualquier handler previo
    simulationHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.scene.canvas);

    simulationHandler.setInputAction((event) => {
        const earthPosition = cesiumViewer.scene.pickPosition(event.position);
        if (Cesium.defined(earthPosition)) {
            focusPoint = Cesium.Cartesian3.clone(earthPosition);

            if (focusPointEntity) cesiumViewer.entities.remove(focusPointEntity); // Limpia marcador previo
            focusPointEntity = cesiumViewer.entities.add({
                position: focusPoint,
                point: {
                    color: Cesium.Color.YELLOW,
                    pixelSize: 10,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                },
            });

            simulationHandler.destroy();
            simulationHandler = null;

            showMessage("Focus point selected. Start drawing your path.");
            activateSimulationTool();
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}


function activateSimulationTool() {
    if (simulationHandler) simulationHandler.destroy();
    simulationActiveShapePoints = [];
    simulationHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.scene.canvas);

    simulationHandler.setInputAction((event) => {
        const earthPosition = cesiumViewer.scene.pickPosition(event.position);
        if (Cesium.defined(earthPosition)) {
            if (simulationActiveShapePoints.length === 0) {
                const dynamicPositions = new Cesium.CallbackProperty(() => simulationActiveShapePoints, false);
                simulationActiveShape = createSimulationLine(dynamicPositions);
            }
            simulationActiveShapePoints.push(earthPosition);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    simulationHandler.setInputAction(() => {
        finalizeSimulationLine();
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}

function finalizeSimulationLine() {
    if (Cesium.defined(simulationActiveShape)) {
        cesiumViewer.entities.remove(simulationActiveShape);
        createSimulationLine(simulationActiveShapePoints); // Crear la línea final
    }
    simulationActiveShape = null;

    if (simulationHandler) {
        simulationHandler.destroy();
        simulationHandler = null;
    }

    const simulationControlsContainer = document.getElementById('simulationControlsContainer');
    if (simulationControlsContainer) {
        simulationControlsContainer.style.display = 'block';
    }

    showMessage("Your path is ready. Adjust the controls and click Play to start.");
    enablePlayButton();
}


function enablePlayButton() {
    const playButton = document.getElementById('simulationPlayButton');
    if (playButton) {
        playButton.classList.add('active');
        playButton.onclick = toggleSimulation;
    }
}

function toggleSimulation() {
    isPaused = !isPaused;

    const playButton = document.getElementById('simulationPlayButton');
    if (playButton) {
        playButton.textContent = isPaused ? "Play" : "Pause";
    }

    if (!isPaused && simulationActiveShapePoints.length > 1) {
        startSimulation(simulationActiveShapePoints);
    }
}

async function startSimulation(positions) {
    if (!focusPoint || !positions || positions.length < 2) {
        showMessage("Select a focus point and draw a path before starting the simulation.");
        return;
    }

    // Ajustar posiciones con la altura dinámica
    const adjustedPositions = await adjustPositionsToTerrain(positions);

    if (!adjustedPositions || adjustedPositions.length < 2) {
        console.error("Adjusted positions are invalid or insufficient for simulation.");
        showMessage("Error: Simulation path could not be created.");
        return;
    }

    let index = 0;
    let t = 0;

    const flyToNextPoint = () => {
        if (isPaused || index >= adjustedPositions.length - 1) return;
    
        const startPosition = adjustedPositions[index];
        const endPosition = adjustedPositions[index + 1];
    
        if (!Cesium.defined(startPosition) || !Cesium.defined(endPosition)) {
            console.error("Invalid positions for interpolation:", { startPosition, endPosition });
            return;
        }
    
        const currentPosition = Cesium.Cartesian3.lerp(startPosition, endPosition, t, new Cesium.Cartesian3());
    
        const heading = calculateHeading(currentPosition, focusPoint);
        cesiumViewer.camera.setView({
            destination: currentPosition,
            orientation: {
                heading: heading,
                pitch: Cesium.Math.toRadians(simulationPitch),
                roll: 0,
            },
        });
    
        t += simulationSpeed;
        if (t >= 1) {
            t = 0;
            index++;
        }
    
        if (!isPaused) {
            requestAnimationFrame(flyToNextPoint);
        }
    };
    

    flyToNextPoint();
}




async function adjustPositionsToTerrain(positions, heightOffsetInputId = 'cameraHeight') {
    const heightOffset = parseFloat(document.getElementById(heightOffsetInputId)?.value) || 10; // Valor predeterminado
    console.log(`Adjusting positions with height offset: ${heightOffset} meters`);

    if (!positions || positions.length === 0) {
        console.error("No positions provided for terrain adjustment.");
        return [];
    }

    const cartographicPositions = positions.map(pos => Cesium.Cartographic.fromCartesian(pos)).filter(pos => pos); // Filtrar valores válidos

    const updatedPositions = await Cesium.sampleTerrainMostDetailed(cesiumViewer.terrainProvider, cartographicPositions);

    return updatedPositions
        .filter(pos => pos && Cesium.defined(pos.height)) // Validar posiciones con altura
        .map(pos => Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, pos.height + heightOffset));
}






function calculateHeading(fromPosition, toPosition) {
    const fromCartographic = Cesium.Cartographic.fromCartesian(fromPosition);
    const toCartographic = Cesium.Cartographic.fromCartesian(toPosition);
    return Math.atan2(
        toCartographic.longitude - fromCartographic.longitude,
        toCartographic.latitude - fromCartographic.latitude
    );
}

function showMessage(message) {
    const messageBox = document.getElementById('messageBox');
    if (messageBox) {
        messageBox.textContent = message;
        messageBox.style.display = 'block';
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 4000);
    }
}




function toggleSimulationControls(show) {
    const simulationControls = document.getElementById('simulationControlsContainer');
    if (simulationControls) {
        simulationControls.style.display = show ? 'block' : 'none';
    } else {
        console.error("Element 'simulationControlsContainer' not found.");
    }
}


// Cerrar un diálogo
function closeDialog(dialogId) {
    document.getElementById(dialogId).style.display = 'none';
}

function toggleSimulationControls() {
    const content = document.getElementById('simulationControlsContent');
    const toggleButton = document.getElementById('toggleContainerButton');

    if (!content || !toggleButton) {
        console.error('Simulation controls content or toggle button not found.');
        return;
    }

    if (isContainerCollapsed) {
        content.style.display = 'block'; // Mostrar el contenido
        toggleButton.textContent = '−'; // Cambiar a botón de minimizar
    } else {
        content.style.display = 'none'; // Ocultar el contenido
        toggleButton.textContent = '+'; // Cambiar a botón de maximizar
    }

    isContainerCollapsed = !isContainerCollapsed; // Alternar el estado
}


// Cerrar los controles y limpiar la simulación


// Actualizar velocidad de la simulación
function updateSpeed(value) {
    simulationSpeed = parseFloat(value); // Actualiza la velocidad global
    const speedValueElement = document.getElementById('speedValue');
    if (speedValueElement) {
        speedValueElement.textContent = simulationSpeed.toFixed(4); // Muestra la velocidad en el control
    }
}

function updatePitch(value) {
    simulationPitch = parseFloat(value); // Actualiza el pitch global
    const pitchValueElement = document.getElementById('pitchValue');
    if (pitchValueElement) {
        pitchValueElement.textContent = `${simulationPitch}°`; // Muestra el pitch en el control
    }
}


function closeSimulationControls() {
    const simulationControls = document.getElementById('simulationControlsContainer');
    if (simulationControls) {
        simulationControls.style.display = 'none'; // Ocultar controles
    }

    isPaused = true;

    // Limpia el handler de eventos
    if (typeof simulationHandler !== 'undefined' && simulationHandler !== null) {
        simulationHandler.destroy();
        simulationHandler = null;
    }

    // Elimina la línea activa
    if (simulationActiveShape) {
        cesiumViewer.entities.remove(simulationActiveShape);
        simulationActiveShape = null;
    }

    // Limpia las posiciones
    if (simulationActiveShapePoints) {
        simulationActiveShapePoints.length = 0;
    }

    // Elimina el punto de enfoque
    if (focusPointEntity) {
        cesiumViewer.entities.remove(focusPointEntity);
        focusPointEntity = null;
    }

    focusPoint = null;

    showMessage('Simulation stopped, all entities cleared, and controls closed.');
}





function openFocusPointDialog() {
    const focusPointDialog = document.getElementById('focusPointDialog');
    if (focusPointDialog) {
        focusPointDialog.style.display = 'block'; // Muestra el diálogo
    } else {
        console.error('Focus Point Dialog element not found in the DOM.');
    }
}

function closeFocusPointDialog() {
    const focusPointDialog = document.getElementById('focusPointDialog');
    if (focusPointDialog) {
        focusPointDialog.style.display = 'none'; // Ocultar el diálogo
    }
}


// Exponer funciones globalmente
window.SimulationModule = {
    ...window.SimulationModule, // Esto conserva las funciones existentes
    updateSpeed, // Agrega la función updateSpeed al módulo
    updatePitch, // Si ocurre lo mismo con updatePitch, agrégalo también
    toggleSimulationControls,
    closeSimulationControls,
    startFocusPointSelection,
    activateSimulationTool,
    toggleSimulation,
};













