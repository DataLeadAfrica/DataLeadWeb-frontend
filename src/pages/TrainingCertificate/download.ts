// Turns the drawn certificate into real files on the phone.
//
// The existing claim page makes its PDF through the browser's print dialog.
// That is fine on a laptop but awkward on a phone, so this page writes a
// genuine one page PDF instead: the certificate image placed on an A4
// landscape page, which is the same shape as the artwork. No library needed.

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Some phone browsers start the download a moment after the click, so the
  // address is kept alive for a while before it is released.
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not export the certificate"))),
      type,
      quality,
    );
  });
}

export async function downloadPng(canvas: HTMLCanvasElement, fileBase: string) {
  saveBlob(await canvasBlob(canvas, "image/png"), `${fileBase}.png`);
}

function pdfText(s: string): string {
  // Plain ASCII only inside the PDF information box, with ( ) and \ escaped.
  return s
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/([\\()])/g, "\\$1");
}

export async function makePdf(canvas: HTMLCanvasElement, title: string): Promise<Blob> {
  const jpeg = new Uint8Array(await (await canvasBlob(canvas, "image/jpeg", 0.95)).arrayBuffer());
  const W = 842; // A4 landscape in points
  const H = 595;
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === "string" ? enc.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const obj = (n: number) => {
    offsets[n] = length;
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1);
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  obj(2);
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  obj(3);
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
      "/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
  );
  obj(4);
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push("\nendstream\nendobj\n");
  const draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  obj(5);
  push(`5 0 obj\n<< /Length ${draw.length} >>\nstream\n${draw}\nendstream\nendobj\n`);
  obj(6);
  push(`6 0 obj\n<< /Title (${pdfText(title)}) /Author (Data-Lead Africa) /Producer (Data-Lead Africa) >>\nendobj\n`);

  const xref = length;
  let table = "xref\n0 7\n0000000000 65535 f \n";
  for (let n = 1; n <= 6; n++) table += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
  push(table);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

export async function downloadPdf(canvas: HTMLCanvasElement, fileBase: string, title: string) {
  saveBlob(await makePdf(canvas, title), `${fileBase}.pdf`);
}
