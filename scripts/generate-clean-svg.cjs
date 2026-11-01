const fs = require('fs');

async function run() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync('public/forestry-plan.pdf')) }).promise;
  const page = await doc.getPage(1);
  const ops = await page.getOperatorList();

  const dParts = [];
  let pathCount = 0;
  let ocg = 'none';

  // Stray contour ops in 7R that are not part of the loteo / manzanas / streets
  const strayOps = new Set([
    // Op 16 is 6R, Op 22750 is 8R (handled by ocg === '7R' filter)
    // In 7R, topographic contour / creek paths:
    3621, 3624, 3627, 3630,
    4101, 4104, 4107, 4110, 4113, 4116, 4119, 4122, 4125, 4128, 4131, 4134, 4137, 4140
  ]);

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    if (fn === pdfjs.OPS.beginMarkedContentProps) {
      if (ops.argsArray[i] && ops.argsArray[i][1] && ops.argsArray[i][1].id) {
        ocg = ops.argsArray[i][1].id;
      }
    } else if (fn === pdfjs.OPS.constructPath) {
      // ONLY include 7R (the subdivision / loteo "nuevo"), excluding non-7R (6R LIMITES, 8R CMS_Limite_Urbanizable)
      // and excluding stray contour ops
      if (ocg !== '7R') continue;
      if (strayOps.has(i)) continue;

      const arr = ops.argsArray[i][1][0];
      let j = 0;
      while (j < arr.length) {
        const cmd = arr[j++];
        if (cmd === 0) { // moveTo
          const x = arr[j++].toFixed(2);
          const y = (600 - arr[j++]).toFixed(2);
          dParts.push(`M${x} ${y}`);
          pathCount++;
        } else if (cmd === 1) { // lineTo
          const x = arr[j++].toFixed(2);
          const y = (600 - arr[j++]).toFixed(2);
          dParts.push(`L${x} ${y}`);
        } else if (cmd === 2) { // curveTo
          const x1 = arr[j++].toFixed(2);
          const y1 = (600 - arr[j++]).toFixed(2);
          const x2 = arr[j++].toFixed(2);
          const y2 = (600 - arr[j++]).toFixed(2);
          const x3 = arr[j++].toFixed(2);
          const y3 = (600 - arr[j++]).toFixed(2);
          dParts.push(`C${x1} ${y1} ${x2} ${y2} ${x3} ${y3}`);
        }
      }
    }
  }

  const pathData = dParts.join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%" style="background:#ffffff;">
  <rect width="800" height="600" fill="#ffffff"/>
  <path d="${pathData}" fill="none" stroke="#111111" stroke-width="0.6" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

  fs.writeFileSync('public/forestry-plan.svg', svg, 'utf8');
  console.log(`Saved clean public/forestry-plan.svg: ${svg.length} bytes, ${pathCount} subpaths.`);
}

run().catch(console.error);
