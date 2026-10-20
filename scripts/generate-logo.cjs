const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

function buildLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <!-- Luxury Squircle Clip -->
    <clipPath id="squircle-clip">
      <rect x="24" y="24" width="976" height="976" rx="220" />
    </clipPath>

    <!-- Electric Cyan Optic & Circuit Vectors -->
    <linearGradient id="cyan-glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="40%" stop-color="#00f5ff"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>

    <!-- Forge Amber Accent Gradient -->
    <linearGradient id="forge-amber" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="60%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>

    <!-- Eye Gradients -->
    <linearGradient id="eye-glow-r" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#00f5ff"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>

    <linearGradient id="eye-glow-l" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#00f5ff"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>

    <!-- Volumetric Obsidian & Slate Lighting Gradients -->
    <linearGradient id="g-bright" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>

    <linearGradient id="g-lit" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>

    <linearGradient id="g-mid-lit" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>

    <linearGradient id="g-mid" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>

    <linearGradient id="g-shadow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>

    <linearGradient id="g-dark" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#060913"/>
    </linearGradient>

    <filter id="subtle-shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="#000000" flood-opacity="0.16" />
    </filter>
  </defs>

  <!-- Luxury White Squircle Container -->
  <rect x="24" y="24" width="976" height="976" rx="220" fill="#ffffff" stroke="#e2e8f0" stroke-width="6" />

  <g clip-path="url(#squircle-clip)">
    <g transform="translate(512, 512)" filter="url(#subtle-shadow)">

      <!-- Hexagonal Architectural Gateway Frame -->
      <polygon points="
        0,-390
        338,-195
        338,195
        0,390
        -338,195
        -338,-195
      " fill="none" stroke="#0f172a" stroke-width="36" stroke-linejoin="round" />

      <!-- Inner Telemetry Dashed Hexagon -->
      <polygon points="
        0,-355
        307,-177
        307,177
        0,355
        -307,177
        -307,-177
      " fill="none" stroke="#00f5ff" stroke-width="4" opacity="0.45" stroke-dasharray="16, 12" />

      <!-- 100% Watertight Solid Base Silhouette (Zero-Leak Base) -->
      <path d="
        M 0,-215
        L 65,-215 L 125,-185 L 175,-345 L 210,-285 L 225,-140 L 255,-20 L 275,75 L 250,150 L 180,215 L 140,245 L 90,305 L 0,355
        L -90,305 L -140,245 L -180,215 L -250,150 L -275,75 L -255,-20 L -225,-140 L -210,-285 L -175,-345 L -125,-185 L -65,-215
        Z
      " fill="#080c14" />

      <!-- ==================== THE FORGE LYNX MASCOT ==================== -->

      <!-- EARS: Right Ear (Light / Lit side) -->
      <!-- Ear Backing & Base -->
      <polygon points="65,-215 125,-185 225,-140 150,-130" fill="url(#g-shadow)" />
      <!-- Outer Ear Flange -->
      <polygon points="125,-185 195,-280 225,-140" fill="url(#g-mid-lit)" />
      <!-- High Tuft Apex (Flag Pennant Metaphor) -->
      <polygon points="125,-185 175,-345 195,-280" fill="#060913" />
      <polygon points="175,-345 195,-280 160,-270" fill="url(#forge-amber)" opacity="0.9" />
      <!-- Inner Ear Cavity (Electric Cyan Telemetry Sensor) -->
      <polygon points="120,-175 160,-270 145,-135" fill="url(#cyan-glow)" opacity="0.9" />
      <polygon points="120,-175 145,-135 95,-145" fill="url(#g-lit)" />

      <!-- EARS: Left Ear (Shadow side) -->
      <!-- Ear Backing & Base -->
      <polygon points="-65,-215 -125,-185 -225,-140 -150,-130" fill="url(#g-dark)" />
      <!-- Outer Ear Flange -->
      <polygon points="-125,-185 -195,-280 -225,-140" fill="url(#g-shadow)" />
      <!-- High Tuft Apex (Left) -->
      <polygon points="-125,-185 -175,-345 -195,-280" fill="#04060a" />
      <polygon points="-175,-345 -195,-280 -160,-270" fill="url(#forge-amber)" opacity="0.8" />
      <!-- Inner Ear Cavity (Left) -->
      <polygon points="-120,-175 -160,-270 -145,-135" fill="url(#cyan-glow)" opacity="0.85" />
      <polygon points="-120,-175 -145,-135 -95,-145" fill="url(#g-shadow)" />

      <!-- FOREHEAD & CROWN: Central Gating Vectors -->
      <polygon points="0,-215 65,-215 50,-155 0,-165" fill="url(#g-lit)" />
      <polygon points="0,-215 -65,-215 -50,-155 0,-165" fill="url(#g-shadow)" />
      <polygon points="65,-215 125,-185 95,-145 50,-155" fill="url(#g-bright)" />
      <polygon points="-65,-215 -125,-185 -95,-145 -50,-155" fill="url(#g-dark)" />

      <!-- Central Toggle Diamond Crest (The Gate Metaphor) -->
      <polygon points="0,-165 32,-120 0,-75 -32,-120" fill="url(#cyan-glow)" />
      <polygon points="0,-150 20,-120 0,-90 -20,-120" fill="#ffffff" opacity="0.85" />

      <!-- Mid Forehead Planes -->
      <polygon points="32,-120 95,-145 85,-80 0,-75" fill="url(#g-lit)" />
      <polygon points="-32,-120 -95,-145 -85,-80 0,-75" fill="url(#g-shadow)" />
      <polygon points="95,-145 150,-130 145,-75 85,-80" fill="url(#g-mid-lit)" />
      <polygon points="-95,-145 -150,-130 -145,-75 -85,-80" fill="url(#g-dark)" />

      <!-- BROWS & EYE SOCKETS -->
      <!-- Right Eyebrow Ridge (Firm, alert, predatory) -->
      <polygon points="0,-75 85,-80 115,-48 38,-38" fill="url(#g-bright)" />
      <polygon points="85,-80 145,-75 160,-25 115,-48" fill="url(#g-lit)" />
      <!-- Left Eyebrow Ridge (Shadow side) -->
      <polygon points="0,-75 -85,-80 -115,-48 -38,-38" fill="url(#g-mid)" />
      <polygon points="-85,-80 -145,-75 -160,-25 -115,-48" fill="url(#g-dark)" />

      <!-- EYES: Sharp geometric almond shapes with predatory cant -->
      <!-- Right Eye Socket Dark Frame -->
      <polygon points="38,-38 115,-48 122,-32 46,-22" fill="#040711" />
      <!-- Right Eye Glowing Iris -->
      <polygon points="45,-33 112,-44 116,-34 50,-24" fill="url(#eye-glow-r)" />
      <!-- Right Vertical Slit Pupil -->
      <polygon points="76,-42 82,-41 80,-27 74,-28" fill="#020817" />
      <!-- Right Eye Specular Spark -->
      <polygon points="71,-37 77,-39 75,-33 69,-32" fill="#ffffff" opacity="0.9" />

      <!-- Left Eye Socket Dark Frame -->
      <polygon points="-38,-38 -115,-48 -122,-32 -46,-22" fill="#040711" />
      <!-- Left Eye Glowing Iris -->
      <polygon points="-45,-33 -112,-44 -116,-34 -50,-24" fill="url(#eye-glow-l)" />
      <!-- Left Vertical Slit Pupil -->
      <polygon points="-76,-42 -82,-41 -80,-27 -74,-28" fill="#020817" />
      <!-- Left Eye Specular Spark -->
      <polygon points="-71,-37 -77,-39 -75,-33 -69,-32" fill="#ffffff" opacity="0.9" />

      <!-- NOSE BRIDGE (Sleek low-poly wedge) -->
      <polygon points="0,-75 38,-38 25,25 0,30" fill="url(#g-lit)" />
      <polygon points="0,-75 -38,-38 -25,25 0,30" fill="url(#g-shadow)" />

      <!-- LYNX ZYGOMATIC CHEEK RUFFS (Signature Lateral Spread) -->
      <!-- Right Upper Cheek Facets -->
      <polygon points="115,-48 160,-25 225,-140 255,-20" fill="url(#g-mid-lit)" />
      <polygon points="115,-48 160,-25 175,35 105,15" fill="url(#g-lit)" />
      <polygon points="160,-25 255,-20 275,75 210,65" fill="url(#g-bright)" />
      <polygon points="160,-25 210,65 175,35" fill="url(#g-mid-lit)" />

      <!-- Right Lower Cheek Ruff (Spreading outward and downward) -->
      <polygon points="175,35 210,65 250,150 170,135" fill="url(#g-lit)" />
      <polygon points="210,65 275,75 250,150" fill="url(#g-bright)" />
      <polygon points="170,135 250,150 180,215 130,185" fill="url(#g-mid-lit)" />

      <!-- Left Upper Cheek Facets (Shadow side) -->
      <polygon points="-115,-48 -160,-25 -225,-140 -255,-20" fill="url(#g-shadow)" />
      <polygon points="-115,-48 -160,-25 -175,35 -105,15" fill="url(#g-dark)" />
      <polygon points="-160,-25 -255,-20 -275,75 -210,65" fill="url(#g-shadow)" />
      <polygon points="-160,-25 -210,65 -175,35" fill="url(#g-dark)" />

      <!-- Left Lower Cheek Ruff (Shadow side) -->
      <polygon points="-175,35 -210,65 -250,150 -170,135" fill="url(#g-shadow)" />
      <polygon points="-210,65 -275,75 -250,150" fill="url(#g-dark)" />
      <polygon points="-170,135 -250,150 -180,215 -130,185" fill="url(#g-dark)" />

      <!-- MUZZLE & WHISKER PADS (Refined Titanium Slate, Anti-Bucktooth) -->
      <!-- Black Nose Leather -->
      <polygon points="0,30 22,34 0,55" fill="#04060d" />
      <polygon points="0,30 -22,34 0,55" fill="#020409" />
      <polygon points="0,55 12,68 0,74 -12,68" fill="url(#cyan-glow)" opacity="0.75" />

      <!-- Right Whisker Pad -->
      <polygon points="25,25 105,15 95,65 22,34" fill="url(#g-bright)" />
      <polygon points="22,34 95,65 65,110 0,74" fill="url(#g-lit)" />
      <polygon points="95,65 175,35 170,135 65,110" fill="url(#g-mid-lit)" />

      <!-- Left Whisker Pad -->
      <polygon points="-25,25 -105,15 -95,65 -22,34" fill="url(#g-mid)" />
      <polygon points="-22,34 -95,65 -65,110 0,74" fill="url(#g-shadow)" />
      <polygon points="-95,65 -175,35 -170,135 -65,110" fill="url(#g-dark)" />

      <!-- Chin & Lower Jaw -->
      <polygon points="0,74 35,115 0,140" fill="url(#g-lit)" />
      <polygon points="0,74 -35,115 0,140" fill="url(#g-shadow)" />
      <polygon points="35,115 65,110 50,150 0,140" fill="url(#g-mid-lit)" />
      <polygon points="-35,115 -65,110 -50,150 0,140" fill="url(#g-dark)" />

      <!-- CHEST & COLLAR ARMOR (Tapering to Lower Hex Vertex) -->
      <!-- Central Neck Crest -->
      <polygon points="0,140 50,150 65,220 0,230" fill="url(#g-lit)" />
      <polygon points="0,140 -50,150 -65,220 0,230" fill="url(#g-shadow)" />
      <polygon points="0,230 65,220 50,290 0,310" fill="url(#g-mid-lit)" />
      <polygon points="0,230 -65,220 -50,290 0,310" fill="url(#g-dark)" />
      <polygon points="0,310 50,290 0,355" fill="url(#g-lit)" />
      <polygon points="0,310 -50,290 0,355" fill="url(#g-shadow)" />

      <!-- Flanking Armor Plates -->
      <polygon points="50,150 130,185 140,245 65,220" fill="url(#g-mid-lit)" />
      <polygon points="-50,150 -130,185 -140,245 -65,220" fill="url(#g-dark)" />
      <polygon points="65,220 140,245 90,305 50,290" fill="url(#g-bright)" />
      <polygon points="-65,220 -140,245 -90,305 -50,290" fill="url(#g-shadow)" />

      <!-- Cyan Gating Accent Lines on Collar -->
      <line x1="0" y1="230" x2="65" y2="220" stroke="#00f5ff" stroke-width="2.5" opacity="0.6" />
      <line x1="0" y1="230" x2="-65" y2="220" stroke="#00f5ff" stroke-width="2.5" opacity="0.4" />
      <line x1="0" y1="310" x2="50" y2="290" stroke="#00f5ff" stroke-width="2.5" opacity="0.6" />
      <line x1="0" y1="310" x2="-50" y2="290" stroke="#00f5ff" stroke-width="2.5" opacity="0.4" />

    </g>
  </g>
</svg>`;
}

async function renderLogo(outputDir) {
  const svg = buildLogoSvg();
  const svgPath = path.join(outputDir, 'logo.svg');
  const pngPath = path.join(outputDir, 'logo.png');

  fs.writeFileSync(svgPath, svg, 'utf8');
  console.log(`✓ Saved SVG to ${svgPath}`);

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1024 },
  });
  const pngData = resvg.render().asPng();
  fs.writeFileSync(pngPath, pngData);
  console.log(`✓ Successfully rendered PNG to ${pngPath} at 1024x1024`);
}

const targetDir = path.join(__dirname, '..', 'docs', 'images');
renderLogo(targetDir).catch((err) => {
  console.error('Failed to generate logo:', err);
  process.exit(1);
});
