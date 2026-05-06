const presets = {
  square: {
    width: 1080,
    height: 1080,
    padLeft: 40,
    padRight: 40,
    padTop: 40,
    padBottom: 40,
  },
  portrait: {
    width: 1080,
    height: 1350,
    padLeft: 40,
    padRight: 40,
    padTop: 40,
    padBottom: 40,
  },
  landscape: {
    width: 1080,
    height: 566,
    padLeft: 40,
    padRight: 40,
    padTop: 40,
    padBottom: 40,
  },
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

const ctx = previewCanvas.getContext('2d');
let loadedImage = null;
let lastBlobUrl = null;

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

function updateQualityValue() {
  qualityValue.textContent = qualityInput.value;
}

function setFieldState() {
  if (presetSelect.value === 'custom') {
    widthInput.removeAttribute('readonly');
    heightInput.removeAttribute('readonly');
    padLeftInput.removeAttribute('readonly');
    padRightInput.removeAttribute('readonly');
    padTopInput.removeAttribute('readonly');
    padBottomInput.removeAttribute('readonly');
  } else {
    widthInput.setAttribute('readonly', 'readonly');
    heightInput.setAttribute('readonly', 'readonly');
    padLeftInput.removeAttribute('readonly');
    padRightInput.removeAttribute('readonly');
    padTopInput.removeAttribute('readonly');
    padBottomInput.removeAttribute('readonly');
  }
}

function setVerticalFields() {
  verticalFields.classList.toggle('hide', !explicitVertical.checked);
}

function enableActions(enabled) {
  renderButton.disabled = !enabled;
  downloadButton.disabled = !enabled;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseIntOrFallback(value, fallback = 0) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function renderPreview() {
  if (!loadedImage) return;

  const finalW = clampNumber(parseIntOrFallback(widthInput.value), 1, 10000);
  const finalH = clampNumber(parseIntOrFallback(heightInput.value), 1, 10000);
  const padLeft = Math.max(0, parseIntOrFallback(padLeftInput.value));
  const padRight = Math.max(0, parseIntOrFallback(padRightInput.value));
  const padTop = explicitVertical.checked ? Math.max(0, parseIntOrFallback(padTopInput.value)) : 0;
  const padBottom = explicitVertical.checked ? Math.max(0, parseIntOrFallback(padBottomInput.value)) : 0;

  if (padLeft + padRight >= finalW) {
    infoText.textContent = 'Left + right padding must be smaller than the total width.';
    return;
  }

  if (explicitVertical.checked && padTop + padBottom >= finalH) {
    infoText.textContent = 'Top + bottom padding must be smaller than the total height.';
    return;
  }

  const availableW = finalW - padLeft - padRight;
  const availableH = explicitVertical.checked ? finalH - padTop - padBottom : finalH;
  const scale = Math.min(availableW / loadedImage.width, availableH / loadedImage.height);
  const newW = Math.max(1, Math.round(loadedImage.width * scale));
  const newH = Math.max(1, Math.round(loadedImage.height * scale));

  previewCanvas.width = finalW;
  previewCanvas.height = finalH;

  ctx.fillStyle = bgColor.value;
  ctx.fillRect(0, 0, finalW, finalH);

  const xOffset = padLeft + Math.floor((availableW - newW) / 2);
  const yOffset = explicitVertical.checked
    ? padTop + Math.floor((availableH - newH) / 2)
    : Math.floor((finalH - newH) / 2);

  ctx.drawImage(loadedImage, xOffset, yOffset, newW, newH);
  infoText.textContent = `Preview ${finalW}×${finalH}, image ${newW}×${newH}, padding L/R ${padLeft}/${padRight}` +
    (explicitVertical.checked ? `, padding T/B ${padTop}/${padBottom}` : ', vertically centered');
}

function handleFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    loadedImage = null;
    enableActions(false);
    infoText.textContent = 'Upload an image to start.';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      loadedImage = image;
      enableActions(true);
      renderPreview();
    };
    image.onerror = () => {
      loadedImage = null;
      enableActions(false);
      infoText.textContent = 'Unable to load that image. Please choose another file.';
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function downloadImage() {
  if (!loadedImage) return;

  const quality = clampNumber(parseIntOrFallback(qualityInput.value), 0, 100) / 100;
  previewCanvas.toBlob((blob) => {
    if (!blob) {
      infoText.textContent = 'Could not create download blob.';
      return;
    }

    if (lastBlobUrl) {
      URL.revokeObjectURL(lastBlobUrl);
    }
    lastBlobUrl = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = lastBlobUrl;
    anchor.download = 'photo_frame.jpg';
    anchor.click();
    infoText.textContent = 'Download started.';
  }, 'image/jpeg', quality);
}

function updatePresetState() {
  if (presetSelect.value !== 'custom') {
    applyPreset(presetSelect.value);
    setFieldState();
    renderPreview();
  } else {
    setFieldState();
  }
}

function handlePadLeftChange() {
  if (linkHorizontalPadding.checked) {
    padRightInput.value = padLeftInput.value;
  }
  renderPreview();
}

function handlePadRightChange() {
  if (linkHorizontalPadding.checked) {
    padLeftInput.value = padRightInput.value;
  }
  renderPreview();
}

function handlePadTopChange() {
  if (linkVerticalPadding.checked) {
    padBottomInput.value = padTopInput.value;
  }
  renderPreview();
}

function handlePadBottomChange() {
  if (linkVerticalPadding.checked) {
    padTopInput.value = padBottomInput.value;
  }
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
  if (linkHorizontalPadding.checked) {
    padRightInput.value = padLeftInput.value;
  }
  renderPreview();
});
linkVerticalPadding.addEventListener('change', () => {
  if (linkVerticalPadding.checked) {
    padBottomInput.value = padTopInput.value;
  }
  renderPreview();
});
[widthInput, heightInput, bgColor].forEach((element) => {
  element.addEventListener('input', () => {
    renderPreview();
  });
});
renderButton.addEventListener('click', renderPreview);
downloadButton.addEventListener('click', downloadImage);

applyPreset('square');
setFieldState();
setVerticalFields();
updateQualityValue();
enableActions(false);
