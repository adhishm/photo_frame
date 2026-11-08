const presets = {
  square: { width: 1080, height: 1080, padLeft: 40, padRight: 40, padTop: 40, padBottom: 40 },
  portrait: { width: 1080, height: 1350, padLeft: 40, padRight: 40, padTop: 40, padBottom: 40 },
  landscape: { width: 1080, height: 566, padLeft: 40, padRight: 40, padTop: 40, padBottom: 40 },
};

const imageInput = document.getElementById('imageInput');
const presetSelect = document.getElementById('presetSelect');
const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const padLeftInput = document.getElementById('padLeftInput');
const padRightInput = document.getElementById('padRightInput');
const padTopInput = document.getElementById('padTopInput');
const padBottomInput = document.getElementById('padBottomInput');
const explicitVertical = document.getElementById('explicitVertical');
const verticalFields = document.getElementById('verticalFields');
const linkHorizontalPadding = document.getElementById('linkHorizontalPadding');
const linkVerticalPadding = document.getElementById('linkVerticalPadding');
const bgColor = document.getElementById('bgColor');
const qualityInput = document.getElementById('qualityInput');
const qualityValue = document.getElementById('qualityValue');
const renderButton = document.getElementById('renderButton');
const downloadButton = document.getElementById('downloadButton');
const previewCanvas = document.getElementById('previewCanvas');
const infoText = document.getElementById('infoText');
const suffixInput = document.getElementById('suffixInput');

const rowsInput = document.getElementById('rowsInput');
const columnsInput = document.getElementById('columnsInput');
const tilingWidthInput = document.getElementById('tilingWidthInput');
const tilingHeightInput = document.getElementById('tilingHeightInput');
const tilingPadLeftInput = document.getElementById('tilingPadLeftInput');
const tilingPadRightInput = document.getElementById('tilingPadRightInput');
const tilingPadTopInput = document.getElementById('tilingPadTopInput');
const tilingPadBottomInput = document.getElementById('tilingPadBottomInput');
const tilingGapInput = document.getElementById('tilingGapInput');
const tilingGrid = document.getElementById('tilingGrid');
const instagramCompatibleInput = document.getElementById('instagramCompatibleInput');
const modeButtons = document.querySelectorAll('.mode-tab');
const singleModePanel = document.getElementById('singleModePanel');
const tilingModePanel = document.getElementById('tilingModePanel');

const ctx = previewCanvas.getContext('2d');
let loadedImage = null;
let lastBlobUrl = null;
let originalFileName = null;
let activeMode = 'single';
let tilingTiles = [];
let gridVersion = 0;
let singlePreviewValid = false;
let tilingPreviewValid = false;

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseIntOrFallback(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function getPositiveInteger(input, label, max = 10000) {
  const value = Number(input.value);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${label} must be a whole number between 1 and ${max}.`);
  }
  return value;
}

function getNonNegativeInteger(input, label) {
  const value = Number(input.value);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }
  return value;
}

function setMode(mode) {
  activeMode = mode;
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  singleModePanel.classList.toggle('hide', mode !== 'single');
  singleModePanel.hidden = mode !== 'single';
  tilingModePanel.classList.toggle('hide', mode !== 'tiling');
  tilingModePanel.hidden = mode !== 'tiling';

  renderPreview();
  updateActionAvailability();
}

function updateQualityValue() {
  qualityValue.textContent = qualityInput.value;
}

function setFieldState() {
  const custom = presetSelect.value === 'custom';
  [widthInput, heightInput].forEach((input) => {
    if (custom) input.removeAttribute('readonly');
    else input.setAttribute('readonly', 'readonly');
  });
}

function setVerticalFields() {
  verticalFields.classList.toggle('hide', !explicitVertical.checked);
}

function applyPreset(presetName) {
  const preset = presets[presetName];
  if (!preset) return;
  widthInput.value = preset.width;
  heightInput.value = preset.height;
  padLeftInput.value = preset.padLeft;
  padRightInput.value = preset.padRight;
  padTopInput.value = preset.padTop;
  padBottomInput.value = preset.padBottom;
}

function updateActionAvailability() {
  if (activeMode === 'single') {
    renderButton.disabled = !loadedImage;
    downloadButton.disabled = !loadedImage || !singlePreviewValid;
    return;
  }

  const total = tilingTiles.length;
  const allReady = total > 0 && tilingTiles.every((tile) => tile && tile.image && !tile.loading);
  renderButton.disabled = !allReady;
  downloadButton.disabled = !allReady || !tilingPreviewValid;
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read this file.'));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to load this image. Please choose another file.'));
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function fillCanvas(width, height) {
  previewCanvas.width = width;
  previewCanvas.height = height;
  ctx.fillStyle = bgColor.value;
  ctx.fillRect(0, 0, width, height);
}

function renderSinglePreview() {
  singlePreviewValid = false;
  let finalW;
  let finalH;
  let padLeft;
  let padRight;
  let padTop;
  let padBottom;

  try {
    finalW = getPositiveInteger(widthInput, 'Width');
    finalH = getPositiveInteger(heightInput, 'Height');
    padLeft = getNonNegativeInteger(padLeftInput, 'Left padding');
    padRight = getNonNegativeInteger(padRightInput, 'Right padding');
    padTop = explicitVertical.checked ? getNonNegativeInteger(padTopInput, 'Top padding') : 0;
    padBottom = explicitVertical.checked ? getNonNegativeInteger(padBottomInput, 'Bottom padding') : 0;
  } catch (error) {
    infoText.textContent = error.message;
    updateActionAvailability();
    return;
  }

  fillCanvas(finalW, finalH);
  if (!loadedImage) {
    infoText.textContent = 'Upload an image to start.';
    updateActionAvailability();
    return;
  }

  if (padLeft + padRight >= finalW) {
    infoText.textContent = 'Left + right padding must be smaller than the total width.';
    updateActionAvailability();
    return;
  }
  if (explicitVertical.checked && padTop + padBottom >= finalH) {
    infoText.textContent = 'Top + bottom padding must be smaller than the total height.';
    updateActionAvailability();
    return;
  }

  const availableW = finalW - padLeft - padRight;
  const availableH = explicitVertical.checked ? finalH - padTop - padBottom : finalH;
  const scale = Math.min(availableW / loadedImage.width, availableH / loadedImage.height);
  const newW = Math.max(1, Math.round(loadedImage.width * scale));
  const newH = Math.max(1, Math.round(loadedImage.height * scale));
  const xOffset = padLeft + Math.floor((availableW - newW) / 2);
  const yOffset = explicitVertical.checked
    ? padTop + Math.floor((availableH - newH) / 2)
    : Math.floor((finalH - newH) / 2);

  ctx.drawImage(loadedImage, xOffset, yOffset, newW, newH);
  singlePreviewValid = true;
  infoText.textContent = `Preview ${finalW}×${finalH}, image ${newW}×${newH}, padding L/R ${padLeft}/${padRight}` +
    (explicitVertical.checked ? `, padding T/B ${padTop}/${padBottom}` : ', vertically centered');
  updateActionAvailability();
}

function renderTilingPreview() {
  tilingPreviewValid = false;

  let rows;
  let columns;
  let finalW;
  let finalH;
  let padLeft;
  let padRight;
  let padTop;
  let padBottom;
  let gap;

  try {
    rows = getPositiveInteger(rowsInput, 'Rows', 6);
    columns = getPositiveInteger(columnsInput, 'Columns', 6);
    finalW = instagramCompatibleInput.checked ? 1080 : getPositiveInteger(tilingWidthInput, 'Output width');
    finalH = instagramCompatibleInput.checked ? 1350 : getPositiveInteger(tilingHeightInput, 'Output height');
    padLeft = getNonNegativeInteger(tilingPadLeftInput, 'Left margin');
    padRight = getNonNegativeInteger(tilingPadRightInput, 'Right margin');
    padTop = getNonNegativeInteger(tilingPadTopInput, 'Top margin');
    padBottom = getNonNegativeInteger(tilingPadBottomInput, 'Bottom margin');
    gap = getNonNegativeInteger(tilingGapInput, 'Cell spacing');
  } catch (error) {
    infoText.textContent = error.message;
    updateActionAvailability();
    return;
  }

  if (finalW * finalH > 40000000) {
    infoText.textContent = 'The output is too large to render reliably. Choose dimensions with at most 40 megapixels.';
    updateActionAvailability();
    return;
  }
  if (padLeft + padRight >= finalW || gap * (columns - 1) >= finalW - padLeft - padRight) {
    infoText.textContent = 'Horizontal margins and cell spacing leave no room for the grid.';
    updateActionAvailability();
    return;
  }
  if (padTop + padBottom >= finalH || gap * (rows - 1) >= finalH - padTop - padBottom) {
    infoText.textContent = 'Vertical margins and cell spacing leave no room for the grid.';
    updateActionAvailability();
    return;
  }

  fillCanvas(finalW, finalH);
  const cellWidth = (finalW - padLeft - padRight - gap * (columns - 1)) / columns;
  const cellHeight = (finalH - padTop - padBottom - gap * (rows - 1)) / rows;
  let missing = 0;

  tilingTiles.forEach((tile, index) => {
    if (!tile || !tile.image) {
      missing += 1;
      return;
    }

    const row = Math.floor(index / columns);
    const column = index % columns;
    const cellX = padLeft + column * (cellWidth + gap);
    const cellY = padTop + row * (cellHeight + gap);
    const scale = Math.min(cellWidth / tile.image.width, cellHeight / tile.image.height);
    const drawWidth = Math.max(1, Math.round(tile.image.width * scale));
    const drawHeight = Math.max(1, Math.round(tile.image.height * scale));
    const drawX = cellX + (cellWidth - drawWidth) / 2;
    const drawY = cellY + (cellHeight - drawHeight) / 2;
    ctx.drawImage(tile.image, drawX, drawY, drawWidth, drawHeight);
  });

  if (missing > 0) {
    infoText.textContent = `Grid preview ${finalW}×${finalH}: add an image to each of the ${missing} remaining cell${missing === 1 ? '' : 's'}.`;
    updateActionAvailability();
    return;
  }

  tilingPreviewValid = true;
  infoText.textContent = `Preview ${finalW}×${finalH}, ${rows}×${columns} grid, margins L/R ${padLeft}/${padRight}, T/B ${padTop}/${padBottom}, cell spacing ${gap}px.`;
  updateActionAvailability();
}

function renderPreview() {
  if (activeMode === 'tiling') renderTilingPreview();
  else renderSinglePreview();
}

function handleFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    loadedImage = null;
    originalFileName = null;
    renderPreview();
    return;
  }

  originalFileName = file.name || 'photo';
  infoText.textContent = 'Loading image…';
  readImageFile(file)
    .then((image) => {
      loadedImage = image;
      renderPreview();
    })
    .catch((error) => {
      loadedImage = null;
      infoText.textContent = error.message;
      updateActionAvailability();
    });
}

function loadTileFile(file, index, version) {
  if (!file || !file.type.startsWith('image/')) {
    infoText.textContent = 'Please choose a valid image file for each cell.';
    return;
  }

  tilingTiles[index] = { image: null, fileName: file.name, loading: true };
  updateActionAvailability();
  renderPreview();

  readImageFile(file)
    .then((image) => {
      if (version !== gridVersion || !tilingTiles[index]) return;
      tilingTiles[index] = { image, fileName: file.name, loading: false };
      updateTileLabel(index, file.name);
      renderPreview();
    })
    .catch((error) => {
      if (version !== gridVersion || !tilingTiles[index]) return;
      tilingTiles[index] = null;
      updateTileLabel(index, 'Drop an image here or browse');
      infoText.textContent = error.message;
      renderPreview();
    });
}

function updateTileLabel(index, text) {
  const status = tilingGrid.querySelector(`[data-tile-status="${index}"]`);
  if (status) status.textContent = text;
}

function syncTilingGrid() {
  let rows;
  let columns;
  try {
    rows = getPositiveInteger(rowsInput, 'Rows', 6);
    columns = getPositiveInteger(columnsInput, 'Columns', 6);
  } catch (error) {
    tilingGrid.replaceChildren();
    tilingTiles = [];
    gridVersion += 1;
    infoText.textContent = error.message;
    updateActionAvailability();
    return;
  }

  const count = rows * columns;
  tilingTiles = Array.from({ length: count }, (_, index) => tilingTiles[index] || null);
  gridVersion += 1;
  const version = gridVersion;
  tilingGrid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  tilingGrid.replaceChildren();

  for (let index = 0; index < count; index += 1) {
    const cell = document.createElement('div');
    cell.className = 'tiling-cell';
    cell.dataset.tileIndex = String(index);

    const title = document.createElement('span');
    title.className = 'tiling-cell-title';
    title.textContent = `Cell ${index + 1}`;

    const status = document.createElement('span');
    status.className = 'tiling-cell-status';
    status.dataset.tileStatus = String(index);
    status.textContent = tilingTiles[index]?.fileName || 'Drop an image here or browse';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('aria-label', `Choose image for cell ${index + 1}`);
    input.addEventListener('change', (event) => loadTileFile(event.target.files[0], index, version));

    cell.addEventListener('dragover', (event) => {
      event.preventDefault();
      cell.classList.add('drag-over');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
    cell.addEventListener('drop', (event) => {
      event.preventDefault();
      cell.classList.remove('drag-over');
      loadTileFile(event.dataTransfer.files[0], index, version);
    });

    cell.append(title, status, input);
    tilingGrid.appendChild(cell);
  }

  updateActionAvailability();
  renderPreview();
}

function createDownload(blob, filename) {
  if (!blob) {
    infoText.textContent = 'Could not create the JPEG download.';
    return;
  }

  if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
  lastBlobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = lastBlobUrl;
  anchor.download = filename;
  anchor.click();
  infoText.textContent = 'Download started. Browser-exported images do not retain EXIF/ICC metadata.';
}

function getFilenameParts(filename) {
  const match = (filename || 'photo').match(/^(.*)(\.[^.]*)$/);
  return match ? { base: match[1], extension: match[2] } : { base: filename || 'photo', extension: '.jpg' };
}

function downloadImage() {
  renderPreview();
  if (activeMode === 'single' && (!loadedImage || !singlePreviewValid)) return;
  if (activeMode === 'tiling' && (!tilingPreviewValid || tilingTiles.some((tile) => !tile?.image))) return;

  const quality = clampNumber(parseIntOrFallback(qualityInput.value, 95), 50, 100) / 100;
  previewCanvas.toBlob((blob) => {
    if (activeMode === 'single') {
      const parts = getFilenameParts(originalFileName);
      createDownload(blob, `${parts.base}${suffixInput.value || '-border'}.jpg`);
    } else {
      const rows = parseIntOrFallback(rowsInput.value, 1);
      const columns = parseIntOrFallback(columnsInput.value, 1);
      createDownload(blob, `tiling-${rows}x${columns}.jpg`);
    }
  }, 'image/jpeg', quality);
}

function updatePresetState() {
  if (presetSelect.value !== 'custom') applyPreset(presetSelect.value);
  setFieldState();
  renderPreview();
}

function handlePadLeftChange() {
  if (linkHorizontalPadding.checked) padRightInput.value = padLeftInput.value;
  renderPreview();
}

function handlePadRightChange() {
  if (linkHorizontalPadding.checked) padLeftInput.value = padRightInput.value;
  renderPreview();
}

function handlePadTopChange() {
  if (linkVerticalPadding.checked) padBottomInput.value = padTopInput.value;
  renderPreview();
}

function handlePadBottomChange() {
  if (linkVerticalPadding.checked) padTopInput.value = padBottomInput.value;
  renderPreview();
}

imageInput.addEventListener('change', handleFileChange);
presetSelect.addEventListener('change', updatePresetState);
explicitVertical.addEventListener('change', () => {
  setVerticalFields();
  renderPreview();
});
qualityInput.addEventListener('input', updateQualityValue);
padLeftInput.addEventListener('input', handlePadLeftChange);
padRightInput.addEventListener('input', handlePadRightChange);
padTopInput.addEventListener('input', handlePadTopChange);
padBottomInput.addEventListener('input', handlePadBottomChange);
linkHorizontalPadding.addEventListener('change', () => {
  if (linkHorizontalPadding.checked) padRightInput.value = padLeftInput.value;
  renderPreview();
});
linkVerticalPadding.addEventListener('change', () => {
  if (linkVerticalPadding.checked) padBottomInput.value = padTopInput.value;
  renderPreview();
});

[widthInput, heightInput, padLeftInput, padRightInput, padTopInput, padBottomInput, bgColor].forEach((element) => {
  element.addEventListener('input', renderPreview);
});
[rowsInput, columnsInput].forEach((element) => element.addEventListener('input', syncTilingGrid));
[tilingWidthInput, tilingHeightInput, tilingPadLeftInput, tilingPadRightInput, tilingPadTopInput, tilingPadBottomInput, tilingGapInput, bgColor].forEach((element) => {
  element.addEventListener('input', renderPreview);
});
instagramCompatibleInput.addEventListener('change', () => {
  const locked = instagramCompatibleInput.checked;
  tilingWidthInput.disabled = locked;
  tilingHeightInput.disabled = locked;
  renderPreview();
});
modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
renderButton.addEventListener('click', renderPreview);
downloadButton.addEventListener('click', downloadImage);

applyPreset('portrait');
setFieldState();
setVerticalFields();
updateQualityValue();
syncTilingGrid();
setMode('single');
