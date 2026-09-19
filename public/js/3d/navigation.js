(function () {
  function initCustomNavigation() {
    const viewer = window.cesiumViewer;
    if (!viewer || !viewer.camera) {
      return;
    }

    const existing = document.getElementById('customNavigation');
    if (existing) {
      existing.remove();
    }

    const nav = document.createElement('div');
    nav.id = 'customNavigation';
    nav.setAttribute('aria-label', 'Cesium navigation controls');

    const actions = [
      { label: 'Home', title: 'Reset view', icon: '⌂', action: () => resetToDefaultView(viewer) },
      { label: 'North', title: 'North up', icon: '⬆', action: () => northUp(viewer) },
      { label: 'Zoom In', title: 'Zoom in', icon: '+', action: () => viewer.camera.zoomIn(200) },
      { label: 'Zoom Out', title: 'Zoom out', icon: '−', action: () => viewer.camera.zoomOut(200) },
    ];

    actions.forEach(({ label, title, icon, action }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'custom-nav-button';
      button.title = title;
      button.setAttribute('aria-label', label);
      button.innerHTML = icon;
      button.addEventListener('click', action);
      nav.appendChild(button);
    });

    const container = document.getElementById('cesiumContainer');
    if (container) {
      container.appendChild(nav);
    }
  }

  function resetToDefaultView(viewer) {
    const defaultView = {
      destination: Cesium.Rectangle.fromDegrees(10, 55, 24, 69),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
    };

    viewer.camera.flyTo(defaultView);
  }

  function northUp(viewer) {
    viewer.camera.flyTo({
      destination: viewer.camera.positionWC,
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: viewer.camera.pitch,
        roll: 0,
      },
      duration: 0.8,
    });
  }

  window.addEventListener('cesium-viewer-ready', initCustomNavigation);
  window.addEventListener('load', () => {
    if (window.cesiumViewer && window.cesiumViewer.camera) {
      initCustomNavigation();
    }
  });
})();
