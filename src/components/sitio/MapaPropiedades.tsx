"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { rutaPropiedad, type Propiedad } from "@/lib/propiedades";

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Mapa con un pin de precio por propiedad. Las coordenadas son aproximadas (zona), no la dirección exacta. */
export default function MapaPropiedades({ propiedades }: { propiedades: Propiedad[] }) {
  const cont = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cont.current;
    if (!el) return;
    const mapa = L.map(el, { scrollWheelZoom: false }).setView([-33.08, -68.47], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);

    const puntos: L.LatLngExpression[] = [];
    for (const p of propiedades) {
      if (!p.coords) continue;
      const pos: L.LatLngExpression = [p.coords.lat, p.coords.lng];
      puntos.push(pos);
      const icono = L.divIcon({
        className: "",
        html: `<span style="display:inline-block;transform:translate(-50%,-100%);background:#16201B;color:#D9BC85;font:700 12px system-ui,sans-serif;padding:5px 10px;border-radius:999px;border:2px solid #D9BC85;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35)">${esc(p.precio)}</span>`,
        iconSize: [0, 0],
      });
      const foto = p.foto ? `<img src="${esc(p.foto)}" alt="" style="width:100%;height:96px;object-fit:cover;border-radius:8px;margin-bottom:6px"/>` : "";
      L.marker(pos, { icon: icono, title: p.titulo })
        .addTo(mapa)
        .bindPopup(`<div style="width:190px">${foto}<strong style="display:block;font-size:13px;line-height:1.25">${esc(p.titulo)}</strong><span style="font-size:12px;color:#676B63">${esc(p.ubicacion)}</span><br/><a href="${rutaPropiedad(p.codigo)}" style="display:inline-block;margin-top:6px;font-size:12px;font-weight:700;color:#8A6529">Ver propiedad →</a></div>`);
    }
    if (puntos.length > 1) mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 14 });
    else if (puntos.length === 1) mapa.setView(puntos[0], 13);

    return () => { mapa.remove(); };
  }, [propiedades]);

  return <div ref={cont} role="region" aria-label="Mapa de propiedades" className="h-[520px] lg:h-[640px] w-full rounded-[20px] overflow-hidden border border-border-light z-0" />;
}
