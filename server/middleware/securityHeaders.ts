import type { NextFunction, Request, Response } from 'express';

/**
 * Headers de segurança HTTP (#002 do relatório de segurança).
 * CSP mínima: self + HTTPS para mídia (tiles/estilos de mapa, imagens de cartão),
 * mantendo Google Maps e OSM Shortbread funcionais.
 */

const APP_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://maps.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  // Mapa vector (Shortbread), tiles raster, rota OSRM e Google Maps
  "connect-src 'self' https://vector.openstreetmap.org https://tiles.versatiles.org https://tile.openstreetmap.org https://router.project-osrm.org https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com",
  "worker-src 'self' blob:",
  "frame-src https://accounts.google.com",
].join('; ');

function isSecureRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  return typeof proto === 'string' && proto.split(',')[0]!.trim() === 'https';
}

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permite geolocation (GPS do mapa de presença); bloqueia câmera/mic/outros.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), usb=(), autoplay=(), payment=()');
  if (isSecureRequest(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('Content-Security-Policy', APP_CSP);
  next();
}