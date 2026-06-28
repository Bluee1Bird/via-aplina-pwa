import { useEffect } from 'react'
import confetti from 'canvas-confetti'

// Stars: [cx, cy, radius]
const STARS: [number, number, number][] = [
  [22, 28, 1.5], [58, 12, 1.2], [95, 42, 1.8], [140, 18, 1],
  [178, 55, 1.5], [218, 22, 1.2], [260, 40, 1.8], [298, 15, 1],
  [335, 38, 1.5], [370, 20, 1.2], [48, 70, 1], [135, 85, 1.5],
  [205, 75, 1.2], [280, 80, 1.8], [348, 65, 1], [88, 105, 1.2],
  [165, 115, 1], [310, 100, 1.5], [378, 88, 1.2], [32, 120, 1],
]

// Trees: [x, y, size]
const TREES: [number, number, number][] = [
  [44, 448, 26], [72, 458, 20], [100, 464, 16],
  [298, 464, 16], [326, 458, 20], [354, 448, 26],
  [138, 468, 14], [158, 472, 11],
  [244, 472, 11], [264, 468, 14],
]

interface Props {
  onDismiss: () => void
}

export default function CompletionCelebration({ onDismiss }: Props) {
  useEffect(() => {
    // animateMotion: dur=2.2s, begin=0.5s → arrives at peak at ~2.7s
    const burst1 = setTimeout(() => {
      void confetti({
        particleCount: 150,
        spread: 80,
        origin: { x: 0.5, y: 0.38 },
        colors: ['#22c55e', '#fbbf24', '#f97316', '#ec4899', '#3b82f6', '#a855f7'],
        startVelocity: 45,
      })
    }, 2700)

    const burst2 = setTimeout(() => {
      void confetti({ angle: 55,  particleCount: 80, spread: 65, origin: { x: 0,   y: 0.55 } })
      void confetti({ angle: 125, particleCount: 80, spread: 65, origin: { x: 1,   y: 0.55 } })
    }, 3050)

    return () => { clearTimeout(burst1); clearTimeout(burst2) }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none"
      style={{
        background: 'linear-gradient(to bottom, #0f172a 0%, #1e3a5f 50%, #14532d 100%)',
        animation: 'dimFadeIn 0.4s ease both',
      }}
      onClick={onDismiss}
    >
      {/* "You did it!" — springs in after confetti */}
      <div
        className="flex-1 flex items-center justify-center px-8"
        style={{ animation: 'celebTitle 0.7s cubic-bezier(0.34,1.56,0.64,1) 3.3s both' }}
      >
        <h1
          className="text-center font-extrabold text-white leading-tight"
          style={{
            fontSize: 'clamp(2.2rem, 9vw, 3.8rem)',
            textShadow: '0 0 50px rgba(251,191,36,0.9), 0 2px 12px rgba(0,0,0,0.6)',
          }}
        >
          You did it!
        </h1>
      </div>

      {/* Mountain scene */}
      <div style={{ height: '62vh', flexShrink: 0 }}>
        <svg
          viewBox="0 30 400 440"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMax meet"
          style={{ display: 'block' }}
        >
          <defs>
            {/* Path the hedgehog follows — right slope, base → peak */}
            <path id="climbPath" d="M 342 468 C 308 390 262 285 202 130"/>
            <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#fef3c7" stopOpacity="0.5"/>
              <stop offset="100%" stopColor="#fef3c7" stopOpacity="0"/>
            </radialGradient>
          </defs>

          {/* Moon */}
          <circle cx="318" cy="58" r="30" fill="#fef3c7"/>
          <circle cx="318" cy="58" r="52" fill="url(#moonGlow)"/>

          {/* Stars */}
          {STARS.map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="white" opacity={0.55 + (i % 3) * 0.15}/>
          ))}

          {/* Background mountain silhouettes */}
          <path d="M -10 410 L 120 240 L 260 410Z" fill="#1e293b"/>
          <path d="M 155 410 L 322 185 L 420 410Z" fill="#162032"/>

          {/* Main mountain */}
          <path d="M -10 480 L 55 480 L 200 118 L 345 480 L 410 480Z" fill="#374151"/>
          {/* Snow cap */}
          <path d="M 200 118 L 168 212 L 232 212Z" fill="#f1f5f9"/>
          <path d="M 200 118 L 168 212 L 183 212Z" fill="#e2e8f0"/>

          {/* Trees (two-tier triangle silhouettes) */}
          {TREES.map(([x, y, s], i) => (
            <g key={i}>
              <path
                d={`M${x} ${y} L${x - s * 0.55} ${y + s} L${x + s * 0.55} ${y + s}Z`}
                fill="#15803d"
              />
              <path
                d={`M${x} ${y + s * 0.42} L${x - s * 0.68} ${y + s * 1.35} L${x + s * 0.68} ${y + s * 1.35}Z`}
                fill="#166534"
              />
            </g>
          ))}

          {/* Ground */}
          <rect x="-10" y="470" width="420" height="20" fill="#14532d"/>

          {/* Hedgehog — outer g carries the animateMotion (SMIL),
               inner g carries the CSS bounce so they don't conflict */}
          <g>
            <animateMotion dur="2.2s" begin="0.5s" fill="freeze" rotate="auto">
              <mpath href="#climbPath"/>
            </animateMotion>

            {/* Bounce starts when climb ends */}
            <g style={{ animation: 'hedgehogBounce 0.55s ease-in-out 2.75s 5' }}>
              {/* Hedgehog, drawn facing right (+X = forward for rotate="auto") */}
              <g transform="translate(-26, -20)">
                {/* Rounded quills — rotated ellipses fanning out from the back */}
                <ellipse cx="5"  cy="16" rx="5"   ry="9.5" fill="#3e2723" transform="rotate(-38 5 16)"/>
                <ellipse cx="13" cy="9"  rx="5"   ry="9.5" fill="#3e2723" transform="rotate(-18 13 9)"/>
                <ellipse cx="22" cy="6"  rx="5"   ry="9"   fill="#4a2c20" transform="rotate(0 22 6)"/>
                <ellipse cx="31" cy="9"  rx="4.5" ry="8.5" fill="#4a2c20" transform="rotate(18 31 9)"/>
                <ellipse cx="38" cy="16" rx="4.5" ry="8"   fill="#5c3d2e" transform="rotate(34 38 16)"/>

                {/* Body */}
                <ellipse cx="21" cy="28" rx="21" ry="14" fill="#6d4c41"/>

                {/* Large round face */}
                <circle cx="35" cy="27" r="17" fill="#d4956a"/>

                {/* Big cute eye — sclera → iris → pupil → two shines */}
                <circle cx="39"   cy="21"   r="8.5" fill="#1a0805"/>
                <circle cx="40"   cy="21"   r="6.5" fill="#3b1808"/>
                <circle cx="40.5" cy="21"   r="3.8" fill="#0a0404"/>
                <circle cx="43.5" cy="18"   r="2.8" fill="white"/>
                <circle cx="38.5" cy="23.5" r="1.3" fill="rgba(255,255,255,0.55)"/>

                {/* Blush */}
                <ellipse cx="47" cy="28" rx="4.5" ry="2.7" fill="#e91e8c" opacity="0.22"/>

                {/* Small ear */}
                <ellipse cx="33" cy="12" rx="3.8" ry="3.2" fill="#bf8d5e" transform="rotate(-18 33 12)"/>

                {/* Button nose */}
                <ellipse cx="50" cy="26" rx="4.2" ry="3.8" fill="#f8a8c8"/>
                <circle  cx="50" cy="25"   r="2.2"  fill="#d81b60"/>
                <circle  cx="48.8" cy="24.2" r="0.9" fill="white" opacity="0.72"/>

                {/* Happy smile */}
                <path d="M 46 30.5 Q 50 36 54 30.5" stroke="#b5004b" strokeWidth="1.5" fill="none" strokeLinecap="round"/>

                {/* Stubby feet */}
                <ellipse cx="8"  cy="39" rx="5.5" ry="3"   fill="#5d4037"/>
                <ellipse cx="19" cy="42" rx="5.5" ry="3"   fill="#5d4037"/>
                <ellipse cx="30" cy="42" rx="5.5" ry="3"   fill="#5d4037"/>
                <ellipse cx="41" cy="39" rx="5"   ry="2.8" fill="#5d4037"/>
              </g>
            </g>
          </g>
        </svg>
      </div>

      {/* Dismiss hint — fades in late */}
      <p
        className="text-center pb-8 text-sm"
        style={{ color: 'rgba(255,255,255,0.45)', animation: 'dimFadeIn 0.6s ease 4.5s both' }}
      >
        tap anywhere to dismiss
      </p>
    </div>
  )
}
