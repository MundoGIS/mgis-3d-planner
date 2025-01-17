// cesium-talk.js

document.addEventListener('DOMContentLoaded', function () {
  let addingIcons = false;
  let selectedIcon = null;
  let showingMessages = true;

  function toggleIconSelector() {
    addingIcons = !addingIcons;
    const iconSelector = document.getElementById('iconSelector');
    iconSelector.style.display = addingIcons ? 'block' : 'none';
    iconSelector.style.left = `${document.getElementById('addIconBtn').offsetLeft + document.getElementById('addIconBtn').offsetWidth + 10}px`;
    iconSelector.style.top = `${document.getElementById('addIconBtn').offsetTop}px`;
    selectedIcon = null;

    if (addingIcons) {
      document.addEventListener('click', closeIconSelectorOnClickOutside);
    } else {
      document.removeEventListener('click', closeIconSelectorOnClickOutside);
    }
  }

  function closeIconSelectorOnClickOutside(event) {
    const iconSelector = document.getElementById('iconSelector');
    const addIconBtn = document.getElementById('addIconBtn');
    if (!iconSelector.contains(event.target) && !addIconBtn.contains(event.target)) {
      iconSelector.style.display = 'none';
      document.removeEventListener('click', closeIconSelectorOnClickOutside);
      addingIcons = false;
    }
  }

  function getIconUrl(iconType) {
    switch (iconType) {
      case 'happy':
        return '/public/css/icons/smile.png';
      case 'semi-arg':
        return '/public/css/icons/sad.png';
      case 'arg':
        return '/public/css/icons/arg.png';
      default:
        return '/public/css/icons/default_.png';
    }
  }

  document.getElementById('addIconBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    toggleIconSelector();
    if (addingIcons) {
      cesiumViewer.screenSpaceEventHandler.setInputAction(function (click) {
        if (!selectedIcon) return;

        const pickedPosition = cesiumViewer.scene.pickPosition(click.position);
        if (!Cesium.defined(pickedPosition)) {
          return;
        }

        const cartographic = Cesium.Cartographic.fromCartesian(pickedPosition);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);

        const message = prompt('Enter your message:');
        if (message) {
          const iconUrl = getIconUrl(selectedIcon);

          const newEntity = cesiumViewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 50),
            billboard: {
              image: iconUrl,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              width: 32,
              height: 32,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            },
            label: {
              text: message,
              font: '14px sans-serif',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -60),
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              showBackground: true,
              backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
              backgroundPadding: new Cesium.Cartesian2(7, 5),
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              wrap: true,
              maximumWidth: 200,
            },
            description: `<p style="max-width: 200px; max-height: 400px; overflow: auto; white-space: pre-wrap;">${message}</p>`
          });

          saveMessage(longitude, latitude, message, selectedIcon);
          addRightClickListener(newEntity, longitude, latitude); // Añadir listener con coordenadas

          selectedIcon = null;
          iconSelector.style.display = 'none';
          addingIcons = false;
          cesiumViewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
          document.removeEventListener('click', closeIconSelectorOnClickOutside);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    } else {
      cesiumViewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
  });

  const toggleMessagesBtn = document.getElementById('toggleMessagesBtn');
  if (toggleMessagesBtn) {
    toggleMessagesBtn.addEventListener('click', () => {
      showingMessages = !showingMessages;
      cesiumViewer.entities.values.forEach(entity => {
        if (entity.billboard) {
          entity.billboard.show = showingMessages;
          entity.label.show = showingMessages;
        }
      });
    });
  }

  document.querySelectorAll('#iconSelector img').forEach(img => {
    img.addEventListener('click', () => {
      selectedIcon = img.dataset.icon;
    });
  });

  fetch('/3d/api/messages')
    .then(response => response.json())
    .then(messages => {
      messages.forEach(msg => {
        const position = Cesium.Cartesian3.fromDegrees(msg.position.longitude, msg.position.latitude, 50);
        const iconUrl = getIconUrl(msg.icon);

        const newEntity = cesiumViewer.entities.add({
          position: position,
          billboard: {
            image: iconUrl,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            width: 32,
            height: 32,
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            show: false
          },
          label: {
            text: msg.message,
            font: '14px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -60),
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
            backgroundPadding: new Cesium.Cartesian2(7, 5),
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            wrap: true,
            maximumWidth: 200,
            show: false
          },
          description: `<p style="max-width: 200px; max-height: 400px; overflow: auto; white-space: pre-wrap;">${msg.message}</p>`
        });

        addRightClickListener(newEntity, msg.position.longitude, msg.position.latitude); // Listener para clic derecho
      });
    })
    .catch(error => {
      console.error('Error fetching messages:', error);
      alert('Error fetching messages.');
    });

  function saveMessage(longitude, latitude, message, icon) {
    fetch('/3d/api/save-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        position: { longitude, latitude },
        message,
        icon
      })
    }).then(response => {
      if (response.ok) {
        const thankYouMessage = document.getElementById('thankYouMessage');
        thankYouMessage.style.display = 'block';

        setTimeout(() => {
          thankYouMessage.style.display = 'none';
        }, 3000);
      } else {
        alert('Failed to save message.');
      }
    }).catch(error => {
      console.error('Error saving message:', error);
      alert('Error saving message.');
    });
  }

  function addRightClickListener(entity, longitude, latitude) {
    const handler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.scene.canvas);
    handler.setInputAction((click) => {
      const pickedObject = cesiumViewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id === entity) {
        const confirmed = confirm("¿Quieres eliminar este comentario?");
        if (confirmed) {
          cesiumViewer.entities.remove(entity);
          deleteMessage(longitude, latitude);
        }
      }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  function deleteMessage(longitude, latitude) {
    fetch('/3d/api/delete-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ longitude, latitude })
    })
      .then(response => {
        if (!response.ok) {
          console.error('Error deleting message from server');
        }
      })
      .catch(error => console.error('Error deleting message:', error));
  }
});
