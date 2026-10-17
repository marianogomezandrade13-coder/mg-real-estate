/**
 * Reduce una foto antes de subirla (solo en el navegador): las fotos del celular pesan 5–12 MB y harían lento el sitio.
 * Devuelve un JPEG de hasta `max` px de lado mayor (normalmente < 400 KB).
 *
 * `resizeWidth` en createImageBitmap hace que el navegador decodifique la foto YA reducida (los formatos
 * JPEG lo permiten de forma nativa, muy liviana en memoria) en vez de decodificar la foto original entera
 * (una foto de celular moderna son 12-48 megapíxeles) y recién ahí achicarla con el canvas. Sin esto, subir
 * varias fotos seguidas de un celular puede agotar la memoria del navegador y hacer que la página se recargue sola.
 */
export async function comprimirImagen(file: File, max = 1800, calidad = 0.85): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image", resizeWidth: max, resizeQuality: "medium" });
  } catch {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); // formato sin soporte de resize al decodificar
  }
  const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala), h = Math.round(bmp.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // fondo blanco para PNG con transparencia
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", calidad));
  canvas.width = 0; canvas.height = 0; // libera el buffer del canvas de inmediato en vez de esperar al recolector de basura
  if (!blob) throw new Error("No se pudo comprimir la imagen");
  return blob;
}
