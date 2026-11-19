const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Constantes InnerTube
const API_URL = 'https://music.youtube.com/youtubei/v1/';
const API_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30';
const USER_AGENT_WEB = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const USER_AGENT_VISIONOS = 'com.google.visionos.youtube/1.04(RealityDevice17,1; U; CPU visionOS 26_6_0 like Mac OS X; US)';

// Endpoint de Busca no YouTube Music
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query parameter q is required' });

    const response = await fetch(`${API_URL}search?key=${API_KEY}&prettyPrint=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://music.youtube.com',
        'Referer': 'https://music.youtube.com/',
        'User-Agent': USER_AGENT_WEB,
        'X-YouTube-Client-Name': '67',
        'X-YouTube-Client-Version': '1.20261115.14.00'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20261115.14.00',
            gl: 'BR',
            hl: 'pt-BR'
          }
        },
        query: query,
        params: 'Eg-KAQwIARAAGAAgACgAMABqChAEEAMQCRAFEAo%3D'
      })
    });

    const data = await response.json();
    const songs = parseSearchSongs(data);
    res.json(songs);
  } catch (err) {
    console.error('Erro na busca:', err);
    res.status(500).json({ error: 'Falha ao buscar músicas' });
  }
});

// Endpoint de Stream URL (VISIONOS Client)
app.get('/api/stream/:videoId', async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const response = await fetch(`${API_URL}player?key=${API_KEY}&prettyPrint=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://music.youtube.com',
        'Referer': 'https://music.youtube.com/',
        'User-Agent': USER_AGENT_VISIONOS,
        'X-YouTube-Client-Name': '101',
        'X-YouTube-Client-Version': '1.04'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'VISIONOS',
            clientVersion: '1.04',
            osVersion: '26.6.0.23O770',
            gl: 'BR',
            hl: 'pt-BR'
          }
        },
        videoId: videoId
      })
    });

    const data = await response.json();
    const formats = data?.streamingData?.adaptiveFormats || [];
    
    // Filtrar formatos de áudio
    const audioFormats = formats.filter(f => f.mimeType?.startsWith('audio/') && f.url);

    if (audioFormats.length === 0) {
      return res.status(404).json({ error: 'Nenhum stream de áudio disponível' });
    }

    // Priorizar maior taxa de bits (bitrate)
    audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const bestFormat = audioFormats[0];

    // Se o cliente pedir redirect direto para o stream
    if (req.query.redirect === 'true') {
      return res.redirect(bestFormat.url);
    }

    res.json({
      url: bestFormat.url,
      mimeType: bestFormat.mimeType,
      bitrate: bestFormat.bitrate,
      durationMs: data?.videoDetails?.lengthSeconds ? parseInt(data.videoDetails.lengthSeconds) * 1000 : null
    });
  } catch (err) {
    console.error('Erro ao obter stream:', err);
    res.status(500).json({ error: 'Falha ao obter URL de áudio' });
  }
});

// Endpoint de Proxy de Áudio para o iOS Safari (evita problemas de Range e CORS)
app.get('/api/play/:videoId', async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const playerRes = await fetch(`${API_URL}player?key=${API_KEY}&prettyPrint=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://music.youtube.com',
        'Referer': 'https://music.youtube.com/',
        'User-Agent': USER_AGENT_VISIONOS,
        'X-YouTube-Client-Name': '101',
        'X-YouTube-Client-Version': '1.04'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'VISIONOS',
            clientVersion: '1.04',
            osVersion: '26.6.0.23O770',
            gl: 'BR',
            hl: 'pt-BR'
          }
        },
        videoId: videoId
      })
    });

    const data = await playerRes.json();
    const formats = (data?.streamingData?.adaptiveFormats || []).filter(f => f.mimeType?.startsWith('audio/') && f.url);
    if (!formats.length) return res.status(404).send('Áudio não encontrado');

    formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const streamUrl = formats[0].url;

    // Redireciona o navegador diretamente para a URL assinada da CDN do YouTube
    res.redirect(302, streamUrl);
  } catch (err) {
    console.error('Erro no stream proxy:', err);
    res.status(500).send('Erro interno');
  }
});

// Endpoint de Letras Sincronizadas (LRCLIB)
app.get('/api/lyrics', async (req, res) => {
  try {
    const { title, artist, duration } = req.query;
    if (!title || !artist) return res.status(400).json({ error: 'Title and artist are required' });

    let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    if (duration) url += `&duration=${duration}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'LosPrimosMusic-Web/1.0' }
    });

    if (!response.ok) return res.json({ found: false });

    const data = await response.json();
    res.json({
      found: true,
      syncedLyrics: data.syncedLyrics || null,
      plainLyrics: data.plainLyrics || null
    });
  } catch (err) {
    res.json({ found: false });
  }
});

// Helper de parsing do YouTube
function parseSearchSongs(json) {
  try {
    const sections = json?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    const songs = [];

    for (const section of sections) {
      const items = section?.musicShelfRenderer?.contents || [];
      for (const item of items) {
        const renderer = item.musicResponsiveListItemRenderer;
        if (!renderer) continue;

        const playButton = renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer;
        const videoId = playButton?.playNavigationEndpoint?.watchEndpoint?.videoId;
        if (!videoId) continue;

        const flexColumns = renderer.flexColumns || [];
        const titleRun = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0];
        const title = titleRun?.text || 'Música';

        const artistRuns = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const artists = [];
        let album = null;

        for (const run of artistRuns) {
          const text = run.text;
          if (text === ' • ' || !text.trim()) continue;
          const browseId = run.navigationEndpoint?.browseEndpoint?.browseId;
          if (browseId?.startsWith('UC')) {
            artists.push(text);
          } else if (browseId?.startsWith('MPRE') || browseId?.startsWith('FEx')) {
            album = text;
          } else if (artists.length === 0) {
            artists.push(text);
          }
        }

        const thumbnails = renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
        const thumbUrl = thumbnails[thumbnails.length - 1]?.url || null;

        songs.push({
          id: videoId,
          title,
          artists: artists.join(', ') || 'Vários Artistas',
          album: album || 'Single',
          thumbnail: thumbUrl
        });
      }
    }
    return songs;
  } catch (err) {
    return [];
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Los Primos Music Web rodando em:`);
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Na Rede: http://0.0.0.0:${PORT} (acesse pelo iPhone no mesmo Wi-Fi)`);
});
