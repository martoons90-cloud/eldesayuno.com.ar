import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';
  showTagline?: boolean;
  variant?: 'full' | 'compact' | 'seal-only';
  theme?: 'dark' | 'light';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  showTagline = true,
  variant = 'full',
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const accentGold = '#BFA270';
  const textColor = isLight ? '#FAF8F4' : '#163323';
  const subtextColor = isLight ? '#C5B99A' : '#4E6152';

  const sealSizes = {
    sm: 44,
    md: 60,
    lg: 104,
    xl: 140,
    '2xl': 190,
    hero: 220,
  };

  const sealSize = sealSizes[size];

  // Masterpiece Vector SVG Emblem - Exact reproduction of "El Desayuno Sociedad"
  const renderSeal = () => {
    return (
      <svg
        width={sealSize}
        height={sealSize}
        viewBox="0 0 400 400"
        className="shrink-0 transition-transform duration-300 hover:scale-[1.015]"
        aria-label="El Desayuno Sociedad - Emblema Oficial"
        style={{
          filter: 'drop-shadow(0 4px 12px rgba(22, 51, 35, 0.08))',
        }}
      >
        <defs>
          {/* Background cream gradients */}
          <radialGradient id="parchmentBg" cx="50%" cy="50%" r="52%">
            <stop offset="0%" stopColor="#FFFDF8" />
            <stop offset="60%" stopColor="#F8F4EA" />
            <stop offset="100%" stopColor="#EDE4D2" />
          </radialGradient>

          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FAF7EE" />
            <stop offset="100%" stopColor="#E3EBDD" />
          </linearGradient>

          <linearGradient id="pastureGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E4EDD7" />
            <stop offset="100%" stopColor="#C8DCB8" />
          </linearGradient>

          <linearGradient id="sleeveBrown" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8C664C" />
            <stop offset="100%" stopColor="#634531" />
          </linearGradient>

          <linearGradient id="sleeveGreen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#304D38" />
            <stop offset="100%" stopColor="#1B3122" />
          </linearGradient>

          <linearGradient id="moneyStack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B3C4AB" />
            <stop offset="100%" stopColor="#7E9374" />
          </linearGradient>

          <linearGradient id="goldRim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D4BC8B" />
            <stop offset="50%" stopColor="#A68853" />
            <stop offset="100%" stopColor="#CDB27E" />
          </linearGradient>

          {/* Shading filter */}
          <filter id="medallionDrop" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.18" floodColor="#112415" />
          </filter>

          {/* Inner circle clip for the 4 quadrants */}
          <clipPath id="circleClip4">
            <circle cx="200" cy="195" r="148" />
          </clipPath>
        </defs>

        {/* ========================================================= */}
        {/* 1. LAUREL WREATH (BOTANICAL BRANCHES LEFT & RIGHT) */}
        {/* ========================================================= */}
        <g id="laurel-wreath">
          {/* LEFT LAUREL BRANCH */}
          <g>
            {/* Main stem */}
            <path
              d="M 52 230 C 32 170 42 105 74 65 C 78 82 72 106 62 135"
              fill="none"
              stroke="#2C3D24"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            {/* Leaves with dual tones */}
            {/* Leaf 1 (bottom) */}
            <path d="M 38 210 C 24 192 30 170 46 178 C 44 196 40 208 38 210 Z" fill="#4B633C" stroke="#25361D" strokeWidth="1.2" />
            <path d="M 38 210 C 33 198 37 184 46 178" fill="none" stroke="#688554" strokeWidth="1" />

            {/* Leaf 2 */}
            <path d="M 32 172 C 18 154 26 132 42 140 C 40 158 34 170 32 172 Z" fill="#587447" stroke="#25361D" strokeWidth="1.2" />
            
            {/* Leaf 3 */}
            <path d="M 38 135 C 26 114 40 96 55 108 C 50 124 43 133 38 135 Z" fill="#475F38" stroke="#25361D" strokeWidth="1.2" />

            {/* Leaf 4 */}
            <path d="M 54 96 C 45 76 62 62 76 76 C 70 90 62 95 54 96 Z" fill="#648452" stroke="#25361D" strokeWidth="1.2" />

            {/* Leaf 5 (top) */}
            <path d="M 74 66 C 72 46 90 38 102 54 C 92 64 82 66 74 66 Z" fill="#537043" stroke="#25361D" strokeWidth="1.2" />

            {/* Inner sprigs */}
            <path d="M 58 180 C 50 166 64 154 74 162 C 70 172 64 178 58 180 Z" fill="#71925D" stroke="#25361D" strokeWidth="1" />
            <path d="M 62 142 C 56 128 70 118 78 126 C 74 136 68 140 62 142 Z" fill="#5F7E4E" stroke="#25361D" strokeWidth="1" />
            <path d="M 76 110 C 74 96 88 88 96 98 C 90 106 84 108 76 110 Z" fill="#7FA16B" stroke="#25361D" strokeWidth="1" />
          </g>

          {/* RIGHT LAUREL BRANCH */}
          <g>
            {/* Main stem */}
            <path
              d="M 348 230 C 368 170 358 105 326 65 C 322 82 328 106 338 135"
              fill="none"
              stroke="#2C3D24"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            {/* Leaves */}
            <path d="M 362 210 C 376 192 370 170 354 178 C 356 196 360 208 362 210 Z" fill="#4B633C" stroke="#25361D" strokeWidth="1.2" />
            <path d="M 368 172 C 382 154 374 132 358 140 C 360 158 366 170 368 172 Z" fill="#587447" stroke="#25361D" strokeWidth="1.2" />
            <path d="M 362 135 C 374 114 360 96 345 108 C 350 124 357 133 362 135 Z" fill="#475F38" stroke="#25361D" strokeWidth="1.2" />
            <path d="M 346 96 C 355 76 338 62 324 76 C 330 90 338 95 346 96 Z" fill="#648452" stroke="#25361D" strokeWidth="1.2" />
            <path d="M 326 66 C 328 46 310 38 298 54 C 308 64 318 66 326 66 Z" fill="#537043" stroke="#25361D" strokeWidth="1.2" />

            {/* Inner sprigs */}
            <path d="M 342 180 C 350 166 336 154 326 162 C 330 172 336 178 342 180 Z" fill="#71925D" stroke="#25361D" strokeWidth="1" />
            <path d="M 338 142 C 344 128 330 118 322 126 C 326 136 332 140 338 142 Z" fill="#5F7E4E" stroke="#25361D" strokeWidth="1" />
            <path d="M 324 110 C 326 96 312 88 304 98 C 310 106 316 108 324 110 Z" fill="#7FA16B" stroke="#25361D" strokeWidth="1" />
          </g>
        </g>

        {/* ========================================================= */}
        {/* 2. MAIN CIRCULAR SEAL HOUSING */}
        {/* ========================================================= */}
        <circle cx="200" cy="195" r="154" fill="url(#parchmentBg)" stroke="#163323" strokeWidth="5" />
        <circle cx="200" cy="195" r="149" fill="none" stroke="url(#goldRim)" strokeWidth="1.8" />

        {/* ========================================================= */}
        {/* 3. FOUR QUADRANTS */}
        {/* ========================================================= */}
        <g clipPath="url(#circleClip4)">
          {/* ------------------------------------------------------- */}
          {/* QUADRANT 1 (TOP-LEFT): EUCALYPTUS GROVE & HORIZON       */}
          {/* ------------------------------------------------------- */}
          <g id="eucalyptus-field">
            <rect x="40" y="40" width="160" height="155" fill="url(#skyGrad)" />
            
            {/* Ground surface and perspective furrows */}
            <path d="M 40 155 L 200 155 L 200 195 L 40 195 Z" fill="#CFDFC3" />
            <line x1="50" y1="185" x2="200" y2="192" stroke="#879E78" strokeWidth="1.8" />
            <line x1="65" y1="188" x2="200" y2="194" stroke="#9BB58A" strokeWidth="1.6" strokeDasharray="4 2" />
            <line x1="85" y1="192" x2="200" y2="195" stroke="#7A936B" strokeWidth="1.6" />

            {/* Distant trees background */}
            <ellipse cx="180" cy="148" rx="22" ry="12" fill="#88A680" opacity="0.6" />
            <ellipse cx="160" cy="144" rx="26" ry="15" fill="#7A9971" opacity="0.6" />

            {/* Eucalyptus Trunks (Smooth white/cream bark with shadow line) */}
            {/* Tree 1 (Leftmost, largest) */}
            <path d="M 72 190 L 78 70 L 84 70 L 80 190 Z" fill="#FAF7EE" stroke="#3A4D37" strokeWidth="1.2" />
            <path d="M 78 190 L 80 70" stroke="#7F947A" strokeWidth="1.4" />
            
            {/* Tree 2 */}
            <path d="M 98 192 L 103 55 L 109 55 L 105 192 Z" fill="#FFFDF8" stroke="#3A4D37" strokeWidth="1.2" />
            <path d="M 104 192 L 106 55" stroke="#7F947A" strokeWidth="1.4" />

            {/* Tree 3 */}
            <path d="M 124 193 L 128 62 L 133 62 L 130 193 Z" fill="#F8F4EA" stroke="#3A4D37" strokeWidth="1.1" />

            {/* Tree 4 */}
            <path d="M 148 194 L 151 76 L 156 76 L 153 194 Z" fill="#FAF6EE" stroke="#3A4D37" strokeWidth="1.1" />

            {/* Tree 5 */}
            <path d="M 172 195 L 174 92 L 178 92 L 176 195 Z" fill="#FAF6EE" stroke="#3A4D37" strokeWidth="1" />

            {/* Eucalyptus Crowns (Volumetric green foliage clusters) */}
            <circle cx="78" cy="62" r="24" fill="#3D5B39" />
            <circle cx="72" cy="54" r="18" fill="#51754B" />
            <circle cx="104" cy="46" r="28" fill="#2E4A2A" />
            <circle cx="100" cy="38" r="20" fill="#4B6F45" />
            <circle cx="128" cy="54" r="23" fill="#395635" />
            <circle cx="152" cy="68" r="19" fill="#486843" />
            <circle cx="174" cy="84" r="16" fill="#365032" />
          </g>

          {/* ------------------------------------------------------- */}
          {/* QUADRANT 2 (TOP-RIGHT): HANDSHAKE                       */}
          {/* ------------------------------------------------------- */}
          <g id="handshake-quadrant">
            <rect x="200" y="40" width="160" height="155" fill="#FAF5EB" />

            {/* Left Partner Arm (Brown Tweed Sleeve) */}
            <path d="M 200 75 L 236 104 L 222 130 L 200 114 Z" fill="url(#sleeveBrown)" stroke="#4A3424" strokeWidth="2" />
            {/* Left Shirt Cuff (Crisp White) */}
            <path d="M 232 101 L 240 107 L 226 128 L 219 122 Z" fill="#FFFFFF" stroke="#5E4432" strokeWidth="1.4" />

            {/* Right Partner Arm (Dark Green Wool Sleeve) */}
            <path d="M 345 98 L 305 130 L 290 108 L 328 80 Z" fill="url(#sleeveGreen)" stroke="#14261B" strokeWidth="2" />
            {/* Right Shirt Cuff (Crisp White) */}
            <path d="M 307 127 L 301 132 L 286 114 L 292 109 Z" fill="#FFFFFF" stroke="#253C2B" strokeWidth="1.4" />

            {/* Left Hand Body & Thumb */}
            <path
              d="M 238 106 C 252 98 270 102 284 112 C 276 130 255 140 240 134 C 230 128 228 116 238 106 Z"
              fill="#E5C3A3"
              stroke="#684D37"
              strokeWidth="2.4"
            />
            {/* Thumb joint & knuckle lines */}
            <path d="M 244 105 C 256 95 271 97 279 105" fill="none" stroke="#684D37" strokeWidth="2.2" />
            <path d="M 262 104 C 265 107 268 112 268 116" fill="none" stroke="#684D37" strokeWidth="1.6" />

            {/* Clasped Fingers (Right Hand wrapping around) */}
            <g stroke="#684D37" strokeWidth="2.2" fill="#D8B18D">
              <path d="M 258 114 C 269 119 274 129 269 139 C 261 144 249 141 247 131 Z" />
              <path d="M 267 118 C 277 123 282 133 277 142 C 270 147 259 144 257 136 Z" />
              <path d="M 276 122 C 285 127 289 136 284 144 C 277 149 268 146 266 139 Z" />
              <path d="M 284 126 C 292 131 295 139 290 146 C 284 150 276 148 274 142 Z" />
            </g>
          </g>

          {/* ------------------------------------------------------- */}
          {/* QUADRANT 3 (BOTTOM-LEFT): MONEY / BANKNOTE STACK        */}
          {/* ------------------------------------------------------- */}
          <g id="banknotes-quadrant">
            <rect x="40" y="195" width="160" height="160" fill="#EDE7DA" />

            <g transform="translate(68, 218)">
              {/* Cast shadow under the stack */}
              <path d="M 8 46 L 56 68 L 96 46 L 48 24 Z" fill="#1A2B1D" opacity="0.16" />

              {/* Stack lateral thickness (layered banknote edges) */}
              <path d="M 8 46 L 56 66 L 96 46 L 96 24 L 56 44 L 8 24 Z" fill="url(#moneyStack)" stroke="#273824" strokeWidth="1.8" />
              {/* Engraved paper edge lines */}
              <line x1="8" y1="30" x2="56" y2="50" stroke="#3D5339" strokeWidth="1" />
              <line x1="8" y1="36" x2="56" y2="56" stroke="#3D5339" strokeWidth="1" />
              <line x1="8" y1="41" x2="56" y2="61" stroke="#3D5339" strokeWidth="1" />
              <line x1="56" y1="50" x2="96" y2="30" stroke="#3D5339" strokeWidth="1" />
              <line x1="56" y1="56" x2="96" y2="36" stroke="#3D5339" strokeWidth="1" />

              {/* Top Banknote Face */}
              <path d="M 8 24 L 56 44 L 96 24 L 48 6 Z" fill="#C4D7BC" stroke="#253821" strokeWidth="2" />

              {/* Intricate Bill Engraving Borders */}
              <path d="M 14 24 L 54 40 L 88 24 L 48 10 Z" fill="none" stroke="#486243" strokeWidth="1.2" strokeDasharray="3 1.5" />
              
              {/* Central Oval Vignette / Medallion on bill */}
              <ellipse cx="52" cy="25" rx="16" ry="7" fill="#ACC3A3" stroke="#385233" strokeWidth="1.4" />
              <ellipse cx="52" cy="25" rx="12" ry="5" fill="none" stroke="#567550" strokeWidth="0.8" />

              {/* Corner Denomination numerals simulation */}
              <circle cx="20" cy="22" r="2.5" fill="#3D5A38" />
              <circle cx="82" cy="22" r="2.5" fill="#3D5A38" />

              {/* Paper Currency Wrapper / Belly Band Strap */}
              <path d="M 33 13 L 47 19 L 47 50 L 33 44 Z" fill="#F3E9D2" stroke="#8A7752" strokeWidth="1.8" />
              <line x1="40" y1="16" x2="40" y2="47" stroke="#D1BE97" strokeWidth="1.2" />
            </g>
          </g>

          {/* ------------------------------------------------------- */}
          {/* QUADRANT 4 (BOTTOM-RIGHT): BLACK ANGUS CATTLE & PASTURE */}
          {/* ------------------------------------------------------- */}
          <g id="cattle-pasture">
            <rect x="200" y="195" width="160" height="160" fill="url(#pastureGrad)" />

            {/* Tree silhouettes on distant ridge */}
            <circle cx="320" cy="226" r="14" fill="#698560" opacity="0.6" />
            <circle cx="300" cy="228" r="11" fill="#75936B" opacity="0.6" />
            <circle cx="338" cy="230" r="10" fill="#698560" opacity="0.6" />

            {/* Wooden Fence Posts & Wire Lines */}
            <line x1="200" y1="238" x2="350" y2="238" stroke="#879976" strokeWidth="1.4" />
            <line x1="200" y1="248" x2="350" y2="248" stroke="#879976" strokeWidth="1.4" />
            <line x1="230" y1="230" x2="230" y2="258" stroke="#685642" strokeWidth="2.5" />
            <line x1="280" y1="230" x2="280" y2="258" stroke="#685642" strokeWidth="2.5" />
            <line x1="330" y1="230" x2="330" y2="258" stroke="#685642" strokeWidth="2.5" />

            {/* Pasture grass tufts */}
            <line x1="205" y1="290" x2="345" y2="290" stroke="#9AB483" strokeWidth="2" />
            <line x1="215" y1="310" x2="330" y2="310" stroke="#89A671" strokeWidth="1.8" />

            {/* COW 1: Main Black Angus Bull / Steer (Foreground Leader) */}
            <g transform="translate(225, 244) scale(1.05)">
              {/* Shadow */}
              <ellipse cx="32" cy="48" rx="24" ry="5" fill="#142116" opacity="0.25" />

              {/* Muscular Torso */}
              <ellipse cx="34" cy="30" rx="25" ry="16" fill="#192019" />
              {/* Powerful Neck & Shoulder hump */}
              <ellipse cx="18" cy="22" rx="14" ry="12" fill="#151C16" />
              {/* Head facing front-right */}
              <path d="M 6 18 C 4 25 8 30 14 28 C 17 24 15 18 8 18 Z" fill="#242D25" />
              {/* Muzzle */}
              <ellipse cx="9" cy="25" rx="5" ry="4" fill="#2E382F" />

              {/* Ears */}
              <path d="M 6 15 L 1 11 L 5 19 Z" fill="#242D25" />
              <path d="M 16 15 L 21 11 L 17 19 Z" fill="#242D25" />

              {/* Legs */}
              <rect x="16" y="38" width="5.5" height="22" fill="#131914" rx="2" />
              <rect x="27" y="38" width="5" height="22" fill="#131914" rx="2" />
              <rect x="44" y="38" width="5.5" height="22" fill="#131914" rx="2" />
              <rect x="52" y="37" width="5" height="23" fill="#131914" rx="2" />
            </g>

            {/* COW 2: Calf 1 (Midground) */}
            <g transform="translate(282, 240) scale(0.72)">
              <ellipse cx="30" cy="26" rx="18" ry="12" fill="#202720" />
              <ellipse cx="14" cy="20" rx="9" ry="9" fill="#1A211B" />
              <rect x="18" y="34" width="4.5" height="16" fill="#151B16" />
              <rect x="27" y="34" width="4" height="16" fill="#151B16" />
              <rect x="40" y="34" width="4.5" height="16" fill="#151B16" />
            </g>

            {/* COW 3: Calf 2 (Background) */}
            <g transform="translate(310, 238) scale(0.62)">
              <ellipse cx="30" cy="26" rx="18" ry="12" fill="#262E27" />
              <ellipse cx="14" cy="20" rx="9" ry="9" fill="#202721" />
              <rect x="18" y="34" width="4" height="15" fill="#181F19" />
              <rect x="28" y="34" width="4" height="15" fill="#181F19" />
              <rect x="40" y="34" width="4" height="15" fill="#181F19" />
            </g>
          </g>

          {/* ======================================================= */}
          {/* CROSS DIVISION AXES                                     */}
          {/* ======================================================= */}
          <line x1="200" y1="40" x2="200" y2="350" stroke="#163323" strokeWidth="4.5" />
          <line x1="45" y1="195" x2="355" y2="195" stroke="#163323" strokeWidth="4.5" />
        </g>

        {/* ========================================================= */}
        {/* 4. CENTRAL SERIF "D" MEDALLION                           */}
        {/* ========================================================= */}
        <circle cx="200" cy="195" r="54" fill="#FAF8F3" stroke="#163323" strokeWidth="4.5" filter="url(#medallionDrop)" />
        <circle cx="200" cy="195" r="49" fill="none" stroke="url(#goldRim)" strokeWidth="1.8" />

        <text
          x="200"
          y="214"
          textAnchor="middle"
          fontFamily="'Cinzel', 'Playfair Display', Georgia, serif"
          fontSize="58"
          fontWeight="800"
          fill="#163323"
          letterSpacing="0.01em"
        >
          D
        </text>

        {/* ========================================================= */}
        {/* 5. BOTTOM HERALDIC RIBBON BRACKET                         */}
        {/* ========================================================= */}
        <g transform="translate(0, 326)">
          <path d="M 100 16 L 175 16 L 200 32 L 225 16 L 300 16" fill="none" stroke="#163323" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 188 32 L 200 42 L 212 32" fill="none" stroke="#A68853" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      </svg>
    );
  };

  if (variant === 'seal-only') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{renderSeal()}</div>;
  }

  return (
    <div className={`flex items-center gap-3.5 select-none ${className}`}>
      {renderSeal()}
      <div className="flex flex-col">
        <div
          className="font-serif font-bold tracking-wider leading-none"
          style={{
            color: textColor,
            fontSize: size === 'sm' ? '1.05rem' : size === 'md' ? '1.35rem' : size === 'lg' ? '1.85rem' : '2.3rem',
            fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
            letterSpacing: '0.08em',
          }}
        >
          EL DESAYUNO
        </div>
        <div
          className="font-medium tracking-[0.28em] uppercase text-[10px] md:text-[11px] leading-tight mt-1"
          style={{ color: accentGold }}
        >
          S O C I E D A D
        </div>
        {showTagline && (
          <div
            className="text-[9px] md:text-[10px] tracking-wider uppercase mt-0.5 font-medium flex items-center gap-1.5"
            style={{ color: subtextColor }}
          >
            <span>CUATRO PARTES</span>
            <span className="text-[#C4A76C]">·</span>
            <span>UN MISMO OBJETIVO</span>
          </div>
        )}
      </div>
    </div>
  );
};
