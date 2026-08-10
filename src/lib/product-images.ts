import { config, publicBaseUrl } from "../config.js";

const PHOTO_IDS = [
  "1556821840-3a63f95609a7",
  "1620799140408-edc6dcb6d633",
  "1562157873-818bc0726f68",
  "1521572163474-6864f9cf17ab",
  "1583743814966-8936f5b7be1a",
  "1523381210434-271e8be1f52b",
  "1542272604-787c3835535d",
  "1541099649105-f69ad21f3246",
  "1553062407-98eeb64c6a62",
  "1591047139829-d91aecb6caea",
] as const;

export function sandboxProductImageUrl(productIndex: number): string {
  const id = PHOTO_IDS[productIndex % PHOTO_IDS.length];
  return `https://images.unsplash.com/photo-${id}?w=400&h=400&fit=crop`;
}

/** Dev UI can also serve a local placeholder via /_dev/catalog-image. */
export function sandboxLocalImageUrl(retailerId: string): string {
  return `${publicBaseUrl()}/_dev/catalog-image?id=${encodeURIComponent(retailerId)}`;
}

export function catalogImageSvgPlaceholder(label: string, size = 80): string {
  const safe = label.replace(/[<>&"]/g, "").slice(0, 24);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="#e7e5e4"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
    font-family="system-ui,sans-serif" font-size="${Math.max(10, size / 8)}" fill="#57534e">${safe || "item"}</text>
</svg>`;
}

void config;
