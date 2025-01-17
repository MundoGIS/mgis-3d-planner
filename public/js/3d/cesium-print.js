function startExport() {
  const title = document.getElementById('exportTitle').value;
  const titleFontType = document.getElementById('titleFontType').value;
  const titleFontSize = document.getElementById('titleFontSize').value;
  const description = document.getElementById('exportDescription').value;
  const descriptionFontType = document.getElementById('descriptionFontType').value;
  const descriptionFontSize = document.getElementById('descriptionFontSize').value;
  const paperSize = document.getElementById('exportPaperSize').value;
  const orientation = document.getElementById('exportOrientation').value;
  const boldTitle = document.getElementById('boldTitle').checked;
  const logoPosition = document.getElementById('logoPosition').value;
  const showDate = document.getElementById('showDate').checked;
  const showScale = document.getElementById('showScale').checked;
  const descriptionPosition = document.getElementById('descriptionPosition').value;
  const customMargin = parseInt(document.getElementById('customMargin').value, 10);
  const showBorder = document.getElementById('showBorder').checked;

  closeExportModal();

  setTimeout(() => {
    exportMapToImage(
      title, titleFontType, titleFontSize,
      description, descriptionFontType, descriptionFontSize,
      paperSize, orientation, boldTitle, logoPosition,
      showDate, showScale, descriptionPosition, customMargin, showBorder
    );
  }, 2000);
}

function exportMapToImage(
  title, titleFontType, titleFontSize,
  description, descriptionFontType, descriptionFontSize,
  paperSize, orientation, boldTitle, logoPosition,
  showDate, showScale, descriptionPosition, customMargin, showBorder
) {
  const scene = cesiumViewer.scene;
  scene.render();

  const cesiumCanvas = scene.canvas;
  const imgData = cesiumCanvas.toDataURL('image/png');

  loadLogoImage('/public/images/Rabb_logo.png').then(logoData => {
    exportImageToPDF(
      cesiumCanvas, imgData, logoData,
      title, titleFontType, titleFontSize,
      description, descriptionFontType, descriptionFontSize,
      paperSize, orientation, boldTitle, logoPosition,
      showDate, showScale, descriptionPosition, customMargin, showBorder
    );
  }).catch(() => {
    exportImageToPDF(
      cesiumCanvas, imgData, null,
      title, titleFontType, titleFontSize,
      description, descriptionFontType, descriptionFontSize,
      paperSize, orientation, boldTitle, logoPosition,
      showDate, showScale, descriptionPosition, customMargin, showBorder
    );
  });
}

function loadLogoImage(logoUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = logoUrl;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      reject(new Error('Failed to load logo image'));
    };
  });
}

function exportImageToPDF(
  cesiumCanvas, mapImageData, logoData,
  title, titleFontType, titleFontSize,
  description, descriptionFontType, descriptionFontSize,
  paperSize, orientation, boldTitle, logoPosition,
  showDate, showScale, descriptionPosition, customMargin, showBorder
) {
  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: paperSize
  });

  const margin = customMargin;
  const contentWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  const contentHeight = pdf.internal.pageSize.getHeight() - margin * 2;

  if (showBorder) {
    pdf.setLineWidth(0.5);
    pdf.rect(margin, margin, contentWidth, contentHeight);
  }

  if (showDate) {
    const currentDate = new Date().toLocaleDateString();
    pdf.setFontSize(10);
    pdf.text(currentDate, pdf.internal.pageSize.getWidth() - margin - 30, margin + 5);
  }

  if (logoData) {
    const logoWidth = 20;
    const logoHeight = 10;
    let logoX = pdf.internal.pageSize.getWidth() - margin - logoWidth;
    let logoY = margin + 5;

    if (logoPosition === 'top-left') {
      logoX = margin + 5;
    } else if (logoPosition === 'top-center') {
      logoX = (pdf.internal.pageSize.getWidth() - logoWidth) / 2;
    } else if (logoPosition === 'bottom-center') {
      logoX = (pdf.internal.pageSize.getWidth() - logoWidth) / 2;
      logoY = pdf.internal.pageSize.getHeight() - margin - logoHeight;
    }

    pdf.addImage(logoData, 'PNG', logoX, logoY, logoWidth, logoHeight);
  }

  pdf.setFont(titleFontType, boldTitle ? "bold" : "normal");
  pdf.setFontSize(parseInt(titleFontSize));

  let titleY = margin + 12;
  if (logoPosition === 'top-left' || logoPosition === 'top-center' || logoPosition === 'top-right') {
    titleY = margin + 25;
  }

  pdf.text(title, margin + 5, titleY);

  let mapY = titleY + 10;
  let availableMapHeight = contentHeight - mapY - (showScale ? 25 : 0); 

  if (descriptionPosition === 'above') {
    pdf.setFont(descriptionFontType, "normal");
    pdf.setFontSize(parseInt(descriptionFontSize));
    pdf.text(description, margin + 5, mapY, { maxWidth: contentWidth });
    mapY += 10;
    availableMapHeight -= 10;
  }

  const aspectRatioMap = cesiumCanvas.width / cesiumCanvas.height;
  const aspectRatioPage = contentWidth / availableMapHeight;

  let mapWidth = contentWidth;
  let mapHeight = availableMapHeight;

  if (aspectRatioMap > aspectRatioPage) {
    mapHeight = mapWidth / aspectRatioMap;
  } else {
    mapWidth = mapHeight * aspectRatioMap;
  }

  const mapX = (pdf.internal.pageSize.getWidth() - mapWidth) / 2;
  pdf.addImage(mapImageData, 'PNG', mapX, mapY, mapWidth, mapHeight);

  let descriptionY = mapY + mapHeight + 10;
  if (descriptionPosition === 'below') {
    pdf.setFont(descriptionFontType, "normal");
    pdf.setFontSize(parseInt(descriptionFontSize));
    pdf.text(description, margin + 5, descriptionY, { maxWidth: contentWidth });
  }

  if (showScale) {
    const scaleX = (pdf.internal.pageSize.getWidth() - 100) / 2;
    const scaleY = mapY + mapHeight + 15; // Ajuste para más espacio desde el mapa
    pdf.setLineWidth(0.5);
    pdf.line(scaleX, scaleY, scaleX + 100, scaleY);

    const scaleValue = calculateScale();
    pdf.text(`Scale: 1:${scaleValue}`, scaleX + 30, scaleY + 5);
  }

  pdf.save('map.pdf');
}

function calculateScale() {
  // Implementa la lógica para calcular la escala basada en la extensión del mapa y el zoom.
  const cameraHeight = cesiumViewer.camera.positionCartographic.height;
  const dpi = 96;
  const inchesPerMeter = 39.3701;
  const metersPerPixel = (cameraHeight * Math.PI) / (dpi * cesiumViewer.scene.canvas.clientHeight);
  const scaleDenominator = metersPerPixel * inchesPerMeter * 1000;
  return Math.round(scaleDenominator);
}

document.getElementById('printBtn').addEventListener('click', function (event) {
  event.stopPropagation();
  openExportModal(event);
});

function openExportModal(event) {
  event.stopPropagation();
  const modal = document.getElementById('exportModal');
  modal.classList.add('is-active');
  document.querySelector('.modal-background').style.backgroundColor = 'rgba(10, 10, 10, 0.86)'; // Asegura que el fondo no sea completamente opaco
}


function closeExportModal() {
  const modal = document.getElementById('exportModal');
  modal.classList.remove('is-active');
}

