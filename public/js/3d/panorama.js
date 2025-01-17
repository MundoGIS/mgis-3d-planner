


  function openCustomInfoBox(entity) {
    const infoBox = document.getElementById('customInfoBox');
    const infoBoxContent = document.getElementById('customInfoBoxContent');

    infoBox.style.display = 'block';
    infoBox.style.width = '600px'; // Ajusta el ancho según lo necesites

    // Inserta contenido personalizado
    infoBoxContent.innerHTML = `
        <h3>${entity.name}</h3>
        <p><abbr title="Rabalshede Kraft">Adress:</abbr> Marknadsvägen 1 45755 RABBALSHEDE</p>
        <p>Descripción: Bilden skapdes av Jörgen Karlsson med en Mavic pro drönare.</p>
        <div id="panoramaViewer" style="width: 100%; height: 300px;"></div>
    `;

    // Inicializa Pannellum con opciones extendidas
    pannellum.viewer('panoramaViewer', {
      type: 'equirectangular',
      panorama: 'https://tiles.rabbalshedekraft.se/data/pano/20m.JPG',
      autoLoad: true,
      compass: true,
      showZoomCtrl: true,
      defaultFov: 75, // Campo de visión inicial (puedes ajustar el valor)
      autoRotate: -2, // Rotación automática, negativo para rotación inversa
      hotspots: [
        {
          pitch: 10, // Ángulo vertical
          yaw: 45, // Ángulo horizontal
          type: 'info',
          text: '¡Punto de interés!', // Texto mostrado al interactuar
          createTooltipFunc: hotspot => {
            const span = document.createElement('span');
            span.classList.add('custom-hotspot-tooltip');
            span.innerText = hotspot.text;
            return span;
          }
        }
      ],
      showFullscreenCtrl: true // Muestra el botón de pantalla completa
    });
  }



  // Cierra el InfoBox personalizado
  window.closeCustomInfoBox = function () {
    document.getElementById('customInfoBox').style.display = 'none';
    // Restablece la entidad seleccionada a null
    cesiumViewer.selectedEntity = null;
  };

  // Evento para abrir el InfoBox personalizado al seleccionar la entidad
  cesiumViewer.selectedEntityChanged.addEventListener(function () {
    const selectedEntity = cesiumViewer.selectedEntity;
    if (selectedEntity && selectedEntity.id === 'Rabbalshede-Kraft') {
      openCustomInfoBox(selectedEntity);
    } else {
      closeCustomInfoBox();
    }
  });

  // Configuración del icono en el mapa
  const pinBuilder = new Cesium.PinBuilder();
  const url_camara = Cesium.buildModuleUrl('https://int.rabbalshedekraft.se/CesiumIkons/Textures/maki/camera.png');

  pinBuilder.fromUrl(url_camara, Cesium.Color.GREEN, 48)
    .then(function (canvas) {
      return cesiumViewer.entities.add({
        id: 'Rabbalshede-Kraft',
        name: 'Demo Panorama',
        description: `
          <p><abbr title="Rabalshede Kraft">Adress:</abbr> Marknadsvägen 1 45755 RABBALSHEDE</p>
          <p>Descripción: Bilden skapdes av Jörgen Karlsson med en Mavic pro drönare.</p>
        `,
        position: Cesium.Cartesian3.fromDegrees(11.458393, 58.617779, 150),
        billboard: {
          image: canvas.toDataURL(),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM
        }
      });
    });











