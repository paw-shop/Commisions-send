/* global crypto */

// Configuración principal del portal.
const CONFIG = {
  // Pega aquí la URL /exec de tu Web App de Apps Script.
  scriptUrl: "https://script.google.com/macros/s/AKfycbyEugZm73bEjotD0kK9uHRT3bRkDRQXWn1gDdPGQeXa4qyexICRhxUhIU9awLiFs8TR/exec",
  // Orígenes permitidos para la respuesta del iframe de Apps Script.
  allowedOrigins: [
    "https://script.google.com",
    "https://script.googleusercontent.com"
  ],
  requestTimeoutMs: 120000
};

// Estado de la interfaz y de la cola de subida.
const state = {
  files: [],
  submissionToken: "",
  submitting: false,
  completedFiles: 0,
  pendingResolve: null,
  pendingReject: null,
  pendingLoadHandler: null,
  timeoutHandle: null
};

const elements = {};

document.addEventListener("DOMContentLoaded", initialize);

function initialize() {
  cacheElements();
  bindEvents();
  renderFileList();
  updateFileSummary();
  setProgress(0, "Lista para recibir archivos.");
}

// Guarda referencias a los elementos que usa el flujo de subida.
function cacheElements() {
  elements.form = document.getElementById("uploadForm");
  elements.clientName = document.getElementById("clientName");
  elements.contact = document.getElementById("contact");
  elements.projectDescription = document.getElementById("projectDescription");
  elements.fileInput = document.getElementById("files");
  elements.dropzone = document.getElementById("dropzone");
  elements.fileSummary = document.getElementById("fileSummary");
  elements.progressFill = document.getElementById("progressFill");
  elements.progressText = document.getElementById("progressText");
  elements.subStatus = document.getElementById("subStatus");
  elements.messageStack = document.getElementById("messageStack");
  elements.submitBtn = document.getElementById("submitBtn");
  elements.clearBtn = document.getElementById("clearBtn");
  elements.uploadList = document.getElementById("uploadList");
  elements.fileTemplate = document.getElementById("fileItemTemplate");
}

// Conecta eventos de formulario, drag and drop y mensajes del iframe.
function bindEvents() {
  elements.form.addEventListener("submit", handleSubmit);
  elements.clearBtn.addEventListener("click", resetForm);
  elements.fileInput.addEventListener("change", handleFileSelection);
  elements.dropzone.addEventListener("click", () => elements.fileInput.click());
  elements.dropzone.addEventListener("dragover", handleDragOver);
  elements.dropzone.addEventListener("dragleave", handleDragLeave);
  elements.dropzone.addEventListener("drop", handleDrop);
  elements.dropzone.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elements.fileInput.click();
    }
  });
  window.addEventListener("message", handleIframeMessage);
}

function isConfigured() {
  return Boolean(CONFIG.scriptUrl && !CONFIG.scriptUrl.includes("PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE"));
}

function handleDragOver(event) {
  event.preventDefault();
  elements.dropzone.classList.add("dragover");
}

function handleDragLeave() {
  elements.dropzone.classList.remove("dragover");
}

function handleDrop(event) {
  event.preventDefault();
  elements.dropzone.classList.remove("dragover");

  if (!event.dataTransfer?.files?.length) {
    return;
  }

  const transfer = new DataTransfer();
  for (const file of event.dataTransfer.files) {
    transfer.items.add(file);
  }

  elements.fileInput.files = transfer.files;
  handleFileSelection();
}

function handleFileSelection() {
  state.files = Array.from(elements.fileInput.files || []);
  renderFileList();
  updateFileSummary();
}

function updateFileSummary() {
  if (!state.files.length) {
    elements.fileSummary.textContent = "Aún no seleccionaste archivos.";
    return;
  }

  const totalBytes = state.files.reduce((sum, file) => sum + file.size, 0);
  elements.fileSummary.textContent = `${state.files.length} archivo(s) · ${formatBytes(totalBytes)} en total.`;
}

function renderFileList(fileStates = null) {
  elements.uploadList.innerHTML = "";

  if (!state.files.length) {
    elements.uploadList.innerHTML = `
      <div class="upload-item">
        <div class="upload-item-state">Aún no seleccionaste archivos.</div>
      </div>
    `;
    return;
  }

  state.files.forEach((file, index) => {
    const node = elements.fileTemplate.content.firstElementChild.cloneNode(true);
    const itemName = node.querySelector(".upload-item-name");
    const itemState = node.querySelector(".upload-item-state");
    const itemMeta = node.querySelector(".upload-item-meta");
    const miniFill = node.querySelector(".mini-fill");

    itemName.textContent = file.name;
    itemMeta.textContent = `${formatBytes(file.size)} · ${file.type || "tipo desconocido"}`;

    const currentState = fileStates?.[index];
    miniFill.style.width = `${currentState?.progress ?? 0}%`;
    itemState.textContent = currentState?.label || "En cola";

    elements.uploadList.appendChild(node);
  });
}

function setFileState(index, label, progress) {
  const fileStates = state.files.map((file, fileIndex) => ({
    label: fileIndex === index ? label : fileIndex < state.completedFiles ? "Subido" : "En cola",
    progress: fileIndex === index ? progress : fileIndex < state.completedFiles ? 100 : 0
  }));

  renderFileList(fileStates);
}

function setProgress(percent, text) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  elements.progressFill.style.width = `${clamped}%`;
  elements.progressText.textContent = `${clamped}%`;
  elements.subStatus.textContent = text;
}

function addMessage(text, type = "info") {
  const node = document.createElement("div");
  node.className = `alert ${type}`;
  node.textContent = text;
  elements.messageStack.prepend(node);
}

function clearMessages() {
  elements.messageStack.innerHTML = "";
}

function resetForm() {
  if (state.submitting) {
    return;
  }

  elements.form.reset();
  state.files = [];
  state.completedFiles = 0;
  renderFileList();
  updateFileSummary();
  clearMessages();
  setProgress(0, "Lista para recibir archivos.");
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!isConfigured()) {
    addMessage("Falta configurar la URL de Apps Script en `script.js`.", "error");
    return;
  }

  if (state.submitting) {
    return;
  }

  const clientName = elements.clientName.value.trim();
  const contact = elements.contact.value.trim();
  const projectDescription = elements.projectDescription.value.trim();
  const files = Array.from(elements.fileInput.files || []);

  if (!clientName || !contact || !projectDescription || !files.length) {
    addMessage("Completa los campos y selecciona al menos un archivo.", "error");
    return;
  }

  state.submitting = true;
  state.completedFiles = 0;
  state.submissionToken = createToken();

  clearMessages();
  setFormDisabled(true);
  setProgress(4, "Preparando archivos...");
  addMessage("Preparando tu entrega.", "info");

  try {
    const preparedFiles = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setFileState(index, "Leyendo", 8);

      const base64Data = await readFileAsBase64(file, progress => {
        const percent = 5 + progress * 0.45;
        setProgress(percent, `Leyendo ${file.name}...`);
        setFileState(index, "Leyendo", Math.max(8, Math.round(progress)));
      });

      preparedFiles.push({
        file,
        data: file.size === 0 ? "" : base64Data
      });
    }

    setProgress(30, "Archivos listos. Enviando...");

    for (let index = 0; index < preparedFiles.length; index += 1) {
      const payload = preparedFiles[index];
      setFileState(index, "Subiendo", 35);

      await postSingleFile({
        token: state.submissionToken,
        clientName,
        contact,
        projectDescription,
        fileName: payload.file.name,
        mimeType: payload.file.type || "application/octet-stream",
        fileData: payload.data,
        fileSize: payload.file.size,
        fileIndex: index + 1,
        fileTotal: preparedFiles.length
      });

      state.completedFiles += 1;
      setFileState(index, "Subido", 100);
      const progress = 30 + (state.completedFiles / preparedFiles.length) * 68;
      setProgress(progress, `Subido ${state.completedFiles} de ${preparedFiles.length}.`);
    }

    setProgress(100, "Entrega completada.");
    addMessage("Éxito. Tu entrega ya fue enviada.", "success");
    elements.subStatus.textContent = "Tus archivos ya quedaron enviados.";
  } catch (error) {
    console.error(error);
    addMessage(error.message || "La subida falló. Intenta de nuevo.", "error");
    setProgress(0, "Subida detenida.");
    elements.subStatus.textContent = "Algo salió mal durante la subida.";
  } finally {
    state.submitting = false;
    setFormDisabled(false);
    cleanupTransport();
  }
}

function setFormDisabled(disabled) {
  elements.submitBtn.disabled = disabled;
  elements.clearBtn.disabled = disabled;
  elements.clientName.disabled = disabled;
  elements.contact.disabled = disabled;
  elements.projectDescription.disabled = disabled;
  elements.fileInput.disabled = disabled;
  elements.dropzone.style.opacity = disabled ? "0.72" : "1";
}

function createToken() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFileAsBase64(file, onProgress) {
  if (file.size === 0) {
    return Promise.resolve("");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] || "" : result);
    };

    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}.`));

    reader.onprogress = event => {
      if (event.lengthComputable) {
        const percent = (event.loaded / event.total) * 100;
        onProgress?.(percent);
      }
    };

    reader.readAsDataURL(file);
  });
}

// Crea el iframe y el formulario oculto que usa el POST cruzado.
function ensureTransport() {
  let iframe = document.getElementById("uploadTransport");
  let form = document.getElementById("uploadTransportForm");

  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "uploadTransport";
    iframe.name = "uploadTransport";
    iframe.className = "hidden-frame";
    document.body.appendChild(iframe);
  }

  if (!form) {
    form = document.createElement("form");
    form.id = "uploadTransportForm";
    form.method = "POST";
    form.target = "uploadTransport";
    form.className = "hidden-frame";
    form.style.display = "none";
    document.body.appendChild(form);
  }

  return { iframe, form };
}

function cleanupTransport() {
  const form = document.getElementById("uploadTransportForm");
  if (form) {
    form.innerHTML = "";
  }
}

function postSingleFile(payload) {
  return new Promise((resolve, reject) => {
    const { iframe, form } = ensureTransport();
    cleanupTransport();

    state.pendingResolve = resolve;
    state.pendingReject = reject;

    if (state.timeoutHandle) {
      clearTimeout(state.timeoutHandle);
    }

    let submitted = false;

    if (state.pendingLoadHandler) {
      iframe.removeEventListener("load", state.pendingLoadHandler);
    }

    state.pendingLoadHandler = () => {
      if (!submitted || !state.pendingResolve) {
        return;
      }

      window.setTimeout(() => {
        if (state.pendingResolve) {
          resolvePendingUpload({
            ok: true,
            token: payload.token,
            fallback: true
          });
        }
      }, 250);
    };

    iframe.addEventListener("load", state.pendingLoadHandler);

    state.timeoutHandle = window.setTimeout(() => {
      rejectPendingUpload(new Error("La subida excedió el tiempo de espera. Revisa tu despliegue de Apps Script y vuelve a intentar."));
    }, CONFIG.requestTimeoutMs);

    form.action = CONFIG.scriptUrl;
    form.innerHTML = "";

    Object.entries(payload).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    });

    submitted = true;
    form.submit();
  });
}

function handleIframeMessage(event) {
  if (!isAllowedResponseOrigin(event.origin)) {
    return;
  }

  const data = event.data;
  if (!data || data.type !== "commission-upload-result") {
    return;
  }

  if (data.token !== state.submissionToken) {
    return;
  }

  if (data.ok) {
    resolvePendingUpload(data);
    return;
  }

  rejectPendingUpload(new Error(data.error || "El servidor devolvió un error desconocido."));
}

function isAllowedResponseOrigin(origin) {
  try {
    const hostname = new URL(origin).hostname;

    return CONFIG.allowedOrigins.includes(origin)
      || hostname === "script.google.com"
      || hostname === "script.googleusercontent.com"
      || hostname.endsWith(".googleusercontent.com");
  } catch (error) {
    return false;
  }
}

function resolvePendingUpload(data) {
  if (state.timeoutHandle) {
    clearTimeout(state.timeoutHandle);
    state.timeoutHandle = null;
  }

  removePendingLoadHandler();

  const resolve = state.pendingResolve;
  state.pendingResolve = null;
  state.pendingReject = null;

  resolve?.(data);
}

function rejectPendingUpload(error) {
  if (state.timeoutHandle) {
    clearTimeout(state.timeoutHandle);
    state.timeoutHandle = null;
  }

  removePendingLoadHandler();

  const reject = state.pendingReject;
  state.pendingResolve = null;
  state.pendingReject = null;

  reject?.(error);
}

function removePendingLoadHandler() {
  if (!state.pendingLoadHandler) {
    return;
  }

  const iframe = document.getElementById("uploadTransport");
  if (iframe) {
    iframe.removeEventListener("load", state.pendingLoadHandler);
  }

  state.pendingLoadHandler = null;
}

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}
