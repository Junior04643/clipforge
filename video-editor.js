(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const fileInput = byId("videoFile");
  const video = byId("sourceVideo");
  const empty = byId("videoEmpty");
  const startInput = byId("videoStart");
  const endInput = byId("videoEnd");
  const exportButton = byId("exportClipBtn");
  const status = byId("videoStatus");
  const progressBar = byId("exportProgress");
  const nameLabel = byId("videoName");
  const durationLabel = byId("videoDuration");
  const setStartButton = byId("setStartBtn");
  const setEndButton = byId("setEndBtn");
  const previewButton = byId("previewRangeBtn");
  const clearButton = byId("clearVideoBtn");
  const fileDetails = byId("fileDetails");
  const selectionDuration = byId("selectionDuration");
  const fullVideoButton = byId("fullVideoBtn");
  const convertButton = byId("convertVideoBtn");
  const lengthButtons = Array.from(document.querySelectorAll("[data-clip-length]"));

  let selectedFile = null;
  let sourceUrl = null;
  let outputUrl = null;
  let ffmpeg = null;
  let ffmpegLoading = null;
  let previewingRange = false;
  let conversionInProgress = false;

  function message(text, kind) {
    status.textContent = text;
    status.className = "video-status" + (kind ? " " + kind : "");
  }
  function seconds(value) {
    return Number.isFinite(value) ? value.toFixed(2) + "s" : "—";
  }
  function validRange() {
    const start = Number(startInput.value);
    const end = Number(endInput.value);
    if (!selectedFile || !Number.isFinite(start) || !Number.isFinite(end) ||
        start < 0 || end <= start || end > video.duration + 0.05) {
      message("Check the clip range. The end must be after the start and within the video duration.", "error");
      return null;
    }
    return { start, end, duration: end - start };
  }
  function updateControls() {
    const ready = Boolean(selectedFile && Number.isFinite(video.duration) && video.duration > 0);
    [startInput, endInput, setStartButton, setEndButton, previewButton, exportButton, clearButton, fullVideoButton, convertButton, ...lengthButtons]
      .forEach((control) => { control.disabled = !ready; });
  }
  function releaseUrl(url) {
    if (url) URL.revokeObjectURL(url);
  }
  function updateSelectionSummary() {
    const start = Number(startInput.value);
    const end = Number(endInput.value);
    selectionDuration.textContent = Number.isFinite(start) && Number.isFinite(end) && end > start
      ? "Selected: " + (end - start).toFixed(2) + " sec"
      : "Selected: —";
  }
  function applyLength(length) {
    if (!selectedFile || !Number.isFinite(video.duration)) return;
    const start = Math.max(0, Math.min(Number(startInput.value) || 0, video.duration));
    startInput.value = start.toFixed(2);
    endInput.value = Math.min(video.duration, start + length).toFixed(2);
    updateSelectionSummary();
    message("Clip length set to " + (Number(endInput.value) - start).toFixed(2) + " seconds.", "good");
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      message("Please choose a video file.", "error");
      fileInput.value = "";
      return;
    }
    if (file.size > 250 * 1024 * 1024) {
      message("This file is over 250 MB. Choose a smaller video for this phone-friendly editor.", "error");
      fileInput.value = "";
      return;
    }
    selectedFile = file;
    releaseUrl(sourceUrl);
    sourceUrl = URL.createObjectURL(file);
    video.src = sourceUrl;
    video.hidden = false;
    empty.hidden = true;
    nameLabel.textContent = file.name;
    fileDetails.textContent = (file.type || "Video file") + " · " + (file.size / (1024 * 1024)).toFixed(1) + " MB";
    durationLabel.textContent = "Reading duration…";
    updateControls();
    message("Loading video preview…");
  });

  video.addEventListener("loadedmetadata", () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      message("This video’s duration could not be read by your browser.", "error");
      return;
    }
    startInput.value = "0";
    endInput.value = video.duration.toFixed(2);
    startInput.max = video.duration;
    endInput.max = video.duration;
    durationLabel.textContent = "Duration: " + seconds(video.duration);
    updateSelectionSummary();
    updateControls();
    message("Video ready. Set your start and end points, then preview or export the selection.", "good");
  });
  video.addEventListener("error", () => {
    if (conversionInProgress) return;
    const code = video.error ? video.error.code : 0;
    const reason = ({1:"Playback was interrupted",2:"A media loading error occurred",3:"The browser could not decode this video",4:"This video format or codec is unsupported"})[code] || "The browser could not decode this video";
    convertButton.disabled = !selectedFile || selectedFile.size > 80 * 1024 * 1024;
    message(reason + ". Try the built-in compatibility conversion below. It runs on your device and needs no API key.", "error");
  });
  video.addEventListener("timeupdate", () => {
    if (previewingRange && video.currentTime >= Number(endInput.value)) {
      video.pause();
      previewingRange = false;
    }
  });

  startInput.addEventListener("input", updateSelectionSummary);
  endInput.addEventListener("input", updateSelectionSummary);
  lengthButtons.forEach((button) => button.addEventListener("click", () => applyLength(Number(button.dataset.clipLength))));
  fullVideoButton.addEventListener("click", () => {
    startInput.value = "0";
    endInput.value = video.duration.toFixed(2);
    updateSelectionSummary();
    message("Full video selected.", "good");
  });
  setStartButton.addEventListener("click", () => {
    startInput.value = Math.min(video.currentTime, Number(endInput.value) - 0.1).toFixed(2);
    updateSelectionSummary();
  });
  setEndButton.addEventListener("click", () => {
    endInput.value = Math.max(video.currentTime, Number(startInput.value) + 0.1).toFixed(2);
    updateSelectionSummary();
  });
  previewButton.addEventListener("click", async () => {
    if (!validRange()) return;
    previewingRange = true;
    video.currentTime = Number(startInput.value);
    try { await video.play(); }
    catch (_) { previewingRange = false; message("Tap the video player’s play control to preview this section.", "error"); }
  });

  async function loadFFmpeg() {
    if (ffmpeg) return ffmpeg;
    if (ffmpegLoading) return ffmpegLoading;
    ffmpegLoading = (async () => {
      message("Preparing the video engine. The first load needs an internet connection and may take a little while…");
      const { FFmpeg } = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js");
      const { toBlobURL } = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js");
      const engine = new FFmpeg();
      engine.on("progress", ({ progress }) => {
        const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
        progressBar.style.width = percent + "%";
        message("Exporting clip… " + percent + "%");
      });
      engine.on("log", ({ message: logMessage }) => {
        if (logMessage && /error/i.test(logMessage)) console.warn("ClipForge FFmpeg:", logMessage);
      });
      const coreBase = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
      await engine.load({
        coreURL: await toBlobURL(coreBase + "/ffmpeg-core.js", "text/javascript"),
        wasmURL: await toBlobURL(coreBase + "/ffmpeg-core.wasm", "application/wasm")
      });
      ffmpeg = engine;
      return engine;
    })();
    try { return await ffmpegLoading; }
    catch (error) { ffmpegLoading = null; throw error; }
  }

  convertButton.addEventListener("click", async () => {
    if (!selectedFile || selectedFile.size > 80 * 1024 * 1024) {
      message("For phone safety, compatibility conversion is limited to videos of 80 MB or less.", "error");
      return;
    }
    conversionInProgress = true;
    convertButton.disabled = true;
    exportButton.disabled = true;
    fileInput.disabled = true;
    progressBar.style.width = "0%";
    const inputName = "clipforge-original";
    const outputName = "clipforge-compatible.mp4";
    try {
      const engine = await loadFFmpeg();
      message("Converting your source to browser-friendly H.264/AAC. Keep this page open; this may take a few minutes on a phone…");
      await engine.writeFile(inputName, new Uint8Array(await selectedFile.arrayBuffer()));
      const result = await engine.exec([
        "-i", inputName,
        "-map", "0:v:0",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "28",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "96k",
        "-movflags", "+faststart",
        outputName
      ]);
      if (result !== 0) throw new Error("The converter could not decode this source. It may use an unsupported codec.");
      const data = await engine.readFile(outputName);
      const compatible = new File([data], "clipforge-compatible.mp4", {type:"video/mp4"});
      selectedFile = compatible;
      releaseUrl(sourceUrl);
      sourceUrl = URL.createObjectURL(compatible);
      video.src = sourceUrl;
      video.load();
      nameLabel.textContent = compatible.name;
      fileDetails.textContent = "Converted H.264/AAC · " + (compatible.size / (1024 * 1024)).toFixed(1) + " MB";
      message("Conversion finished. Loading the compatible preview…", "good");
      await engine.deleteFile(inputName).catch(() => {});
      await engine.deleteFile(outputName).catch(() => {});
    } catch (error) {
      console.error("ClipForge compatibility conversion failed:", error);
      message("Conversion failed: " + (error && error.message ? error.message : "unknown error") + " Try exporting the source from a trusted editor as MP4 (H.264 video + AAC audio).", "error");
      convertButton.disabled = false;
    } finally {
      conversionInProgress = false;
      exportButton.disabled = false;
      fileInput.disabled = false;
    }
  });

  exportButton.addEventListener("click", async () => {
    const range = validRange();
    if (!range) return;
    if (selectedFile.size > 100 * 1024 * 1024) {
      message("This file is larger than 100 MB. It may exceed your phone’s available memory. Try a shorter or smaller source video.", "error");
      return;
    }
    exportButton.disabled = true;
    fileInput.disabled = true;
    progressBar.style.width = "0%";
    let inputName = "clipforge-source";
    let outputName = "clipforge-export.mp4";
    try {
      const engine = await loadFFmpeg();
      const extension = (selectedFile.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
      inputName += "." + (extension || "mp4");
      outputName = "clipforge-" + Date.now() + ".mp4";
      message("Reading your video into the local processing engine…");
      await engine.writeFile(inputName, new Uint8Array(await selectedFile.arrayBuffer()));
      message("Exporting the selected section. Keep this tab open…");
      const result = await engine.exec([
        "-ss", String(range.start),
        "-i", inputName,
        "-t", String(range.duration),
        "-map", "0:v:0",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "25",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        outputName
      ]);
      if (result !== 0) throw new Error("The video engine could not finish this export. Try a shorter MP4 source.");
      const output = await engine.readFile(outputName);
      const blob = new Blob([output], { type: "video/mp4" });
      releaseUrl(outputUrl);
      outputUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = outputUrl;
      link.download = outputName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      progressBar.style.width = "100%";
      message("Export complete. Your MP4 clip download should now be available.", "good");
      await engine.deleteFile(inputName).catch(() => {});
      await engine.deleteFile(outputName).catch(() => {});
    } catch (error) {
      console.error("ClipForge export failed:", error);
      message("Export failed: " + (error && error.message ? error.message : "unknown error") + " Try a shorter H.264 MP4 video and check your internet connection for the first engine load.", "error");
    } finally {
      exportButton.disabled = false;
      fileInput.disabled = false;
    }
  });

  clearButton.addEventListener("click", () => {
    video.pause();
    video.removeAttribute("src");
    video.load();
    releaseUrl(sourceUrl);
    releaseUrl(outputUrl);
    sourceUrl = null;
    outputUrl = null;
    selectedFile = null;
    convertButton.disabled = true;
    fileInput.value = "";
    video.hidden = true;
    empty.hidden = false;
    nameLabel.textContent = "No video selected";
    durationLabel.textContent = "Duration: —";
    fileDetails.textContent = "File details appear here";
    selectionDuration.textContent = "Selected: —";
    startInput.value = "0";
    endInput.value = "0";
    progressBar.style.width = "0%";
    previewingRange = false;
    updateControls();
    message("Video cleared. Select another file to continue.");
  });

  updateControls();
})();
