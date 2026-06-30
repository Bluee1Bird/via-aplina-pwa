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

// Hedgehog spines (local coords, facing right): [baseX, baseY, tipX, tipY, halfWidth].
// Pointed triangles fanning over the back — finer & spikier than rounded blobs.
const SPINES_BACK: [number, number, number, number, number][] = [
  [6, 22, 0, 7, 3], [11, 19, 5, 2, 3.2], [16, 17, 12, 0, 3.2], [21, 16, 18, -1, 3.2],
  [26, 16, 24, 0, 3.2], [30, 17, 30, 1, 3], [34, 19, 37, 4, 3], [37, 22, 42, 9, 2.8],
]
const SPINES_FRONT: [number, number, number, number, number][] = [
  [9, 21, 4, 10, 2.4], [14, 18, 10, 6, 2.6], [19, 16.5, 16, 5, 2.6],
  [24, 16, 22, 5, 2.6], [28, 16.5, 27, 5, 2.4], [32, 18, 33, 8, 2.4],
]
const spinePath = ([bx, by, tx, ty, w]: [number, number, number, number, number]) =>
  `M${bx - w} ${by} L${tx} ${ty} L${bx + w} ${by} Z`

interface Props {
  onDismiss: () => void
}

export default function CompletionCelebration({ onDismiss }: Props) {
  useEffect(() => {
    // animateMotion: dur=2.3s, begin=0.5s → reaches the summit at ~2.8s
    const burst1 = setTimeout(() => {
      void confetti({
        particleCount: 150,
        spread: 80,
        origin: { x: 0.5, y: 0.38 },
        colors: ['#22c55e', '#fbbf24', '#f97316', '#ec4899', '#3b82f6', '#a855f7'],
        startVelocity: 45,
      })
    }, 2800)

    const burst2 = setTimeout(() => {
      void confetti({ angle: 55,  particleCount: 80, spread: 65, origin: { x: 0,   y: 0.55 } })
      void confetti({ angle: 125, particleCount: 80, spread: 65, origin: { x: 1,   y: 0.55 } })
    }, 3150)

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
            {/* Path the hedgehog follows — up the LEFT slope toward the summit,
                moving up-and-to-the-right. The hedgehog is drawn facing right, so
                this is its direction of travel and it stays UPRIGHT the whole way
                (no rotate="auto" — that's what tipped it onto its head before). */}
            <path id="climbPath" d="M 91.5 377.5 Q 150 235 199.5 107.5"/>
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

          {/* Hedgehog — nested groups keep the three motions from fighting over
               the same transform:
                 1. outer g  → animateMotion (SMIL) drives it up the slope, upright
                 2. cheer g  → joyful hops once it reaches the summit
                 3. waddle g → gentle step-bob during the climb */}
          <g>
            <animateMotion dur="2.3s" begin="0.5s" fill="freeze">
              <mpath href="#climbPath"/>
            </animateMotion>

            <g style={{ animation: 'summitCheer 0.8s ease-in-out 2.8s 2' }}>
              <g style={{ animation: 'hedgehogWaddle 0.5s ease-in-out 0.5s 5' }}>
                {/* Hedgehog, drawn facing right (+X = its direction of travel) */}
                <g transform="translate(-34, -28) scale(1.25)">
                {/* Soft contact shadow */}
                <ellipse cx="24" cy="43" rx="20" ry="3" fill="#000" opacity="0.12"/>

                {/* Little feet (behind body) */}
                <ellipse cx="12" cy="40" rx="4.6" ry="2.6" fill="#5b4133"/>
                <ellipse cx="22" cy="42" rx="4.6" ry="2.6" fill="#6a4d3c"/>
                <ellipse cx="31" cy="41.5" rx="4.4" ry="2.5" fill="#5b4133"/>

                {/* Body */}
                <ellipse cx="22" cy="29" rx="20" ry="13.5" fill="#6f5140"/>
                {/* Pale underside */}
                <ellipse cx="26" cy="34" rx="13" ry="6.5" fill="#cdb094" opacity="0.45"/>

                {/* Spiny coat — two layers of fine pointed quills */}
                <g>
                  {SPINES_BACK.map((s, i) => <path key={`b${i}`} d={spinePath(s)} fill="#3f291d"/>)}
                  {SPINES_FRONT.map((s, i) => <path key={`f${i}`} d={spinePath(s)} fill="#5c4030"/>)}
                </g>

                {/* Head */}
                <circle cx="38" cy="28" r="14.5" fill="#d8b48d"/>
                {/* Snout */}
                <path d="M46 22 Q57 24 56 30 Q55 35 46 34 Z" fill="#e3c4a2"/>

                {/* Ear */}
                <ellipse cx="35" cy="15.5" rx="3.6" ry="3.1" fill="#b48f6a" transform="rotate(-18 35 15.5)"/>

                {/* Eye — modest, single soft catchlight */}
                <circle cx="41.5" cy="24.5" r="4.4" fill="#241310"/>
                <circle cx="43.2" cy="22.8" r="1.5" fill="#fff" opacity="0.85"/>

                {/* Subtle blush */}
                <ellipse cx="47" cy="30" rx="3.6" ry="2.2" fill="#e07a92" opacity="0.22"/>

                {/* Nose */}
                <ellipse cx="56" cy="28.5" rx="2.9" ry="2.6" fill="#2c1a14"/>
                <circle cx="55" cy="27.6" r="0.8" fill="#fff" opacity="0.6"/>

                {/* Gentle smile */}
                <path d="M50 33 Q53 35.4 56 33" stroke="#5b3a2c" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
                </g>
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
