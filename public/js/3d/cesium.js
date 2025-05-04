var loadedLayers = {};
var cesiumViewer, scene;

// Cargar el token de Cesium desde el servidor y configurar el visor
fetch('/3d/api/load-cesium-token')
  .then(response => {
    if (!response.ok) {
      throw new Error(`Error fetching Cesium token: ${response.statusText}`);
    }
    return response.json();
  })
  .then(config => {
    if (!config.cesiumToken) {
      throw new Error("Cesium token is missing in the configuration.");
    }
    Cesium.Ion.defaultAccessToken = config.cesiumToken;
    Cesium.InfoBoxViewModel.defaultSanitizer = rawHtml => rawHtml;

    // Crear el visor de Cesium con timeline y animation activados
    window.cesiumViewer = new Cesium.Viewer("cesiumContainer", {
      selectionIndicator: false,
      baseLayerPicker: false,
      infoBox: true,
      geocoder: true,
      navigationHelpButton: false,
      fullscreenButton: false,
      homeButton: false,
      timeline: true,
      animation: true,
      sceneModePicker: false,
      shouldAnimate: true,
      contextOptions: {
        webgl: {
          antialias: true
        }
      }

    });


    cesiumViewer.scene.globe.depthTestAgainstTerrain = true;

    // Ocultar timeline y animation al inicio
    cesiumViewer.timeline.container.style.display = 'none';
    cesiumViewer.animation.container.style.display = 'none';
    cesiumViewer.clock.shouldAnimate = true;


    setupCesium();
  })
  .catch(error => {
    console.error("Error loading Cesium configuration:", error);
  });

let isPositioningActive = false;

function setupCesium() {

  // Inicializar navegación si está disponible
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
  try {
    const scene = cesiumViewer.scene;

    if (!scene.screenSpaceEventHandler) {
      scene.screenSpaceEventHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    }

      // Quitar el imagery por defecto (capa base)
      cesiumViewer.imageryLayers.removeAll(true);

      // Establecer el color del globo a gris claro
    cesiumViewer.scene.globe.baseColor = Cesium.Color.LIGHTGRAY;

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

    // Suponiendo que ya tienes el visor configurado...
    const dropArea = document.getElementById("cesiumContainer");
    dropArea.addEventListener("drop", async (event) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (!file) return;
      const extension = file.name.split('.').pop().toLowerCase();
      if (extension === "gltf" || extension === "glb") {
        const url = URL.createObjectURL(file);
        try {
          const model = await Cesium.Model.fromGltfAsync({
            url: url,
            modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.ZERO),
            scale: 1.0
          });
          cesiumViewer.scene.primitives.add(model);
          // Activa animaciones si el modelo las tiene:
          if (model.gltf && model.gltf.animations && model.gltf.animations.length > 0) {
            for (let i = 0; i < model.gltf.animations.length; i++) {
              model.activeAnimations.add({
                index: i,
                loop: Cesium.ModelAnimationLoop.REPEAT,
                multiplier: 1.0
              });
            }
          }
        } catch (error) {
          console.error("Error loading glTF/GLB model:", error);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    });
    dropArea.addEventListener("dragover", (event) => {
      event.preventDefault();
    });


    const clouds = scene.primitives.add(new Cesium.CloudCollection());

    const cloudParameters = {
      baseHeight: 50, // Altura inicial entre 50 y 500
      separation: 0.02,
      brightness: 0.8,
      scaleX: 100,
      scaleY: 100,
      color: "White",
      colors: ["White", "Red", "Green", "Blue", "Yellow", "Gray"],
    };

    Cesium.knockout.track(cloudParameters);
    const toolbar = document.getElementById("skyboxWidget");
    Cesium.knockout.applyBindings(cloudParameters, toolbar);

    let currentCloudPositions = []; // Guardar posiciones actuales para reutilizarlas

    function addClouds(centerPosition) {
      clouds.removeAll();

      const baseLatitude = centerPosition?.latitude ?? 59.323841;
      const baseLongitude = centerPosition?.longitude ?? 17.978149;

      currentCloudPositions = []; // Reiniciar las posiciones actuales

      for (let i = 0; i < 70; i++) {
        const randomOffsetLat = (Math.random() - 0.5) * cloudParameters.separation;
        const randomOffsetLon = (Math.random() - 0.5) * cloudParameters.separation;

        const position = Cesium.Cartesian3.fromDegrees(
          baseLongitude + randomOffsetLon,
          baseLatitude + randomOffsetLat,
          cloudParameters.baseHeight // Usar la altura dinámica
        );

        currentCloudPositions.push({
          longitude: baseLongitude + randomOffsetLon,
          latitude: baseLatitude + randomOffsetLat,
        });

        clouds.add({
          position: position,
          scale: new Cesium.Cartesian2(cloudParameters.scaleX, cloudParameters.scaleY),
          color: Cesium.Color[cloudParameters.color.toUpperCase()] || Cesium.Color.WHITE,
          brightness: cloudParameters.brightness,
        });
      }

      console.log(`Clouds added at: ${baseLatitude}, ${baseLongitude}`);
    }

    function updateCloudsProperties() {
      clouds._clouds.forEach((cloud, index) => {
        const positionData = currentCloudPositions[index];
        if (!positionData) return;

        cloud.scale = new Cesium.Cartesian2(cloudParameters.scaleX, cloudParameters.scaleY);
        cloud.brightness = cloudParameters.brightness;
        cloud.color = Cesium.Color[cloudParameters.color.toUpperCase()] || Cesium.Color.WHITE;

        cloud.position = Cesium.Cartesian3.fromDegrees(
          positionData.longitude,
          positionData.latitude,
          cloudParameters.baseHeight // Actualizar solo la altura
        );
      });
      console.log("Cloud properties updated dynamically.");
    }

    function updateCloudSeparation() {
      clouds.removeAll();

      currentCloudPositions.forEach((positionData) => {
        const randomOffsetLat = (Math.random() - 0.5) * cloudParameters.separation;
        const randomOffsetLon = (Math.random() - 0.5) * cloudParameters.separation;

        positionData.longitude += randomOffsetLon;
        positionData.latitude += randomOffsetLat;

        const position = Cesium.Cartesian3.fromDegrees(
          positionData.longitude,
          positionData.latitude,
          cloudParameters.baseHeight
        );

        clouds.add({
          position: position,
          scale: new Cesium.Cartesian2(cloudParameters.scaleX, cloudParameters.scaleY),
          color: Cesium.Color[cloudParameters.color.toUpperCase()] || Cesium.Color.WHITE,
          brightness: cloudParameters.brightness,
        });
      });

      console.log("Cloud separation updated dynamically.");
    }
    enableDragDrop();
    addClouds(); // Añadir nubes iniciales

    //const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  /*   handler.setInputAction((movement) => {
      if (isPositioningActive) {
        const pickedPosition = scene.pickPosition(movement.position);
        if (Cesium.defined(pickedPosition)) {
          const cartographic = Cesium.Cartographic.fromCartesian(pickedPosition);
          const latitude = Cesium.Math.toDegrees(cartographic.latitude);
          const longitude = Cesium.Math.toDegrees(cartographic.longitude);

          console.log(`Cloud center set to: ${latitude}, ${longitude}`);
          addClouds({ latitude, longitude });

          isPositioningActive = false; // Desactivar después de elegir la posición
          console.log("Cloud positioning deactivated.");
        } else {
          console.error("Could not pick a valid position on the map.");
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK); */

    // Suscripciones a cambios dinámicos
    Cesium.knockout.getObservable(cloudParameters, "baseHeight").subscribe(() => updateCloudsProperties());
    Cesium.knockout.getObservable(cloudParameters, "separation").subscribe(() => updateCloudSeparation());
    Cesium.knockout.getObservable(cloudParameters, "scaleX").subscribe(() => updateCloudsProperties());
    Cesium.knockout.getObservable(cloudParameters, "scaleY").subscribe(() => updateCloudsProperties());
    Cesium.knockout.getObservable(cloudParameters, "brightness").subscribe(() => updateCloudsProperties());
    Cesium.knockout.getObservable(cloudParameters, "color").subscribe(() => updateCloudsProperties());

    console.log("Cloud configuration complete.");
  } catch (error) {
    console.error("Error in setupCesium:", error);
  }
  // Inicialmente deshabilitamos la funcionalidad de medición
  //closeMeasureWindow();
}


function activateCloudPositioning() {
  isPositioningActive = true;
  console.log("Click on the map to set cloud position.");
}

function toggleSkyboxWidget() {
  const skyboxWidget = document.getElementById("skyboxWidget");
  if (skyboxWidget) {
    if (skyboxWidget.classList.contains("hidden")) {
      skyboxWidget.classList.remove("hidden");
    } else {
      skyboxWidget.classList.add("hidden");
    }
  } else {
    console.error("Skybox widget not found.");
  }
}




// Capturar errores globales
window.addEventListener("error", (event) => {
  console.error("Global error caught:", event);
});




// Alternar visibilidad de timeline
function toggleTimeline() {
  try {
    const timelineElement = cesiumViewer.timeline.container;
    const animationElement = cesiumViewer.animation.container;

    if (timelineElement.style.display === 'none') {
      cesiumViewer.timeline.show = true;
      cesiumViewer.animation.viewModel.shouldAnimate = true;
      timelineElement.style.display = 'block';
      animationElement.style.display = 'block';
    } else {
      cesiumViewer.timeline.show = false;
      cesiumViewer.animation.viewModel.shouldAnimate = false;
      timelineElement.style.display = 'none';
      animationElement.style.display = 'none';
    }
  } catch (error) {
    console.error("Error toggling timeline:", error);
  }
}

// Alternar sombras en la escena
function toggleShadows() {
  try {
    const scene = cesiumViewer.scene;
    scene.shadowMap.enabled = !scene.shadowMap.enabled;
    scene.globe.enableLighting = scene.shadowMap.enabled;
    console.log(`Shadows are now ${scene.shadowMap.enabled ? 'enabled' : 'disabled'}.`);
  } catch (error) {
    console.error("Error toggling shadows:", error);
  }
}

// Variables globales de simulación
let simulationHandler = null;
let isContainerCollapsed = false;
let simulationPitch = 0;
let simulationSpeed = 0.00050;
let isPaused = false;
let simulationActiveShape = null;
let simulationActiveShapePoints = [];
let focusPoint = null;
let focusPointEntity = null;

// Manejo de errores globales de Cesium
window.addEventListener("error", event => {
  console.error("Global error caught:", event);
});
