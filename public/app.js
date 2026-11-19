// Los Primos Music - Web Engine com YouTube Audio Integrado
let ytPlayer = null;
let isYtReady = false;
let currentSong = null;
let queue = [];
let currentIndex = -1;
let isPlaying = false;
let lyricsData = [];
let progressTimer = null;

// Elementos DOM
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const quickCategories = document.getElementById('quickCategories');
const miniPlayer = document.getElementById('miniPlayer');
const fullPlayer = document.getElementById('fullPlayer');
const closeFullPlayerBtn = document.getElementById('closeFullPlayerBtn');
const toggleLyricsBtn = document.getElementById('toggleLyricsBtn');
const normalCoverContainer = document.getElementById('normalCoverContainer');
const lyricsContainer = document.getElementById('lyricsContainer');

// MiniPlayer DOM
const miniThumb = document.getElementById('miniThumb');
const miniTitle = document.getElementById('miniTitle');
const miniArtist = document.getElementById('miniArtist');
const miniPlayBtn = document.getElementById('miniPlayBtn');
const miniNextBtn = document.getElementById('miniNextBtn');

// FullPlayer DOM
const fullCover = document.getElementById('fullCover');
const fullTitle = document.getElementById('fullTitle');
const fullArtist = document.getElementById('fullArtist');
const fullPlayBtn = document.getElementById('fullPlayBtn');
const fullPrevBtn = document.getElementById('fullPrevBtn');
const fullNextBtn = document.getElementById('fullNextBtn');
const progressSlider = document.getElementById('progressSlider');
const currentTimeLabel = document.getElementById('currentTimeLabel');
const totalTimeLabel = document.getElementById('totalTimeLabel');

// Callback oficial do YouTube IFrame API
window.onYouTubeIframeAPIReady = function() {
  ytPlayer = new YT.Player('ytPlayer', {
    height: '200',
    width: '200',
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      playsinline: 1,
      origin: window.location.origin
    },
    events: {
      onReady: () => {
        isYtReady = true;
      },
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.PLAYING) {
          setPlayingState(true);
          startProgressTracking();
        } else if (event.data === YT.PlayerState.PAUSED) {
          setPlayingState(false);
          stopProgressTracking();
        } else if (event.data === YT.PlayerState.ENDED) {
          setPlayingState(false);
          stopProgressTracking();
          playNext();
        }
      }
    }
  });
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadTrending('Top Brasil 2026');
});

function setupEventListeners() {
  // Busca
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performSearch(searchInput.value);
    }
  });

  // Categorias Rápidas
  quickCategories.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) {
      const q = chip.dataset.query;
      searchInput.value = q;
      performSearch(q);
    }
  });

  // MiniPlayer
  miniPlayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
  });
  miniNextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    playNext();
  });
  miniPlayer.addEventListener('click', () => {
    fullPlayer.classList.add('open');
  });

  // FullPlayer
  closeFullPlayerBtn.addEventListener('click', () => {
    fullPlayer.classList.remove('open');
  });
  fullPlayBtn.addEventListener('click', togglePlay);
  fullPrevBtn.addEventListener('click', playPrev);
  fullNextBtn.addEventListener('click', playNext);

  // Slider de Progresso
  progressSlider.addEventListener('input', () => {
    if (ytPlayer && ytPlayer.seekTo) {
      ytPlayer.seekTo(progressSlider.value, true);
    }
  });

  // Alternar Letras
  toggleLyricsBtn.addEventListener('click', () => {
    const isShowing = lyricsContainer.classList.toggle('active');
    normalCoverContainer.style.display = isShowing ? 'none' : 'flex';
  });

  // Service Worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// Busca de Músicas
async function performSearch(query) {
  if (!query || !query.trim()) return;
  searchResults.innerHTML = '<div style="text-align:center; padding: 40px;"><div class="spinner"></div></div>';

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const songs = await res.json();
    renderSongs(songs);
  } catch (err) {
    searchResults.innerHTML = '<p style="text-align:center; color:var(--lp-wine);">Erro ao buscar músicas.</p>';
  }
}

async function loadTrending(query) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const songs = await res.json();
    renderSongs(songs);
  } catch (err) {}
}

function renderSongs(songs) {
  if (!songs || songs.length === 0) {
    searchResults.innerHTML = '<p style="text-align:center; color:var(--lp-text-secondary); padding:20px;">Nenhuma música encontrada.</p>';
    return;
  }

  queue = songs;
  searchResults.innerHTML = songs.map((song, idx) => `
    <div class="song-card ${currentSong && currentSong.id === song.id ? 'active' : ''}" onclick="selectSong(${idx})">
      <img class="song-thumb" src="${song.thumbnail || '/assets/los_primos_logo.png'}" alt="" loading="lazy">
      <div class="song-info">
        <div class="song-title">${escapeHtml(song.title)}</div>
        <div class="song-artist">${escapeHtml(song.artists)}</div>
      </div>
      <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" style="color:var(--lp-gold)">
        <path d="M8 5v14l11-7z"/>
      </svg>
    </div>
  `).join('');
}

// Reprodução Principal
window.selectSong = async function(index) {
  currentIndex = index;
  const song = queue[index];
  if (!song) return;

  currentSong = song;
  updateUIForSong(song);

  if (ytPlayer && ytPlayer.loadVideoById) {
    ytPlayer.loadVideoById({
      videoId: song.id,
      startSeconds: 0
    });
    ytPlayer.playVideo();
  }

  setupMediaSession(song);
  loadLyrics(song);
};

function updateUIForSong(song) {
  miniPlayer.style.display = 'flex';
  miniThumb.src = song.thumbnail || '/assets/los_primos_logo.png';
  miniTitle.textContent = song.title;
  miniArtist.textContent = song.artists;

  fullCover.src = song.thumbnail || '/assets/los_primos_logo.png';
  fullTitle.textContent = song.title;
  fullArtist.textContent = song.artists;

  document.querySelectorAll('.song-card').forEach((card, idx) => {
    card.classList.toggle('active', idx === currentIndex);
  });
}

function togglePlay() {
  if (!currentSong || !ytPlayer) return;
  const state = ytPlayer.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    ytPlayer.pauseVideo();
  } else {
    ytPlayer.playVideo();
  }
}

function playNext() {
  if (currentIndex + 1 < queue.length) {
    selectSong(currentIndex + 1);
  } else if (queue.length > 0) {
    selectSong(0);
  }
}

function playPrev() {
  if (ytPlayer && ytPlayer.getCurrentTime && ytPlayer.getCurrentTime() > 3) {
    ytPlayer.seekTo(0, true);
  } else if (currentIndex > 0) {
    selectSong(currentIndex - 1);
  }
}

function setPlayingState(playing) {
  isPlaying = playing;
  const playIcon = `<path d="M8 5v14l11-7z"/>`;
  const pauseIcon = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;

  miniPlayBtn.querySelector('svg').innerHTML = playing ? pauseIcon : playIcon;
  fullPlayBtn.querySelector('svg').innerHTML = playing ? pauseIcon : playIcon;

  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }
}

function startProgressTracking() {
  stopProgressTracking();
  progressTimer = setInterval(() => {
    if (!ytPlayer || !ytPlayer.getCurrentTime || !ytPlayer.getDuration) return;
    const cur = ytPlayer.getCurrentTime();
    const dur = ytPlayer.getDuration();

    if (dur && !isNaN(dur) && dur > 0) {
      progressSlider.max = dur;
      progressSlider.value = cur;
      currentTimeLabel.textContent = formatTime(cur);
      totalTimeLabel.textContent = formatTime(dur);

      syncLyrics(cur * 1000);
    }
  }, 500);
}

function stopProgressTracking() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

// Letras Sincronizadas (LRCLIB)
async function loadLyrics(song) {
  lyricsData = [];
  lyricsContainer.innerHTML = '<div style="padding:40px;"><div class="spinner"></div></div>';

  try {
    const res = await fetch(`/api/lyrics?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artists)}`);
    const data = await res.json();

    if (data.found && data.syncedLyrics) {
      lyricsData = parseLRC(data.syncedLyrics);
      renderLyrics(lyricsData);
    } else if (data.found && data.plainLyrics) {
      lyricsContainer.innerHTML = `<div style="white-space: pre-wrap; line-height: 1.8; color: var(--lp-text-primary);">${escapeHtml(data.plainLyrics)}</div>`;
    } else {
      lyricsContainer.innerHTML = '<p style="color:var(--lp-text-secondary); padding:40px;">Letra indisponível para esta música.</p>';
    }
  } catch (err) {
    lyricsContainer.innerHTML = '<p style="color:var(--lp-text-secondary); padding:40px;">Não foi possível carregar as letras.</p>';
  }
}

function parseLRC(lrcText) {
  const lines = lrcText.split('\n');
  const result = [];

  for (const line of lines) {
    const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (match) {
      const min = parseFloat(match[1]);
      const sec = parseFloat(match[2]);
      const text = match[3].trim();
      const timeMs = (min * 60 + sec) * 1000;
      result.push({ timeMs, text });
    }
  }
  return result.sort((a, b) => a.timeMs - b.timeMs);
}

function renderLyrics(lyrics) {
  lyricsContainer.innerHTML = lyrics.map((line, idx) => `
    <div class="lyric-line" id="lyric-${idx}">${escapeHtml(line.text)}</div>
  `).join('');
}

function syncLyrics(currentMs) {
  if (!lyricsData.length) return;

  let activeIdx = -1;
  for (let i = 0; i < lyricsData.length; i++) {
    if (lyricsData[i].timeMs <= currentMs) {
      activeIdx = i;
    } else {
      break;
    }
  }

  document.querySelectorAll('.lyric-line').forEach((el, idx) => {
    const isCurrent = idx === activeIdx;
    el.classList.toggle('highlight', isCurrent);
    if (isCurrent && el.offsetParent !== null) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

// MediaSession (Lock Screen do iOS)
function setupMediaSession(song) {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title,
    artist: song.artists,
    album: song.album || 'Los Primos Music',
    artwork: [
      { src: song.thumbnail || '/assets/los_primos_logo.png', sizes: '512x512', type: 'image/png' }
    ]
  });

  navigator.mediaSession.setActionHandler('play', () => ytPlayer && ytPlayer.playVideo && ytPlayer.playVideo());
  navigator.mediaSession.setActionHandler('pause', () => ytPlayer && ytPlayer.pauseVideo && ytPlayer.pauseVideo());
  navigator.mediaSession.setActionHandler('previoustrack', playPrev);
  navigator.mediaSession.setActionHandler('nexttrack', playNext);
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds === Infinity) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
