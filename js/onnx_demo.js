import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { CiclopesLaneAnalysis } from "@revmetrix/ciclopes-lane-analysis";
import { loadNavbar } from "./navbar.js";

loadNavbar();

const status = document.getElementById("status");
const resultOutput = document.getElementById("result");
const technicalOutput = document.getElementById("technical-result");
const fileInput = document.getElementById("image-file");
const analyzeButton = document.getElementById("analyze");
const manualButton = document.getElementById("manual");
const correctButton = document.getElementById("correct");
const candidateSelect = document.getElementById("candidate");
const preview = document.getElementById("preview");
const frameCanvas = document.getElementById("frame");
const overlayCanvas = document.getElementById("overlay");
const imageName = document.getElementById("image-name");
const videoInput = document.getElementById("video-file");
const videoName = document.getElementById("video-name");
const uploadTokenInput = document.getElementById("upload-token");
const uploadStatus = document.getElementById("upload-status");
const uploadResult = document.getElementById("upload-result");
const recordStartButton = document.getElementById("record-start");
const recordStopButton = document.getElementById("record-stop");
const recordStatus = document.getElementById("record-status");
const cameraPreview = document.getElementById("camera-preview");
const videoPreview = document.getElementById("video-preview");
const videoFrameReview = document.getElementById("video-frame-review");
const frameList = document.getElementById("frame-list");
const frameReviewStatus = document.getElementById("frame-review-status");
const frameContext = frameCanvas.getContext("2d");
const overlayContext = overlayCanvas.getContext("2d");

let frameDimensions = null;
let laneCorners = null;
let result = null;
let draggedCorner = -1;
let canRunOnDevice = false;
let videoFrames = [];
let selectedVideoFrame = -1;
let recorder = null;
let cameraStream = null;
let recordingChunks = [];
let currentVideoUrl = null;

function setStatus(message) {
  status.textContent = message;
}

function showFrameResult(frameResult, { correction = null, error = null } = {}) {
  if (error) {
    resultOutput.textContent = `We couldn’t analyze this frame. ${error.message || error}`;
    technicalOutput.textContent = error.stack || String(error);
    return;
  }

  const laneCount = frameResult?.candidates?.length ?? 0;
  const ballCount = frameResult?.balls?.length ?? 0;
  const ballText = ballCount === 1 ? "1 ball" : `${ballCount} balls`;
  if (correction) {
    resultOutput.textContent = `Lane outline saved for this frame. The adjusted lane is ready to use for measurements. ${ballText} detected.`;
  } else if (laneCount > 0) {
    resultOutput.textContent = `We found ${laneCount === 1 ? "a lane" : `${laneCount} possible lanes`} and ${ballText}. Check the orange outline; drag its corners if it needs adjusting.`;
  } else {
    resultOutput.textContent = `We couldn’t find the lane automatically${ballCount ? `, but found ${ballText}` : ""}. Tap “Set lane corners,” then drag the orange dots to outline the lane.`;
  }
  technicalOutput.textContent = JSON.stringify({ detections: frameResult, correction }, null, 2);
}

function drawCorners() {
  overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (!laneCorners) return;

  overlayContext.lineWidth = Math.max(3, overlayCanvas.width / 350);
  overlayContext.strokeStyle = "#e79f40";
  overlayContext.fillStyle = "#d06c01";
  overlayContext.beginPath();
  laneCorners.forEach((point, index) => {
    const x = point.x * overlayCanvas.width;
    const y = point.y * overlayCanvas.height;
    if (index === 0) overlayContext.moveTo(x, y);
    else overlayContext.lineTo(x, y);
  });
  overlayContext.closePath();
  overlayContext.stroke();

  const radius = Math.max(9, overlayCanvas.width / 70);
  laneCorners.forEach((point) => {
    overlayContext.beginPath();
    overlayContext.arc(point.x * overlayCanvas.width, point.y * overlayCanvas.height, radius, 0, 2 * Math.PI);
    overlayContext.fill();
    overlayContext.stroke();
  });
}

function persistSelectedFrame() {
  if (selectedVideoFrame >= 0 && videoFrames[selectedVideoFrame]) {
    videoFrames[selectedVideoFrame].corners = laneCorners?.map(({ x, y }) => ({ x, y })) ?? null;
  }
}

function selectCandidate(index) {
  const candidate = result?.candidates[index];
  laneCorners = candidate ? candidate.corners.map(({ x, y }) => ({ x, y })) : null;
  correctButton.disabled = !laneCorners;
  persistSelectedFrame();
  drawCorners();
}

function pointFromPointer(event) {
  const bounds = overlayCanvas.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
    y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
  };
}

overlayCanvas.addEventListener("pointerdown", (event) => {
  if (!laneCorners) return;
  const point = pointFromPointer(event);
  const threshold = Math.max(0.025, 18 / overlayCanvas.width);
  draggedCorner = laneCorners.findIndex((corner) => Math.hypot(corner.x - point.x, corner.y - point.y) < threshold);
  if (draggedCorner >= 0) overlayCanvas.setPointerCapture(event.pointerId);
});

overlayCanvas.addEventListener("pointermove", (event) => {
  if (draggedCorner < 0) return;
  laneCorners[draggedCorner] = pointFromPointer(event);
  persistSelectedFrame();
  drawCorners();
});

function finishDrag() {
  draggedCorner = -1;
}
overlayCanvas.addEventListener("pointerup", finishDrag);
overlayCanvas.addEventListener("pointercancel", finishDrag);

function clearVideoFrames() {
  videoFrames.forEach((frame) => URL.revokeObjectURL(frame.imageUrl));
  videoFrames = [];
  selectedVideoFrame = -1;
  frameList.replaceChildren();
  videoFrameReview.hidden = true;
}

function resizeFrame(width, height) {
  const scale = Math.min(1, 1920 / Math.max(width, height));
  const scaledWidth = Math.max(1, Math.round(width * scale));
  const scaledHeight = Math.max(1, Math.round(height * scale));
  frameCanvas.width = overlayCanvas.width = scaledWidth;
  frameCanvas.height = overlayCanvas.height = scaledHeight;
  frameDimensions = { width: scaledWidth, height: scaledHeight };
}

function renderFrameList() {
  frameList.replaceChildren();
  videoFrames.forEach((frame, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "frame-choice";
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-pressed", String(index === selectedVideoFrame));
    button.classList.toggle("is-selected", index === selectedVideoFrame);

    const image = document.createElement("img");
    image.src = frame.imageUrl;
    image.alt = "";
    const caption = document.createElement("span");
    caption.textContent = `${frame.label}${frame.result?.candidates.length ? ` · ${frame.result.candidates.length} lane${frame.result.candidates.length === 1 ? "" : "s"}` : " · no lane"}`;
    button.append(image, caption);
    button.addEventListener("click", () => showVideoFrame(index));
    frameList.append(button);
  });
}

function showVideoFrame(index) {
  persistSelectedFrame();
  const item = videoFrames[index];
  if (!item) return;
  selectedVideoFrame = index;
  result = item.result;
  laneCorners = item.corners?.map(({ x, y }) => ({ x, y }))
    ?? result?.candidates[0]?.corners.map(({ x, y }) => ({ x, y }))
    ?? null;
  frameCanvas.width = overlayCanvas.width = item.width;
  frameCanvas.height = overlayCanvas.height = item.height;
  const image = new Image();
  image.onload = () => {
    frameContext.clearRect(0, 0, item.width, item.height);
    frameContext.drawImage(image, 0, 0, item.width, item.height);
    preview.hidden = false;
    candidateSelect.replaceChildren();
    if (result?.candidates.length) {
      result.candidates.forEach((candidate, candidateIndex) => {
        candidateSelect.add(new Option(`Lane ${candidateIndex + 1} (${candidate.confidence.toFixed(2)})`, String(candidateIndex)));
      });
      candidateSelect.value = "0";
    } else {
      candidateSelect.add(new Option("No detected lane", ""));
    }
    candidateSelect.disabled = !result?.candidates.length;
    correctButton.disabled = !laneCorners;
    manualButton.disabled = !canRunOnDevice;
    analyzeButton.disabled = true;
    drawCorners();
    frameReviewStatus.textContent = `Frame ${index + 1} of ${videoFrames.length} · ${item.label}`;
    showFrameResult(result, { correction: item.correction });
    setStatus(`Frame ${index + 1} of ${videoFrames.length} is selected. Review the outline or adjust it below.`);
    renderFrameList();
  };
  image.src = item.imageUrl;
}

function fileFromCanvas(canvas, type = "image/jpeg", quality = 0.88) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode video frame.")), type, quality));
}

async function writeFrameToCache() {
  const dataUrl = frameCanvas.toDataURL("image/jpeg", 0.88);
  const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const path = `ciclopes-frame-${Date.now()}.jpg`;
  await Filesystem.writeFile({ path, data, directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  return { path, uri };
}

async function runFrameInference() {
  if (!canRunOnDevice) throw new Error("Local video-frame detection is available in the Android app only.");
  const cached = await writeFrameToCache();
  try {
    return await CiclopesLaneAnalysis.analyzeFrame({
      frameUri: cached.uri,
      width: frameDimensions.width,
      height: frameDimensions.height,
      rotation: 0,
    });
  } finally {
    await Filesystem.deleteFile({ path: cached.path, directory: Directory.Cache }).catch(() => {});
  }
}

function waitForVideoEvent(video, eventName) {
  return new Promise((resolve, reject) => {
    const onReady = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("The video could not be decoded on this device.")); };
    const cleanup = () => {
      video.removeEventListener(eventName, onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(eventName, onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function detectVideoFrames(file) {
  clearVideoFrames();
  frameList.replaceChildren();
  videoFrameReview.hidden = false;
  frameReviewStatus.textContent = "Opening video…";
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  const objectUrl = URL.createObjectURL(file);
  if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
  currentVideoUrl = objectUrl;
  videoPreview.src = objectUrl;
  videoPreview.hidden = false;
  video.src = objectUrl;
  await waitForVideoEvent(video, "loadedmetadata");
  if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error("This video has no readable duration.");

  const count = Math.min(12, Math.max(2, Math.ceil(video.duration * 1.5)));
  const start = Math.min(0.15, video.duration / 10);
  const end = Math.max(start, video.duration - Math.min(0.08, video.duration / 20));
  const times = Array.from({ length: count }, (_, index) => count === 1 ? start : start + ((end - start) * index) / (count - 1));

  for (let index = 0; index < times.length; index += 1) {
    const timeSeconds = times[index];
    frameReviewStatus.textContent = `Analyzing frame ${index + 1} of ${times.length} on this Android phone…`;
    if (Math.abs(video.currentTime - timeSeconds) > 0.01) {
      const seeked = waitForVideoEvent(video, "seeked");
      video.currentTime = timeSeconds;
      await seeked;
    }

    resizeFrame(video.videoWidth, video.videoHeight);
    frameContext.drawImage(video, 0, 0, frameDimensions.width, frameDimensions.height);
    const blob = await fileFromCanvas(frameCanvas);
    const imageUrl = URL.createObjectURL(blob);
    const frameItem = {
      imageUrl,
      width: frameDimensions.width,
      height: frameDimensions.height,
      timeSeconds,
      label: `${timeSeconds.toFixed(2)} s`,
      result: null,
      corners: null,
      correction: null,
    };
    videoFrames.push(frameItem);
    try {
      frameItem.result = await runFrameInference();
    } catch (error) {
      frameItem.error = error.message;
      frameItem.result = { candidates: [], balls: [], health: { inferenceMs: 0, laneCount: 0, ballCount: 0 } };
    }
    renderFrameList();
  }

  renderFrameList();
  if (videoFrames.length) showVideoFrame(0);
  const successful = videoFrames.filter((frame) => !frame.error).length;
  frameReviewStatus.textContent = `Analyzed ${successful} of ${videoFrames.length} sampled frames. Select a thumbnail to review or adjust its lane.`;
  if (!canRunOnDevice) {
    frameReviewStatus.textContent = "Video is ready, but local ONNX frame detection requires the Android app.";
  }
}

async function uploadVideo(file) {
  const token = uploadTokenInput.value.trim();
  if (!token) {
    uploadStatus.textContent = "Video is ready for local frame detection. Paste a RevMetrix upload token to upload it.";
    return null;
  }

  uploadStatus.textContent = `Uploading ${file.name}… Keep the app open until it finishes.`;
  const form = new FormData();
  form.append("file", file, file.name);
  const base = import.meta.env.VITE_REVMETRIX_API_BASE || "https://api.revmetrix.io";
  const response = await fetch(`${base.replace(/\/$/, "")}/api/videos/upload?folder=videos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || body.message || `Upload failed (HTTP ${response.status}).`);
  if (!body.key) throw new Error("The upload completed, but the API did not return a video key.");
  uploadResult.textContent = JSON.stringify({ file: file.name, videoKey: body.key }, null, 2);
  uploadResult.hidden = false;
  uploadStatus.textContent = "Video uploaded. Sampled frames are being analyzed on this Android phone.";
  return body.key;
}

async function processVideo(file) {
  if (!file.type.startsWith("video/")) {
    uploadStatus.textContent = "Choose a video file.";
    return;
  }
  videoName.textContent = file.name;
  uploadResult.hidden = true;
  uploadResult.textContent = "";
  videoInput.disabled = true;
  recordStartButton.disabled = true;
  recordStopButton.disabled = true;

  const uploadPromise = uploadVideo(file).catch((error) => {
    uploadStatus.textContent = `Upload failed: ${error.message}. Local frame detection will continue.`;
    return null;
  });
  try {
    await detectVideoFrames(file);
    const videoKey = await uploadPromise;
    if (videoKey) {
      uploadResult.textContent = JSON.stringify({ file: file.name, videoKey, sampledFrames: videoFrames.length }, null, 2);
      uploadResult.hidden = false;
      uploadStatus.textContent = "Video uploaded and sampled frames detected. Select a frame below to adjust its lane.";
    }
  } catch (error) {
    await uploadPromise;
    frameReviewStatus.textContent = `Could not analyze this video: ${error.message}`;
  } finally {
    videoInput.disabled = false;
    recordStartButton.disabled = false;
  }
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  imageName.textContent = file.name;
  selectedVideoFrame = -1;
  clearVideoFrames();
  try {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.src = objectUrl;
    await image.decode();
    resizeFrame(image.naturalWidth, image.naturalHeight);
    frameContext.drawImage(image, 0, 0, frameDimensions.width, frameDimensions.height);
    URL.revokeObjectURL(objectUrl);
    laneCorners = null;
    result = null;
    candidateSelect.replaceChildren(new Option("No detected lane", ""));
    candidateSelect.disabled = true;
    correctButton.disabled = true;
    manualButton.disabled = !canRunOnDevice;
    analyzeButton.disabled = !canRunOnDevice;
    preview.hidden = false;
    drawCorners();
    resultOutput.textContent = "Image ready. Tap “Run ONNX detection” to check for the lane.";
    technicalOutput.textContent = `${file.name} (${frameDimensions.width} × ${frameDimensions.height})`;
    setStatus("Ready to check this image on the Android phone.");
  } catch (error) {
    setStatus(`Could not read image: ${error.message}`);
  }
});

videoInput.addEventListener("change", () => {
  const file = videoInput.files?.[0];
  if (file) processVideo(file);
});

recordStartButton.addEventListener("click", async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("This device does not support in-app video recording in the current build.");
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    cameraPreview.srcObject = cameraStream;
    cameraPreview.hidden = false;
    await cameraPreview.play();
    recordingChunks = [];
    const mimeType = ["video/mp4;codecs=avc1", "video/webm;codecs=vp8", "video/webm"]
      .find((type) => MediaRecorder.isTypeSupported(type));
    recorder = mimeType ? new MediaRecorder(cameraStream, { mimeType }) : new MediaRecorder(cameraStream);
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) recordingChunks.push(event.data);
    });
    recorder.addEventListener("stop", () => {
      const type = recorder.mimeType || "video/webm";
      const extension = type.includes("mp4") ? "mp4" : "webm";
      const shot = new File([new Blob(recordingChunks, { type })], `revmetrix-shot-${Date.now()}.${extension}`, { type });
      cameraStream?.getTracks().forEach((track) => track.stop());
      cameraStream = null;
      cameraPreview.srcObject = null;
      cameraPreview.hidden = true;
      recordStatus.textContent = "Recording saved. Uploading and analyzing sampled frames…";
      processVideo(shot).finally(() => { recordStatus.textContent = "Recording complete."; });
    }, { once: true });
    recorder.start(250);
    recordStartButton.disabled = true;
    recordStopButton.disabled = false;
    recordStatus.textContent = "Recording. Frame the lane, then tap Stop and analyze.";
  } catch (error) {
    recordStatus.textContent = `Could not start camera: ${error.message}`;
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
});

recordStopButton.addEventListener("click", () => {
  if (recorder?.state === "recording") {
    recordStopButton.disabled = true;
    recordStatus.textContent = "Finishing recording…";
    recorder.stop();
  }
});

analyzeButton.addEventListener("click", async () => {
  if (!frameDimensions || !canRunOnDevice) return;
  analyzeButton.disabled = true;
  setStatus("Running ONNX Runtime on this phone…");
  try {
    result = await runFrameInference();
    candidateSelect.replaceChildren();
    result.candidates.forEach((candidate, index) => {
      candidateSelect.add(new Option(`Lane ${index + 1} (${candidate.confidence.toFixed(2)})`, String(index)));
    });
    candidateSelect.disabled = result.candidates.length === 0;
    laneCorners = result.candidates[0]?.corners.map(({ x, y }) => ({ x, y })) ?? null;
    correctButton.disabled = !laneCorners;
    drawCorners();
    showFrameResult(result);
    setStatus(`Frame checked in ${result.health.inferenceMs} ms.`);
  } catch (error) {
    showFrameResult(null, { error });
    setStatus(`Inference failed: ${error.message}`);
  } finally {
    analyzeButton.disabled = !frameDimensions || !canRunOnDevice;
  }
});

candidateSelect.addEventListener("change", () => {
  if (candidateSelect.value !== "") selectCandidate(Number(candidateSelect.value));
});

manualButton.addEventListener("click", () => {
  laneCorners = [
    { x: 0.3, y: 0.25 },
    { x: 0.7, y: 0.25 },
    { x: 0.95, y: 0.98 },
    { x: 0.05, y: 0.98 },
  ];
  correctButton.disabled = false;
  persistSelectedFrame();
  drawCorners();
  setStatus("Drag the four points to match the lane, then apply the correction.");
});

correctButton.addEventListener("click", async () => {
  if (!laneCorners || !frameDimensions) return;
  correctButton.disabled = true;
  try {
    const correction = await CiclopesLaneAnalysis.applyLaneCorrection({
      corners: laneCorners,
      coordinateSpace: "normalized_frame",
      frameWidth: frameDimensions.width,
      frameHeight: frameDimensions.height,
    });
    if (selectedVideoFrame >= 0) videoFrames[selectedVideoFrame].correction = correction;
    showFrameResult(result, { correction });
    setStatus("Lane outline adjusted for this frame.");
  } catch (error) {
    setStatus(`Correction rejected: ${error.message}`);
  } finally {
    correctButton.disabled = !laneCorners;
  }
});

async function initialize() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    canRunOnDevice = false;
    setStatus("Open this test page in the installed Android app to use ONNX inference.");
    resultOutput.textContent = "Open this demo in the Android app to check a frame on the phone. You can still choose or record a video here.";
    technicalOutput.textContent = "Local model inference is available in the Android app.";
    return;
  }
  try {
    const availability = await CiclopesLaneAnalysis.isAvailable();
    canRunOnDevice = availability.available;
    setStatus(availability.available ? "ONNX model is ready on this phone." : `Model unavailable: ${availability.reason ?? "unknown reason"}`);
    analyzeButton.disabled = !canRunOnDevice || !frameDimensions;
    manualButton.disabled = !canRunOnDevice || !frameDimensions;
  } catch (error) {
    setStatus(`Could not initialize the ONNX plugin: ${error.message}`);
  }
}

initialize();
