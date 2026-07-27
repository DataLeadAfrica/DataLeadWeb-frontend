import {
  TEMPLATES,
  LOGO_SLOTS,
  LOGO_FILES,
  PROGRAMME_LOGOS,
  DEFAULT_PARTNERS,
  type TextBox,
  type Template,
} from "./certificateConfig";
import {
  type Certificate,
  certificateTitle,
  certificateSubtitle,
  prettyDate,
} from "./certificates";

const cache: Record<string, Promise<HTMLImageElement>> = {};

function loadImage(src: string): Promise<HTMLImageElement> {
  if (!cache[src]) {
    cache[src] = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load " + src));
      img.src = src;
    });
  }
  return cache[src];
}

// Which design to use. A weekly tool certificate on the standard Data-Lead
// Africa design gets the TOOL CERTIFIED badge; everything else follows the
// template_key set against the programme in Supabase.
export function pickTemplate(cert: Certificate): Template {
  const key = cert.template_key || "default";
  if ((key === "default" || !TEMPLATES[key]) && cert.is_module) {
    return TEMPLATES.module;
  }
  return TEMPLATES[key] || TEMPLATES.default;
}

// Draw one line, shrinking it if it would run past its allowed width, so a
// long name or a long course title can never overflow the design.
function drawFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  cfg: TextBox,
  W: number,
  H: number,
) {
  let px = cfg.size * H;
  const maxW = cfg.max * W;
  const value = cfg.upper ? text.toUpperCase() : text;
  const setFont = (p: number) => {
    ctx.font = `${cfg.weight || 400} ${p}px ${cfg.font}, sans-serif`;
  };
  setFont(px);
  const measure = (s: string) => {
    let w = ctx.measureText(s).width;
    if (cfg.track) w += cfg.track * px * (s.length - 1);
    return w;
  };
  let guard = 0;
  while (measure(value) > maxW && px > 8 && guard < 300) {
    px -= 1;
    setFont(px);
    guard += 1;
  }
  ctx.fillStyle = cfg.grey ? "#5f5f5f" : "#000000";
  ctx.textBaseline = "alphabetic";

  // "center" means cfg.x is the middle of the line, not its left edge.
  const startX =
    cfg.align === "center" ? cfg.x * W - measure(value) / 2 : cfg.x * W;

  if (!cfg.track) {
    ctx.fillText(value, startX, cfg.baseline * H);
    return;
  }
  let x = startX;
  for (const ch of value) {
    ctx.fillText(ch, x, cfg.baseline * H);
    x += ctx.measureText(ch).width + cfg.track * px;
  }
}

// Partner logos sit right aligned and walk leftwards, so a programme with no
// partners simply shows nothing and leaves no gap.
async function drawLogoRow(
  ctx: CanvasRenderingContext2D,
  names: string[],
  slot: { rightEdge: number; centerY: number; maxH: number; gap: number },
  W: number,
  H: number,
) {
  if (!names || names.length === 0) return;
  let x = slot.rightEdge * W;
  for (const name of [...names].reverse()) {
    const file = LOGO_FILES[name];
    if (!file) continue;
    try {
      const img = await loadImage(file);
      const h = slot.maxH * H;
      const w = img.naturalWidth * (h / img.naturalHeight);
      ctx.drawImage(img, x - w, slot.centerY * H - h / 2, w, h);
      x -= w + slot.gap * W;
    } catch {
      // a missing logo must never stop the certificate rendering
    }
  }
}

export async function renderCertificate(
  canvas: HTMLCanvasElement,
  cert: Certificate,
): Promise<void> {
  const tpl = pickTemplate(cert);
  const plate = await loadImage(tpl.plate);

  // Wait for the web fonts, otherwise the first draw uses a fallback face.
  try {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    // older browsers: carry on
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = plate.naturalWidth;
  canvas.height = plate.naturalHeight;
  const W = canvas.width;
  const H = canvas.height;

  ctx.drawImage(plate, 0, 0, W, H);

  if (tpl.drawPartnerLogos) {
    const partners = PROGRAMME_LOGOS[cert.programme_slug] || DEFAULT_PARTNERS;
    await drawLogoRow(ctx, partners.top, LOGO_SLOTS.top, W, H);
    await drawLogoRow(ctx, partners.bottom, LOGO_SLOTS.bottom, W, H);
  }

  if (tpl.name) drawFit(ctx, cert.full_name, tpl.name, W, H);
  if (tpl.course) drawFit(ctx, certificateTitle(cert), tpl.course, W, H);
  if (tpl.date) {
    drawFit(
      ctx,
      (tpl.datePrefix || "") + prettyDate(cert.completed_on),
      tpl.date,
      W,
      H,
    );
  }
  if (tpl.sub) {
    const sub = certificateSubtitle(cert);
    if (sub) drawFit(ctx, sub, tpl.sub, W, H);
  }

  if (tpl.certNo) {
    const label = `Certificate no. ${cert.certificate_number}`;
    ctx.font = `500 ${tpl.certNo.size * H}px Poppins, sans-serif`;
    ctx.fillStyle = "#6b6b6b";
    const w = ctx.measureText(label).width;
    const x =
      tpl.certNo.align === "center"
        ? tpl.certNo.x * W - w / 2
        : tpl.certNo.x * W;
    ctx.fillText(label, x, tpl.certNo.baseline * H);
  }
}

export function downloadCanvasPng(
  canvas: HTMLCanvasElement,
  certificateNumber: string,
) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Data-Lead-Africa-Certificate-${certificateNumber}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
}

// Opens a print window sized to the certificate, so the browser's own
// "Save as PDF" produces a clean landscape file.
export function printCanvas(
  canvas: HTMLCanvasElement,
  certificateNumber: string,
) {
  const data = canvas.toDataURL("image/jpeg", 0.92);
  const w = window.open("");
  if (!w) return;
  w.document.write(
    `<html><head><title>Data-Lead Africa Certificate ${certificateNumber}</title>` +
      `<style>@page{size:A4 landscape;margin:0}body{margin:0}img{width:100%;display:block}</style>` +
      `</head><body><img src="${data}" onload="window.print()"></body></html>`,
  );
  w.document.close();
}
