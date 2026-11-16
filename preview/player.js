(() => {
  "use strict";

  const playerScreen = document.getElementById("playerScreen");
  const video = document.getElementById("playerVideo");
  const closeButton = document.getElementById("playerClose");
  const toggleButton = document.getElementById("playerToggle");
  const rewindButton = document.getElementById("playerRewind");
  const forwardButton = document.getElementById("playerForward");
  const muteButton = document.getElementById("playerMute");
  const retryButton = document.getElementById("playerRetry");
  const statePanel = document.getElementById("playerState");
  const stateTitle = document.getElementById("playerStateTitle");
  const stateDetail = document.getElementById("playerStateDetail");
  const title = document.getElementById("playerTitle");
  const meta = document.getElementById("playerMeta");
  const kind = document.getElementById("playerKind");
  const sourceLabel = document.getElementById("playerSourceLabel");
  const resolution = document.getElementById("playerResolution");
  const liveIndicator = document.getElementById("playerLiveIndicator");
  const timeline = document.getElementById("playerTimeline");
  const progressFill = document.getElementById("playerProgressFill");
  const currentTimeLabel = document.getElementById("playerCurrentTime");
  const durationLabel = document.getElementById("playerDuration");

  let currentMedia = null;
  let hls = null;
  let returnFocus = null;
  let inertState = [];

  function icon(id) {
    return `<svg class="icon"><use href="#${id}" /></svg>`;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
    const safe = Math.floor(seconds);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const remainder = safe % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function setPanelState(mode, heading, detail = "") {
    statePanel.hidden = false;
    statePanel.classList.toggle("is-error", mode === "error");
    stateTitle.textContent = heading;
    stateDetail.textContent = detail;
  }

  function hidePanelState() {
    statePanel.hidden = true;
  }

  function updateResolution() {
    const width = video.videoWidth;
    const height = video.videoHeight;
    resolution.textContent = width > 0 && height > 0 ? `${width}×${height}` : "AUTO";
  }

  function updatePlaybackUI() {
    const playing = !video.paused && !video.ended;
    toggleButton.innerHTML = icon(playing ? "i-pause" : "i-play");
    toggleButton.setAttribute("aria-label", playing ? "暂停" : "播放");
    muteButton.innerHTML = icon(video.muted ? "i-mute" : "i-volume");
    muteButton.setAttribute("aria-label", video.muted ? "取消静音" : "静音");

    if (currentMedia?.isLive) {
      currentTimeLabel.textContent = playing ? "正在直播" : "直播已暂停";
      durationLabel.textContent = "直播";
      progressFill.style.width = "100%";
      return;
    }

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const position = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const progress = duration > 0 ? Math.min(1, position / duration) : 0;
    progressFill.style.width = `${progress * 100}%`;
    currentTimeLabel.textContent = formatTime(position);
    durationLabel.textContent = formatTime(duration);
  }

  function destroyHls() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
  }

  function showPlaybackError(message) {
    setPanelState("error", "片源暂时无法播放", message || "请检查网络后按“重新加载”重试");
  }

  function playVideo() {
    const promise = video.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {
        setPanelState("loading", "已准备好播放", "按播放按钮或 Enter 开始");
        updatePlaybackUI();
      });
    }
  }

  function attachSource() {
    if (!currentMedia) return;

    destroyHls();
    video.pause();
    video.removeAttribute("src");
    video.load();
    updateResolution();
    setPanelState("loading", "正在连接内容源", "首次加载可能需要几秒");

    const url = currentMedia.url;
    const isHls = /\.m3u8/i.test(url);

    if (!isHls) {
      video.src = url;
      video.load();
      playVideo();
      return;
    }

    const attachHlsJs = () => {
      hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30
      });
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        playVideo();
      });
      hls.on(window.Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const level = hls?.levels?.[data.level];
        if (level?.width && level?.height) {
          resolution.textContent = `${level.width}×${level.height}`;
        }
      });
      hls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
          showPlaybackError("网络错误，按“重新加载”可重新连接片源");
        } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
          showPlaybackError("媒体解码错误，请重新加载片源");
        } else {
          showPlaybackError("HLS 片源加载失败");
        }
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    };

    let sameOrigin = false;
    try {
      sameOrigin = new URL(url, window.location.href).origin === window.location.origin;
    } catch (_) {
      sameOrigin = false;
    }

    // HLS.js needs CORS. The local /api/proxy path is always same-origin.
    if (sameOrigin && window.Hls?.isSupported?.()) {
      attachHlsJs();
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.load();
      playVideo();
      return;
    }

    if (window.Hls?.isSupported?.()) {
      attachHlsJs();
      return;
    }

    showPlaybackError("当前浏览器不支持 HLS 播放");
  }

  function focusNow(element) {
    if (!element || element.hidden) return false;
    document.querySelectorAll(".is-focused").forEach((node) => node.classList.remove("is-focused"));
    element.focus({ preventScroll: true });
    element.classList.add("is-focused");
    return true;
  }

  function visibleControls() {
    return [closeButton, rewindButton, toggleButton, forwardButton, muteButton, retryButton].filter(
      (button) => !button.hidden
    );
  }

  function moveFocus(direction) {
    if (playerScreen.hidden) return false;
    const active = document.activeElement;
    const controls = visibleControls();
    const bottomControls = controls.filter((control) => control !== closeButton);

    if (active === closeButton) {
      if (direction === "down") return focusNow(toggleButton);
      return true;
    }

    if (bottomControls.includes(active)) {
      if (direction === "left" || direction === "right") {
        const index = bottomControls.indexOf(active);
        const delta = direction === "left" ? -1 : 1;
        const next = bottomControls[(index + delta + bottomControls.length) % bottomControls.length];
        return focusNow(next);
      }
      if (direction === "up") return focusNow(closeButton);
      return true;
    }

    return focusNow(toggleButton);
  }

  function open(media) {
    if (!media?.url) {
      window.NovaToast?.("当前内容没有可用演示片源");
      return;
    }

    if (!playerScreen.hidden) close({ restoreFocus: false });

    currentMedia = media;
    returnFocus = document.activeElement;
    title.textContent = media.title || "NOVA TV";
    meta.textContent = media.meta || "开放演示片源";
    kind.textContent = media.isLive ? "LIVE · 电视直播" : media.kind || "开放演示影片";
    sourceLabel.textContent = media.source || "公开测试流";
    liveIndicator.hidden = !media.isLive;
    timeline.hidden = Boolean(media.isLive);
    rewindButton.hidden = Boolean(media.isLive);
    forwardButton.hidden = Boolean(media.isLive);

    inertState = [document.getElementById("appRoot"), document.getElementById("detailScreen"), document.querySelector(".page-screen:not([hidden])")]
      .filter((element) => element && !element.hidden)
      .map((element) => ({ element, inert: element.inert }));
    inertState.forEach(({ element }) => {
      element.inert = true;
    });

    playerScreen.hidden = false;
    updatePlaybackUI();
    attachSource();
    window.requestAnimationFrame(() => focusNow(toggleButton));
  }

  function close(options = {}) {
    if (playerScreen.hidden) return;
    const target = returnFocus;
    playerScreen.hidden = true;
    video.pause();
    destroyHls();
    video.removeAttribute("src");
    video.load();
    inertState.forEach(({ element, inert }) => {
      element.inert = inert;
    });
    inertState = [];
    currentMedia = null;
    returnFocus = null;
    if (options.restoreFocus !== false && target && document.contains(target)) {
      window.requestAnimationFrame(() => focusNow(target));
    }
  }

  closeButton.addEventListener("click", () => close());
  toggleButton.addEventListener("click", () => {
    if (video.paused || video.ended) {
      playVideo();
    } else {
      video.pause();
    }
  });
  rewindButton.addEventListener("click", () => {
    video.currentTime = Math.max(0, video.currentTime - 10);
    updatePlaybackUI();
  });
  forwardButton.addEventListener("click", () => {
    const duration = Number.isFinite(video.duration) ? video.duration : video.currentTime + 10;
    video.currentTime = Math.min(duration, video.currentTime + 10);
    updatePlaybackUI();
  });
  muteButton.addEventListener("click", () => {
    video.muted = !video.muted;
    updatePlaybackUI();
  });
  retryButton.addEventListener("click", attachSource);

  video.addEventListener("playing", () => {
    hidePanelState();
    updateResolution();
    updatePlaybackUI();
  });
  video.addEventListener("pause", updatePlaybackUI);
  video.addEventListener("ended", updatePlaybackUI);
  video.addEventListener("timeupdate", updatePlaybackUI);
  video.addEventListener("durationchange", updatePlaybackUI);
  video.addEventListener("volumechange", updatePlaybackUI);
  video.addEventListener("loadedmetadata", () => {
    updateResolution();
    updatePlaybackUI();
  });
  video.addEventListener("waiting", () => {
    if (!video.paused) setPanelState("loading", "正在缓冲", "网络恢复后会自动继续");
  });
  video.addEventListener("error", () => {
    if (!currentMedia) return;
    showPlaybackError("视频加载失败，请检查网络后重试");
  });

  window.NovaPlayer = {
    open,
    close,
    isOpen: () => !playerScreen.hidden,
    moveFocus
  };
})();
