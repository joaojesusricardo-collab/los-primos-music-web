// Los Primos Music - Web Engine com Responsividade e Abas Nativas
let ytPlayer = null;
let isYtReady = false;
let currentSong = null;
let queue = [];
let currentIndex = -1;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let lyricsData = [];
let progressTimer = null;

// Elementos DOM de Abas
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

// Elementos de Conteúdo
const homeSongList = document.getElementById('homeSongList');
const searchResultsList = document.getElementById('searchResultsList');
const queueList = document.getElementById('queueList');
const queueCount = document.getElementById('queueCount');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');

// MiniPlayer DOM
const miniPlayer = document.getElementById('miniPlayer');
const miniProgressLine = document.getElementById('miniProgressLine');
const miniThumb = document.getElementById('miniThumb');
const miniTitle = document.getElementById('miniTitle');
const miniArtist = document.getElementById('miniArtist');
const miniPlayBtn = document.getElementById('miniPlayBtn');
const miniNextBtn = document.getElementById('miniNextBtn');

// FullPlayer DOM
const fullPlayer = document.getElementById('fullPlayer');
const closeFullPlayerBtn = document.getElementById('closeFullPlayerBtn');
const toggleLyricsBtn = document.getElementById('toggleLyricsBtn');
const normalCoverContainer = document.getElementById('normalCoverContainer');
const lyricsContainer = document.getElementById('lyricsContainer');
const fullCover = document.getElementById('fullCover');
const fullTitle = document.getElementById('fullTitle');
const fullArtist = document.getElementById('fullArtist');
const fullPlayBtn = document.getElementById('fullPlayBtn');
const fullPrevBtn = document.getElementById('fullPrevBtn');
const fullNextBtn = document.getElementById('fullNextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
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
          if (isRepeat) {
            ytPlayer.seekTo(0);
            ytPlayer.playVideo();
          } else {
            playNext();
          }
        }
      }
    }
  });
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupEventListeners();
  loadHomeHighlights();
});

// Navegação por Abas
function setupNavigation() {
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTabId = item.dataset.tab;

      navItems.forEach(nav => nav.classList.remove('active'));
      tabContents.forEach(tab => tab.classList.remove('active'));

      item.classList.add('active');
      const targetTab = document.getElementById(targetTabId);
      if (targetTab) targetTab.classList.add('active');

      if (targetTabId === 'tabSearch') {
        setTimeout(() => searchInput.focus(), 150);
      }
    });
  });
}

function switchTab(tabId) {
  const navItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (navItem) navItem.click();
}

function setupEventListeners() {
  // Busca
  searchInput.addEventListener('input', () => {
    clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performSearch(searchInput.value);
    }
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
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

  // Shuffle & Repeat
  shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
  });
  repeatBtn.addEventListener('click', () => {
    isRepeat = !isRepeat;
    repeatBtn.classList.toggle('active', isRepeat);
  });

  // Slider de Progresso
  progressSlider.addEventListener('input', () => {
    if (ytPlayer && ytPlayer.seekTo) {
      ytPlayer.seekTo(progressSlider.value, true);
    }
  });

  // Alternar Letras
  toggleLyricsBtn.addEventListener('click', () => {
    const isShowing = lyricsContainer.classList.toggle('active');
    toggleLyricsBtn.classList.toggle('active', isShowing);
    normalCoverContainer.style.display = isShowing ? 'none' : 'flex';
  });

  // Service Worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// Carregar Destaques da Home
async function loadHomeHighlights() {
  homeSongList.innerHTML = '<div style="text-align:center; padding: 30px;"><div class="spinner"></div></div>';
  try {
    const res = await fetch('/api/search?q=Top Brasil 2026');
    const songs = await res.json();
    renderSongList(homeSongList, songs);
  } catch (err) {
    homeSongList.innerHTML = '<p style="text-align:center; color:var(--lp-wine);">Erro ao carregar músicas.</p>';
  }
}

// Categoria Rápida
window.quickPlayCategory = async function(categoryName) {
  switchTab('tabSearch');
  searchInput.value = categoryName;
  clearSearchBtn.style.display = 'block';
  await performSearch(categoryName);
};

// Busca de Músicas
async function performSearch(query) {
  if (!query || !query.trim()) return;
  searchResultsList.innerHTML = '<div style="text-align:center; padding: 40px;"><div class="spinner"></div></div>';

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const songs = await res.json();
    renderSongList(searchResultsList, songs);
  } catch (err) {
    searchResultsList.innerHTML = '<p style="text-align:center; color:var(--lp-wine);">Erro ao buscar músicas.</p>';
  }
}

function renderSongList(container, songs) {
  if (!songs || songs.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nenhuma música encontrada.</p></div>';
    return;
  }

  container.innerHTML = songs.map((song, idx) => `
    <div class="song-card ${currentSong && currentSong.id === song.id ? 'active' : ''}" onclick="selectSongFromList(${JSON.stringify(songs).replace(/"/g, '&quot;')}, ${idx})">
      <img class="song-thumb" src="${song.thumbnail || '/assets/los_primos_logo.png'}" alt="" loading="lazy">
      <div class="song-info">
        <div class="song-title">${escapeHtml(song.title)}</div>
        <div class="song-artist">${escapeHtml(song.artists)}</div>
      </div>
      <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24" style="color:var(--lp-gold)">
        <path d="M8 5v14l11-7z"/>
      </svg>
    </div>
  `).join('');
}

// Reprodução a partir de qualquer lista
window.selectSongFromList = function(songs, index) {
  queue = songs;
  currentIndex = index;
  updateQueueUI();
  playCurrentSong();
};

function playCurrentSong() {
  const song = queue[currentIndex];
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
}

function updateQueueUI() {
  queueCount.textContent = queue.length;
  if (!queue.length) {
    queueList.innerHTML = '<div class="empty-state"><p>Nenhuma música na fila.</p></div>';
    return;
  }

  queueList.innerHTML = queue.map((song, idx) => `
    <div class="song-card ${currentIndex === idx ? 'active' : ''}" onclick="selectQueueIndex(${idx})">
      <img class="song-thumb" src="${song.thumbnail || '/assets/los_primos_logo.png'}" alt="" loading="lazy">
      <div class="song-info">
        <div class="song-title">${escapeHtml(song.title)}</div>
        <div class="song-artist">${escapeHtml(song.artists)}</div>
      </div>
      ${currentIndex === idx ? `
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" style="color:var(--lp-gold)">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      ` : ''}
    </div>
  `).join('');
}

window.selectQueueIndex = function(index) {
  currentIndex = index;
  playCurrentSong();
  updateQueueUI();
};

function updateUIForSong(song) {
  miniPlayer.style.display = 'block';
  miniThumb.src = song.thumbnail || '/assets/los_primos_logo.png';
  miniTitle.textContent = song.title;
  miniArtist.textContent = song.artists;

  fullCover.src = song.thumbnail || '/assets/los_primos_logo.png';
  fullTitle.textContent = song.title;
  fullArtist.textContent = song.artists;

  // Atualizar seleção visual em todas as listas abertas
  document.querySelectorAll('.song-card').forEach(card => {
    const titleEl = card.querySelector('.song-title');
    if (titleEl && titleEl.textContent === song.title) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
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
  if (isShuffle && queue.length > 1) {
    currentIndex = Math.floor(Math.random() * queue.length);
  } else if (currentIndex + 1 < queue.length) {
    currentIndex++;
  } else if (queue.length > 0) {
    currentIndex = 0;
  }
  playCurrentSong();
  updateQueueUI();
}

function playPrev() {
  if (ytPlayer && ytPlayer.getCurrentTime && ytPlayer.getCurrentTime() > 3) {
    ytPlayer.seekTo(0, true);
  } else if (currentIndex > 0) {
    currentIndex--;
    playCurrentSong();
    updateQueueUI();
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

      const percent = (cur / dur) * 100;
      miniProgressLine.style.width = `${percent}%`;

      syncLyrics(cur * 1000);
    }
  }, 400);
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
      lyricsContainer.innerHTML = `<div style="white-space: pre-wrap; line-height: 1.8; color: var(--lp-text-primary); padding: 20px;">${escapeHtml(data.plainLyrics)}</div>`;
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
