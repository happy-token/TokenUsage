import React from 'react'

interface AppLogoProps {
  size?: number
}

export default function AppLogo({ size = 24 }: AppLogoProps): React.ReactElement {
  const id = 'ht-grad'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f0b429" />
          <stop offset="100%" stopColor="#d99e22" />
        </linearGradient>
      </defs>

      {/* Badge background */}
      <rect width="40" height="40" rx="10" fill={`url(#${id})`} />

      {/* Eyes */}
      <circle cx="13.5" cy="13" r="2.5" fill="white" fillOpacity="0.95" />
      <circle cx="26.5" cy="13" r="2.5" fill="white" fillOpacity="0.95" />

      {/* Happy T: smile arc = crossbar, rect = stem */}
      {/* Smile / T crossbar */}
      <path
        d="M8 20 Q20 30 32 20"
        stroke="white"
        strokeWidth="3.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* T stem */}
      <rect x="18" y="20" width="4" height="13" rx="2" fill="white" />
    </svg>
  )
}
