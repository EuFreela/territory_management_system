import type { MapArea } from '@/components/Map/TerritoryMap';

/** Tamanho de um tile OSM (px). Usamos o padrão 256. */
const TILE = 256;

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Cor do traço/balão das áreas (mesmo ciano das áreas em destaque do mapa). */
const AREA_STROKE = '#0ea5e9';
const AREA_FILLS = ['#bae6fd', '#a5f3fc', '#bae6fd', '#c7d2fe'];
const AREA_LABEL_BG = '#0ea5e9';

/** Projeta lat/lng → coordenada de mundo (px) no zoom z. */
function project(lat: number, lng: number, z: number): [number, number] {
  const n = Math.pow(2, z);
  const latRad = (lat * Math.PI) / 180;
  const x = ((lng + 180) / 360) * n * TILE;
  const y = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n * TILE;
  return [x, y];
}

function loadTile(tx: number, ty: number, z: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      if (img.naturalWidth < 1 || img.naturalHeight < 1) resolve(null);
      else resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = OSM_TILE_URL.replace('{z}', String(z)).replace('{x}', String(tx)).replace('{y}', String(ty));
  });
}

export type MapViewport = {
  /** Centro do trecho a renderizar (lat, lng). */
  center: [number, number];
  /** Zoom (pode ser fracionário) do trecho — reproduz a escala do mapa atual. */
  zoom: number;
};

/** Região retangular selecionada (bounds) no mapa. */
export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type MapCardRenderOptions = {
  /** Largura/saída em px do mapa desenhado. */
  width?: number;
  /** Altura/saída em px do mapa desenhado. */
  height?: number;
  /** Zoom máximo permitido (tiles OSM com nome de rua). Padrão 18. */
  maxZoom?: number;
  /** Se informado, renderiza EXATAMENTE esse trecho (centro+zoom do mapa atual). */
  viewport?: MapViewport;
  /** Se informado, enquadra na região retangular selecionada (usado no print). */
  bounds?: MapBounds;
  /** true = áreas em preto e branco (mesmos cinzas do mapa); false = coloridas. */
  bw?: boolean;
};

/**
 * Encontra o maior zoom (<= maxZoom, >= 10) em que a região cabe na canvas.
 */
function zoomForBounds(b: MapBounds, width: number, height: number, maxZoom: number): number {
  let z = 10;
  for (let t = maxZoom; t >= 10; t--) {
    const [x0, y0] = project(b.north, b.west, t);
    const [x1, y1] = project(b.south, b.east, t);
    if (Math.abs(x1 - x0) <= width && Math.abs(y1 - y0) <= height) {
      z = t;
      break;
    }
  }
  return z;
}

/**
 * Desenha o mapa real (tiles OpenStreetMap — com nomes de rua) numa canvas,
 * com as áreas desenhadas (polígonos 1, 2, 3…) projetadas por cima.
 * Tiles do OSM enviam CORS → exportável como PNG sem taint.
 *
 * - Com `options.bounds`: enquadra na região retangular selecionada.
 * - Com `options.viewport`: reproduz o enquadramento atual do mapa.
 * - Sem nenhum dos dois: enquadra automaticamente nas áreas desenhadas.
 */
export async function renderMapCanvas(
  areas: MapArea[],
  options: MapCardRenderOptions = {},
): Promise<HTMLCanvasElement> {
  const width = options.width ?? 1000;
  const height = options.height ?? 620;
  const maxZoom = options.maxZoom ?? 18;
  // Preto e branco: mesma gradação de cinza usada no mapa (sem ciano)
  const bw = options.bw ?? false;
  const areaStroke = bw ? '#64748b' : AREA_STROKE;
  const areaFills = bw ? ['#cbd5e1', '#aeb8c4', '#cbd5e1', '#b7c1cc'] : AREA_FILLS;
  const areaLabelBg = bw ? '#64748b' : AREA_LABEL_BG;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível');

  ctx.fillStyle = '#eef2f6';
  ctx.fillRect(0, 0, width, height);

  const valid = areas.filter((a) => a.points.length >= 3);

  let z: number;
  let originX: number;
  let originY: number;

  let fitBounds: MapBounds | null = options.bounds ?? null;

  if (!fitBounds && !options.viewport && valid.length === 0) {
    drawEmpty(ctx, width, height);
    return canvas;
  }

  if (options.viewport && !fitBounds) {
    // Reproduz o trecho visível do mapa atual
    const [clat, clng] = options.viewport.center;
    z = clampZoom(options.viewport.zoom);
    const [cx, cy] = project(clat, clng, z);
    originX = cx - width / 2;
    originY = cy - height / 2;
  } else {
    // Calcula os bounds: região selecionada OU enquadramento nas áreas
    if (!fitBounds) {
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;
      for (const [lat, lng] of valid.flatMap((a) => a.points)) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      }
      const latPad = Math.max((maxLat - minLat) * 0.15, 0.0004);
      const lngPad = Math.max((maxLng - minLng) * 0.15, 0.0004);
      fitBounds = {
        north: maxLat + latPad,
        south: minLat - latPad,
        east: maxLng + lngPad,
        west: minLng - lngPad,
      };
    }

    z = zoomForBounds(fitBounds, width, height, maxZoom);
    const centerLat = (fitBounds.north + fitBounds.south) / 2;
    const centerLng = (fitBounds.east + fitBounds.west) / 2;
    const [cx, cy] = project(centerLat, centerLng, z);
    originX = cx - width / 2;
    originY = cy - height / 2;
  }

  // Cobre a canvas com tiles
  const tx0 = Math.floor(originX / TILE);
  const ty0 = Math.floor(originY / TILE);
  const tx1 = Math.floor((originX + width) / TILE);
  const ty1 = Math.floor((originY + height) / TILE);

  const tilePromises: Promise<[number, number, number, number, HTMLImageElement | null]>[] = [];
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      tilePromises.push(
        loadTile(tx, ty, z).then((img) => [tx, ty, tx * TILE - originX, ty * TILE - originY, img]),
      );
    }
  }

  const tiles = await Promise.all(tilePromises);
  for (const [tx, ty, dx, dy, img] of tiles) {
    if (img) {
      ctx.drawImage(img, dx, dy, TILE, TILE);
    } else {
      ctx.fillStyle = '#e8eef4';
      ctx.fillRect(dx, dy, TILE, TILE);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(dx + 0.5, dy + 0.5, TILE - 1, TILE - 1);
      ctx.setLineDash([]);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`z${z}/${tx}/${ty}`, dx + TILE / 2, dy + TILE / 2);
    }
  }

  // Desenha os polígonos das áreas com a projeção correta
  const toPx = (lat: number, lng: number): [number, number] => {
    const [wx, wy] = project(lat, lng, z);
    return [wx - originX, wy - originY];
  };

  valid.forEach((area, index) => {
    const pts = area.points.map(([lat, lng]) => toPx(lat, lng));
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = `${areaFills[index % areaFills.length]}`;
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = areaStroke;
    ctx.lineWidth = 3;
    ctx.stroke();

    const cxArea = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cyArea = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const label = (area.label || '').trim() || String(index + 1);
    ctx.beginPath();
    ctx.arc(cxArea, cyArea, 16, 0, Math.PI * 2);
    ctx.fillStyle = areaLabelBg;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cxArea, cyArea + 0.5);
  });

  return canvas;
}

function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 15;
  return Math.min(18, Math.max(10, Math.round(z)));
}

function drawEmpty(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(20, 20, width - 40, height - 40);
  ctx.setLineDash([]);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Nenhuma área desenhada neste território', width / 2, height / 2);
}
