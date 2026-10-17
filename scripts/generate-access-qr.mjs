import qrcode from "qrcode-generator";
import { writeFileSync } from "node:fs";

const url = "https://octubre-rosa-aprende.j1andrade2502.chatgpt.site/";
const qr = qrcode(0, "M");
qr.addData(url); qr.make();
writeFileSync(new URL("../public/acceso-qr.svg", import.meta.url), qr.createSvgTag({ cellSize: 6, margin: 24, scalable: true }));
console.log("QR de acceso generado.");
