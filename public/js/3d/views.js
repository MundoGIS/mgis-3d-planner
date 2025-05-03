
//views
document.addEventListener('DOMContentLoaded', () => {
  const saveViewButtonContainer = document.getElementById('saveViewButtonContainer'); // New save button
  const savedViewsDropdownContainer = document.getElementById('savedViewsDropdownContainer'); // New dropdown container
  const savedViewsDropdown = document.getElementById('savedViewsDropdown'); // New dropdown content
  const dropdownTrigger = savedViewsDropdownContainer ? savedViewsDropdownContainer.querySelector('.dropdown-trigger') : null;

  if (saveViewButtonContainer) {
    saveViewButtonContainer.addEventListener('click', openSaveViewModal); // Open modal on click
  }

  if (dropdownTrigger && savedViewsDropdownContainer) {
    dropdownTrigger.addEventListener('click', () => {
      savedViewsDropdown.style.display = savedViewsDropdown.style.display === 'block' ? 'none' : 'block';
    });

    // Close dropdown when clicking outside
    window.addEventListener('click', (event) => {
      if (savedViewsDropdownContainer && !savedViewsDropdownContainer.contains(event.target) && savedViewsDropdown.style.display === 'block') {
        savedViewsDropdown.style.display = 'none';
      }
    });
  }

  // Load saved views on page load
  loadSavedViews();
});

function openSaveViewModal() {
  // Create a modal dynamically using Bulma classes
  const modal = document.createElement('div');
  modal.classList.add('modal', 'is-active');
  modal.innerHTML = `
    <div class="modal-background"></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">Save View</p>
        <button class="delete" aria-label="close" onclick="document.body.removeChild(this.closest('.modal'))"></button>
      </header>
      <section class="modal-card-body">
        <div class="field">
          <label class="label">View Name</label>
          <div class="control">
            <input class="input" type="text" id="viewNameInput" placeholder="Enter view name">
          </div>
        </div>
      </section>
      <footer class="modal-card-foot">
        <button class="button is-success" id="saveViewConfirmButton">Save</button>
        <button class="button" onclick="document.body.removeChild(this.closest('.modal'))">Cancel</button>
      </footer>
    </div>
  `;
  document.body.appendChild(modal);

  const saveViewConfirmButton = modal.querySelector('#saveViewConfirmButton');
  if (saveViewConfirmButton) {
    saveViewConfirmButton.addEventListener('click', () => {
      const viewNameInput = modal.querySelector('#viewNameInput');
      const viewName = viewNameInput.value.trim();
      if (viewName) {
        saveCurrentView(viewName); // Call save function with the name
        document.body.removeChild(modal); // Close the modal
      } else {
        alert('Please enter a view name.');
      }
    });
  }
}

function saveCurrentView(name) {
  console.log('saveCurrentView called with:', name);
  if (!cesiumViewer) return;

  const camera = cesiumViewer.camera;
  const position = [camera.positionWC.x, camera.positionWC.y, camera.positionWC.z];
  const orientation = {
    heading: camera.heading,
    pitch: camera.pitch,
    roll: camera.roll
  };

  console.log('Position:', position);
  console.log('Orientation:', orientation);

  fetch('/3d/api/save-view', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, position, orientation }) // Send the name
  })
    .then(response => response.json())
    .then(data => {
      console.log('View saved:', data.message);
      loadSavedViews(); // Llamar a loadSavedViews para recargar la lista
    })
    .catch(error => {
      console.error('Error saving view:', error);
    });
}

function loadSavedViews() {
  fetch('/3d/api/load-views')
    .then(response => response.json())
    .then(views => {
      displaySavedViews(views); // Display the list of views

      // Find and apply the default view only on initial load or explicit default setting
      if (!window.hasLoadedDefaultView) {
        const defaultView = views.find(view => view.isDefault);
        if (defaultView && cesiumViewer) {
          cesiumViewer.camera.setView({
            destination: Cesium.Cartesian3.fromArray(defaultView.position),
            orientation: defaultView.orientation
          });
          console.log('Default view loaded:', defaultView.name);
          window.hasLoadedDefaultView = true; // Flag to indicate default view has been loaded
        } else {
          console.log('No default view set or Cesium viewer not initialized yet.');
          // Aquí podrías agregar la lógica para establecer la vista inicial por defecto de tu mapa si no hay ninguna predeterminada guardada.
        }
      }
    })
    .catch(error => {
      console.error('Error loading saved views:', error);
    });
}

// Add a flag to track if the default view has been loaded
window.hasLoadedDefaultView = false;

function displaySavedViews(views) {
  const savedViewsDropdown = document.getElementById('savedViewsDropdown');
  if (!savedViewsDropdown) return;
  savedViewsDropdown.innerHTML = ''; // Clear previous list

  if (views && views.length > 0) {
      views.forEach((view) => {
          const viewItem = document.createElement('div');
          viewItem.classList.add('saved-view-item'); // Añadir clase aquí

          const viewLink = document.createElement('a');
          viewLink.href = '#';
          viewLink.textContent = view.name;
          viewLink.classList.add('saved-view-link'); // Añadir clase aquí
          viewLink.addEventListener('click', () => {
              cesiumViewer.camera.flyTo({
                  destination: Cesium.Cartesian3.fromArray(view.position),
                  orientation: view.orientation,
                  duration: 3.0 // Duración de la animación en segundos (ajusta este valor)
              });
              savedViewsDropdown.style.display = 'none';
          });
          viewItem.appendChild(viewLink);

          const defaultIcon = document.createElement('i');
          defaultIcon.classList.add('bx', view.isDefault ? 'bx-star-fill' : 'bx-star', 'default-icon');
          defaultIcon.addEventListener('click', () => {
              setDefaultView(view.name);
          });
          // Añadir tooltip para el icono de establecer como predeterminado
          defaultIcon.title = 'Make Default';
          viewItem.appendChild(defaultIcon);

          const deleteIcon = document.createElement('i');
          deleteIcon.classList.add('bx', 'bx-trash', 'delete-icon');
          deleteIcon.addEventListener('click', () => {
              if (confirm('Are you sure you want to delete this view?')) {
                  deleteSavedView(view.name);
              }
          });
          // Añadir tooltip para el icono de eliminar vista
          deleteIcon.title = 'Delete View';
          viewItem.appendChild(deleteIcon);

          savedViewsDropdown.appendChild(viewItem);
      });
  } else {
      const noViewsItem = document.createElement('span');
      noViewsItem.textContent = 'No saved views yet.';
      noViewsItem.style.padding = '8px';
      savedViewsDropdown.appendChild(noViewsItem);
  }
}


function deleteSavedView(viewName) {
  fetch('/3d/api/delete-view', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: viewName }) // Send the name of the view to delete
  })
    .then(response => response.json())
    .then(data => {
      console.log('View deleted:', data.message);
      loadSavedViews(); // Reload the list of saved views after deletion
    })
    .catch(error => {
      console.error('Error deleting view:', error);
    });
}

function setDefaultView(viewName) {
  fetch('/3d/api/set-default-view', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: viewName })
  })
    .then(response => response.json())
    .then(data => {
      console.log('Default view set:', data.message);
      loadSavedViews(); // Reload to update the visual indication and potentially the initial view
    })
    .catch(error => {
      console.error('Error setting default view:', error);
    });
}