const sharp = require('sharp');
const path = require('path');

// Icon sizes needed for Expo
const ICON_SIZES = {
  icon: 1024,           // Main app icon
  adaptiveIcon: 1024,   // Android adaptive icon foreground
  favicon: 48,          // Web favicon
  splash: 1284,         // Splash screen
};

// Cosmic color palette - matching the reference image
const COLORS = {
  deepSpace: '#050510',
  spaceDark: '#0a0a1f',
  spaceMid: '#151530',
  galaxyCore: '#ffeedd',
  galaxyArm1: '#d4a574',
  galaxyArm2: '#c49464',
  galaxyDust: '#8b6b4a',
  galaxyEdge: '#4a3a2a',
  dolphinHighlight: '#8fd8ff',
  dolphinLight: '#4db8e8',
  dolphinMid: '#2a8bc4',
  dolphinDark: '#1a5a8a',
  dolphinDeep: '#0d3a5a',
  glowCyan: '#00d4ff',
  glowPink: '#ff6b9d',
  starWhite: '#ffffff',
  nebulaPurple: '#3a2050',
  nebulaPink: '#502040',
};

function generateStars(count, size) {
  let stars = '';
  const seededRandom = (seed) => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let i = 0; i < count; i++) {
    const x = seededRandom(i * 1.1) * size;
    const y = seededRandom(i * 2.3) * size;
    const r = seededRandom(i * 3.7) * 1.5 + 0.3;
    const opacity = seededRandom(i * 4.9) * 0.6 + 0.4;
    
    // Main star
    stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${opacity}"/>`;
    
    // Star glow for brighter stars
    if (opacity > 0.7) {
      stars += `<circle cx="${x}" cy="${y}" r="${r * 4}" fill="white" opacity="${opacity * 0.08}"/>`;
    }
  }
  return stars;
}

function createIconSVG(size) {
  const stars = generateStars(80, size);
  const cx = size / 2;
  const cy = size / 2;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Cosmic background gradient -->
    <radialGradient id="cosmicBg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="${COLORS.spaceMid}"/>
      <stop offset="40%" stop-color="${COLORS.spaceDark}"/>
      <stop offset="100%" stop-color="${COLORS.deepSpace}"/>
    </radialGradient>
    
    <!-- Nebula purple glow -->
    <radialGradient id="nebulaGlow1" cx="20%" cy="80%" r="50%">
      <stop offset="0%" stop-color="${COLORS.nebulaPurple}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${COLORS.nebulaPurple}" stop-opacity="0"/>
    </radialGradient>
    
    <!-- Nebula pink glow -->
    <radialGradient id="nebulaGlow2" cx="80%" cy="20%" r="40%">
      <stop offset="0%" stop-color="${COLORS.nebulaPink}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${COLORS.nebulaPink}" stop-opacity="0"/>
    </radialGradient>
    
    <!-- Galaxy spiral gradient -->
    <radialGradient id="galaxyGradient" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${COLORS.galaxyCore}"/>
      <stop offset="15%" stop-color="${COLORS.galaxyArm1}"/>
      <stop offset="35%" stop-color="${COLORS.galaxyArm2}"/>
      <stop offset="60%" stop-color="${COLORS.galaxyDust}"/>
      <stop offset="85%" stop-color="${COLORS.galaxyEdge}"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    
    <!-- Dolphin body gradient - main -->
    <linearGradient id="dolphinBody" x1="30%" y1="0%" x2="70%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.dolphinHighlight}"/>
      <stop offset="25%" stop-color="${COLORS.dolphinLight}"/>
      <stop offset="50%" stop-color="${COLORS.dolphinMid}"/>
      <stop offset="75%" stop-color="${COLORS.dolphinDark}"/>
      <stop offset="100%" stop-color="${COLORS.dolphinDeep}"/>
    </linearGradient>
    
    <!-- Dolphin inner galaxy effect -->
    <radialGradient id="dolphinGalaxy" cx="40%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${COLORS.galaxyCore}" stop-opacity="0.3"/>
      <stop offset="30%" stop-color="${COLORS.glowPink}" stop-opacity="0.25"/>
      <stop offset="60%" stop-color="${COLORS.nebulaPurple}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    
    <!-- Dolphin belly gradient -->
    <linearGradient id="dolphinBelly" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.dolphinHighlight}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${COLORS.dolphinLight}" stop-opacity="0.2"/>
    </linearGradient>
    
    <!-- Dolphin glow -->
    <filter id="dolphinGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    
    <!-- Strong cyan glow -->
    <filter id="cyanGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="20" result="blur"/>
    </filter>
    
    <!-- Galaxy blur -->
    <filter id="galaxyBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
    
    <!-- Clip path for dolphin -->
    <clipPath id="dolphinClip">
      <path d="
        M ${cx + 180} ${cy - 120}
        C ${cx + 220} ${cy - 100} ${cx + 250} ${cy - 60} ${cx + 260} ${cy - 20}
        C ${cx + 270} ${cy + 30} ${cx + 250} ${cy + 80} ${cx + 200} ${cy + 120}
        C ${cx + 150} ${cy + 160} ${cx + 80} ${cy + 180} ${cx} ${cy + 170}
        C ${cx - 80} ${cy + 160} ${cx - 150} ${cy + 120} ${cx - 180} ${cy + 60}
        C ${cx - 200} ${cy + 20} ${cx - 210} ${cy - 40} ${cx - 180} ${cy - 100}
        C ${cx - 150} ${cy - 160} ${cx - 80} ${cy - 200} ${cx} ${cy - 200}
        C ${cx + 80} ${cy - 200} ${cx + 140} ${cy - 160} ${cx + 180} ${cy - 120}
        Z
      "/>
    </clipPath>
  </defs>
  
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="url(#cosmicBg)"/>
  
  <!-- Nebula effects -->
  <rect width="${size}" height="${size}" fill="url(#nebulaGlow1)"/>
  <rect width="${size}" height="${size}" fill="url(#nebulaGlow2)"/>
  
  <!-- Stars layer 1 -->
  ${stars}
  
  <!-- Galaxy behind dolphin - tilted ellipse -->
  <g transform="translate(${cx}, ${cy + 80}) rotate(-15)">
    <!-- Galaxy outer glow -->
    <ellipse cx="0" cy="0" rx="380" ry="120" fill="url(#galaxyGradient)" opacity="0.4" filter="url(#galaxyBlur)"/>
    
    <!-- Galaxy core -->
    <ellipse cx="0" cy="0" rx="300" ry="90" fill="url(#galaxyGradient)" opacity="0.7"/>
    
    <!-- Galaxy bright center -->
    <ellipse cx="0" cy="0" rx="80" ry="25" fill="${COLORS.galaxyCore}" opacity="0.8"/>
    <ellipse cx="0" cy="0" rx="40" ry="12" fill="white" opacity="0.9"/>
    
    <!-- Spiral arm hints -->
    <ellipse cx="-100" cy="-20" rx="150" ry="40" fill="${COLORS.galaxyArm1}" opacity="0.3" transform="rotate(10)"/>
    <ellipse cx="100" cy="20" rx="150" ry="40" fill="${COLORS.galaxyArm1}" opacity="0.3" transform="rotate(10)"/>
  </g>
  
  <!-- Dolphin glow behind -->
  <ellipse cx="${cx + 40}" cy="${cy - 40}" rx="280" ry="200" fill="${COLORS.glowCyan}" opacity="0.15" filter="url(#cyanGlow)"/>
  
  <!-- Dolphin - leaping pose facing right, angled upward -->
  <g transform="translate(${cx - 20}, ${cy - 60}) rotate(-25)">
    <!-- Main body -->
    <path d="
      M 220 0
      Q 260 -20 280 -60
      Q 290 -90 270 -110
      Q 240 -130 200 -130
      Q 140 -130 80 -100
      Q 20 -70 -20 -30
      Q -60 10 -100 20
      Q -160 35 -200 20
      Q -180 0 -160 -20
      Q -200 -10 -240 0
      Q -200 20 -160 30
      Q -180 50 -200 80
      Q -160 60 -120 45
      Q -80 60 -20 60
      Q 40 60 100 40
      Q 160 20 200 0
      Q 210 -5 220 0
      Z
    " fill="url(#dolphinBody)" filter="url(#dolphinGlow)"/>
    
    <!-- Galaxy effect inside dolphin -->
    <path d="
      M 220 0
      Q 260 -20 280 -60
      Q 290 -90 270 -110
      Q 240 -130 200 -130
      Q 140 -130 80 -100
      Q 20 -70 -20 -30
      Q -60 10 -100 20
      Q -160 35 -200 20
      Q -180 0 -160 -20
      Q -200 -10 -240 0
      Q -200 20 -160 30
      Q -180 50 -200 80
      Q -160 60 -120 45
      Q -80 60 -20 60
      Q 40 60 100 40
      Q 160 20 200 0
      Q 210 -5 220 0
      Z
    " fill="url(#dolphinGalaxy)"/>
    
    <!-- Dorsal fin -->
    <path d="
      M 40 -95
      Q 60 -160 100 -180
      Q 110 -170 105 -150
      Q 95 -120 80 -100
      Z
    " fill="url(#dolphinBody)"/>
    
    <!-- Pectoral fin -->
    <path d="
      M 80 30
      Q 60 80 20 120
      Q 40 90 55 50
      Q 65 35 80 30
      Z
    " fill="${COLORS.dolphinDark}"/>
    
    <!-- Tail flukes -->
    <path d="
      M -200 20
      Q -230 -20 -260 -40
      Q -240 0 -200 20
    " fill="${COLORS.dolphinDark}"/>
    <path d="
      M -200 20
      Q -230 60 -260 100
      Q -240 50 -200 20
    " fill="${COLORS.dolphinDark}"/>
    
    <!-- Belly highlight -->
    <ellipse cx="60" cy="10" rx="100" ry="30" fill="url(#dolphinBelly)" transform="rotate(-10)"/>
    
    <!-- Rostrum (beak) highlight -->
    <path d="
      M 200 -20
      Q 240 -40 265 -70
      Q 250 -50 220 -30
      Q 210 -25 200 -20
    " fill="${COLORS.dolphinHighlight}" opacity="0.5"/>
    
    <!-- Eye -->
    <ellipse cx="160" cy="-70" rx="18" ry="16" fill="white"/>
    <ellipse cx="164" cy="-70" rx="10" ry="12" fill="#0a0a1a"/>
    <circle cx="158" cy="-75" r="5" fill="white"/>
    <circle cx="168" cy="-68" r="2" fill="white" opacity="0.5"/>
    
    <!-- Mouth line -->
    <path d="M 200 -30 Q 230 -25 255 -35" fill="none" stroke="${COLORS.dolphinDeep}" stroke-width="3" stroke-linecap="round"/>
    
    <!-- Body shine lines -->
    <path d="M 120 -100 Q 160 -95 180 -80" fill="none" stroke="${COLORS.dolphinHighlight}" stroke-width="2" opacity="0.4" stroke-linecap="round"/>
    <path d="M 60 -85 Q 90 -90 110 -95" fill="none" stroke="${COLORS.dolphinHighlight}" stroke-width="2" opacity="0.3" stroke-linecap="round"/>
  </g>
  
  <!-- Extra stars in front (very subtle) -->
  <circle cx="${size * 0.15}" cy="${size * 0.25}" r="1.5" fill="white" opacity="0.8"/>
  <circle cx="${size * 0.85}" cy="${size * 0.75}" r="1.2" fill="white" opacity="0.7"/>
  <circle cx="${size * 0.9}" cy="${size * 0.15}" r="1.8" fill="white" opacity="0.9"/>
</svg>`;
}

function createAdaptiveIconSVG(size) {
  const cx = size / 2;
  const cy = size / 2;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Dolphin body gradient -->
    <linearGradient id="dolphinBody" x1="30%" y1="0%" x2="70%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.dolphinHighlight}"/>
      <stop offset="25%" stop-color="${COLORS.dolphinLight}"/>
      <stop offset="50%" stop-color="${COLORS.dolphinMid}"/>
      <stop offset="75%" stop-color="${COLORS.dolphinDark}"/>
      <stop offset="100%" stop-color="${COLORS.dolphinDeep}"/>
    </linearGradient>
    
    <!-- Dolphin inner galaxy effect -->
    <radialGradient id="dolphinGalaxy" cx="40%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${COLORS.galaxyCore}" stop-opacity="0.3"/>
      <stop offset="30%" stop-color="${COLORS.glowPink}" stop-opacity="0.25"/>
      <stop offset="60%" stop-color="${COLORS.nebulaPurple}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    
    <!-- Dolphin belly gradient -->
    <linearGradient id="dolphinBelly" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.dolphinHighlight}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${COLORS.dolphinLight}" stop-opacity="0.2"/>
    </linearGradient>
    
    <!-- Dolphin glow -->
    <filter id="dolphinGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    
    <!-- Cyan glow behind -->
    <filter id="cyanGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="25" result="blur"/>
    </filter>
  </defs>
  
  <!-- Glow behind dolphin -->
  <ellipse cx="${cx}" cy="${cy}" rx="300" ry="220" fill="${COLORS.glowCyan}" opacity="0.2" filter="url(#cyanGlow)"/>
  
  <!-- Dolphin - centered for adaptive icon with safe zone padding -->
  <g transform="translate(${cx - 20}, ${cy - 30}) rotate(-25) scale(0.75)">
    <!-- Main body -->
    <path d="
      M 220 0
      Q 260 -20 280 -60
      Q 290 -90 270 -110
      Q 240 -130 200 -130
      Q 140 -130 80 -100
      Q 20 -70 -20 -30
      Q -60 10 -100 20
      Q -160 35 -200 20
      Q -180 0 -160 -20
      Q -200 -10 -240 0
      Q -200 20 -160 30
      Q -180 50 -200 80
      Q -160 60 -120 45
      Q -80 60 -20 60
      Q 40 60 100 40
      Q 160 20 200 0
      Q 210 -5 220 0
      Z
    " fill="url(#dolphinBody)" filter="url(#dolphinGlow)"/>
    
    <!-- Galaxy effect inside dolphin -->
    <path d="
      M 220 0
      Q 260 -20 280 -60
      Q 290 -90 270 -110
      Q 240 -130 200 -130
      Q 140 -130 80 -100
      Q 20 -70 -20 -30
      Q -60 10 -100 20
      Q -160 35 -200 20
      Q -180 0 -160 -20
      Q -200 -10 -240 0
      Q -200 20 -160 30
      Q -180 50 -200 80
      Q -160 60 -120 45
      Q -80 60 -20 60
      Q 40 60 100 40
      Q 160 20 200 0
      Q 210 -5 220 0
      Z
    " fill="url(#dolphinGalaxy)"/>
    
    <!-- Dorsal fin -->
    <path d="
      M 40 -95
      Q 60 -160 100 -180
      Q 110 -170 105 -150
      Q 95 -120 80 -100
      Z
    " fill="url(#dolphinBody)"/>
    
    <!-- Pectoral fin -->
    <path d="
      M 80 30
      Q 60 80 20 120
      Q 40 90 55 50
      Q 65 35 80 30
      Z
    " fill="${COLORS.dolphinDark}"/>
    
    <!-- Tail flukes -->
    <path d="
      M -200 20
      Q -230 -20 -260 -40
      Q -240 0 -200 20
    " fill="${COLORS.dolphinDark}"/>
    <path d="
      M -200 20
      Q -230 60 -260 100
      Q -240 50 -200 20
    " fill="${COLORS.dolphinDark}"/>
    
    <!-- Belly highlight -->
    <ellipse cx="60" cy="10" rx="100" ry="30" fill="url(#dolphinBelly)" transform="rotate(-10)"/>
    
    <!-- Rostrum highlight -->
    <path d="
      M 200 -20
      Q 240 -40 265 -70
      Q 250 -50 220 -30
      Q 210 -25 200 -20
    " fill="${COLORS.dolphinHighlight}" opacity="0.5"/>
    
    <!-- Eye -->
    <ellipse cx="160" cy="-70" rx="18" ry="16" fill="white"/>
    <ellipse cx="164" cy="-70" rx="10" ry="12" fill="#0a0a1a"/>
    <circle cx="158" cy="-75" r="5" fill="white"/>
    <circle cx="168" cy="-68" r="2" fill="white" opacity="0.5"/>
    
    <!-- Mouth line -->
    <path d="M 200 -30 Q 230 -25 255 -35" fill="none" stroke="${COLORS.dolphinDeep}" stroke-width="3" stroke-linecap="round"/>
    
    <!-- Body shine lines -->
    <path d="M 120 -100 Q 160 -95 180 -80" fill="none" stroke="${COLORS.dolphinHighlight}" stroke-width="2" opacity="0.4" stroke-linecap="round"/>
  </g>
</svg>`;
}

function createSplashSVG(size) {
  const stars = generateStars(100, size);
  const cx = size / 2;
  const cy = size / 2;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Cosmic background gradient -->
    <radialGradient id="cosmicBg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="${COLORS.spaceMid}"/>
      <stop offset="40%" stop-color="${COLORS.spaceDark}"/>
      <stop offset="100%" stop-color="${COLORS.deepSpace}"/>
    </radialGradient>
    
    <!-- Nebula effects -->
    <radialGradient id="nebulaGlow1" cx="20%" cy="80%" r="50%">
      <stop offset="0%" stop-color="${COLORS.nebulaPurple}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${COLORS.nebulaPurple}" stop-opacity="0"/>
    </radialGradient>
    
    <radialGradient id="nebulaGlow2" cx="80%" cy="20%" r="40%">
      <stop offset="0%" stop-color="${COLORS.nebulaPink}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${COLORS.nebulaPink}" stop-opacity="0"/>
    </radialGradient>
    
    <!-- Galaxy gradient -->
    <radialGradient id="galaxyGradient" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${COLORS.galaxyCore}"/>
      <stop offset="15%" stop-color="${COLORS.galaxyArm1}"/>
      <stop offset="35%" stop-color="${COLORS.galaxyArm2}"/>
      <stop offset="60%" stop-color="${COLORS.galaxyDust}"/>
      <stop offset="85%" stop-color="${COLORS.galaxyEdge}"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    
    <!-- Dolphin gradients -->
    <linearGradient id="dolphinBody" x1="30%" y1="0%" x2="70%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.dolphinHighlight}"/>
      <stop offset="25%" stop-color="${COLORS.dolphinLight}"/>
      <stop offset="50%" stop-color="${COLORS.dolphinMid}"/>
      <stop offset="75%" stop-color="${COLORS.dolphinDark}"/>
      <stop offset="100%" stop-color="${COLORS.dolphinDeep}"/>
    </linearGradient>
    
    <radialGradient id="dolphinGalaxy" cx="40%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${COLORS.galaxyCore}" stop-opacity="0.3"/>
      <stop offset="30%" stop-color="${COLORS.glowPink}" stop-opacity="0.25"/>
      <stop offset="60%" stop-color="${COLORS.nebulaPurple}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    
    <linearGradient id="dolphinBelly" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.dolphinHighlight}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${COLORS.dolphinLight}" stop-opacity="0.2"/>
    </linearGradient>
    
    <!-- Filters -->
    <filter id="dolphinGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    
    <filter id="cyanGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
    </filter>
    
    <filter id="galaxyBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    
    <filter id="textGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="url(#cosmicBg)"/>
  <rect width="${size}" height="${size}" fill="url(#nebulaGlow1)"/>
  <rect width="${size}" height="${size}" fill="url(#nebulaGlow2)"/>
  
  <!-- Stars -->
  ${stars}
  
  <!-- Galaxy behind dolphin -->
  <g transform="translate(${cx}, ${cy + 60}) rotate(-15)">
    <ellipse cx="0" cy="0" rx="320" ry="100" fill="url(#galaxyGradient)" opacity="0.4" filter="url(#galaxyBlur)"/>
    <ellipse cx="0" cy="0" rx="250" ry="75" fill="url(#galaxyGradient)" opacity="0.7"/>
    <ellipse cx="0" cy="0" rx="60" ry="20" fill="${COLORS.galaxyCore}" opacity="0.8"/>
    <ellipse cx="0" cy="0" rx="30" ry="10" fill="white" opacity="0.9"/>
  </g>
  
  <!-- Dolphin glow -->
  <ellipse cx="${cx + 30}" cy="${cy - 60}" rx="240" ry="180" fill="${COLORS.glowCyan}" opacity="0.12" filter="url(#cyanGlow)"/>
  
  <!-- Dolphin - smaller for splash -->
  <g transform="translate(${cx - 15}, ${cy - 80}) rotate(-25) scale(0.85)">
    <!-- Main body -->
    <path d="
      M 220 0
      Q 260 -20 280 -60
      Q 290 -90 270 -110
      Q 240 -130 200 -130
      Q 140 -130 80 -100
      Q 20 -70 -20 -30
      Q -60 10 -100 20
      Q -160 35 -200 20
      Q -180 0 -160 -20
      Q -200 -10 -240 0
      Q -200 20 -160 30
      Q -180 50 -200 80
      Q -160 60 -120 45
      Q -80 60 -20 60
      Q 40 60 100 40
      Q 160 20 200 0
      Q 210 -5 220 0
      Z
    " fill="url(#dolphinBody)" filter="url(#dolphinGlow)"/>
    
    <!-- Galaxy effect inside -->
    <path d="
      M 220 0
      Q 260 -20 280 -60
      Q 290 -90 270 -110
      Q 240 -130 200 -130
      Q 140 -130 80 -100
      Q 20 -70 -20 -30
      Q -60 10 -100 20
      Q -160 35 -200 20
      Q -180 0 -160 -20
      Q -200 -10 -240 0
      Q -200 20 -160 30
      Q -180 50 -200 80
      Q -160 60 -120 45
      Q -80 60 -20 60
      Q 40 60 100 40
      Q 160 20 200 0
      Q 210 -5 220 0
      Z
    " fill="url(#dolphinGalaxy)"/>
    
    <!-- Dorsal fin -->
    <path d="
      M 40 -95
      Q 60 -160 100 -180
      Q 110 -170 105 -150
      Q 95 -120 80 -100
      Z
    " fill="url(#dolphinBody)"/>
    
    <!-- Pectoral fin -->
    <path d="
      M 80 30
      Q 60 80 20 120
      Q 40 90 55 50
      Q 65 35 80 30
      Z
    " fill="${COLORS.dolphinDark}"/>
    
    <!-- Tail flukes -->
    <path d="M -200 20 Q -230 -20 -260 -40 Q -240 0 -200 20" fill="${COLORS.dolphinDark}"/>
    <path d="M -200 20 Q -230 60 -260 100 Q -240 50 -200 20" fill="${COLORS.dolphinDark}"/>
    
    <!-- Belly highlight -->
    <ellipse cx="60" cy="10" rx="100" ry="30" fill="url(#dolphinBelly)" transform="rotate(-10)"/>
    
    <!-- Rostrum highlight -->
    <path d="M 200 -20 Q 240 -40 265 -70 Q 250 -50 220 -30 Q 210 -25 200 -20" fill="${COLORS.dolphinHighlight}" opacity="0.5"/>
    
    <!-- Eye -->
    <ellipse cx="160" cy="-70" rx="18" ry="16" fill="white"/>
    <ellipse cx="164" cy="-70" rx="10" ry="12" fill="#0a0a1a"/>
    <circle cx="158" cy="-75" r="5" fill="white"/>
    <circle cx="168" cy="-68" r="2" fill="white" opacity="0.5"/>
    
    <!-- Mouth -->
    <path d="M 200 -30 Q 230 -25 255 -35" fill="none" stroke="${COLORS.dolphinDeep}" stroke-width="3" stroke-linecap="round"/>
    
    <!-- Shine lines -->
    <path d="M 120 -100 Q 160 -95 180 -80" fill="none" stroke="${COLORS.dolphinHighlight}" stroke-width="2" opacity="0.4" stroke-linecap="round"/>
  </g>
  
  <!-- App name -->
  <text x="${cx}" y="${cy + 320}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${size/16}" font-weight="600" fill="${COLORS.glowCyan}" opacity="0.5" filter="url(#textGlow)">Cosmic Dolphin</text>
  <text x="${cx}" y="${cy + 320}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${size/16}" font-weight="600" fill="white">Cosmic Dolphin</text>
</svg>`;
}

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets', 'images');
  
  console.log('Generating Cosmic Dolphin icons...\n');
  
  // Generate main icon
  console.log('Creating icon.png (1024x1024)...');
  const iconSvg = createIconSVG(ICON_SIZES.icon);
  await sharp(Buffer.from(iconSvg))
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
  
  // Generate adaptive icon (foreground only)
  console.log('Creating adaptive-icon.png (1024x1024)...');
  const adaptiveSvg = createAdaptiveIconSVG(ICON_SIZES.adaptiveIcon);
  await sharp(Buffer.from(adaptiveSvg))
    .png()
    .toFile(path.join(assetsDir, 'adaptive-icon.png'));
  
  // Generate favicon
  console.log('Creating favicon.png (48x48)...');
  const faviconSvg = createIconSVG(ICON_SIZES.favicon);
  await sharp(Buffer.from(faviconSvg))
    .png()
    .toFile(path.join(assetsDir, 'favicon.png'));
  
  // Generate splash screen
  console.log('Creating splash.png (1284x1284)...');
  const splashSvg = createSplashSVG(ICON_SIZES.splash);
  await sharp(Buffer.from(splashSvg))
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));
  
  // Also update the iOS app icon
  const iosIconPath = path.join(
    __dirname, '..', 'ios', 'CosmicDolphin', 'Images.xcassets', 
    'AppIcon.appiconset', 'App-Icon-1024x1024@1x.png'
  );
  console.log('Creating iOS App Icon...');
  const iosIconSvg = createIconSVG(1024);
  await sharp(Buffer.from(iosIconSvg))
    .png()
    .toFile(iosIconPath);
  
  console.log('\nAll icons generated successfully!');
  console.log('\nNext steps:');
  console.log('   1. Run "npx expo prebuild --clean" to regenerate native projects');
  console.log('   2. Run your app to see the new icon');
}

main().catch(console.error);
