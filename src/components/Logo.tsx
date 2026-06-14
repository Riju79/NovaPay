import React from 'react'

interface LogoProps {
  showText?: boolean
  inverted?: boolean
  className?: string
  iconSize?: number
}

export default function Logo({
  showText = true,
  inverted = false,
  className = '',
  iconSize = 32,
}: LogoProps) {
  const iconColor = inverted ? '#FFFFFF' : '#0A0A0A'
  const textColor = inverted ? 'text-white' : 'text-black'

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* SVG Icon */}
      <div
        className="relative flex items-center justify-center transition-transform duration-300 hover:scale-105"
        style={{ width: iconSize, height: iconSize }}
      >
        <svg
          viewBox="0 0 512 512"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* 'n' Arch and stems */}
          <path
            d="M 96,368 L 96,224 A 80,80 0 0,1 256,224 L 256,368"
            fill="none"
            stroke={iconColor}
            strokeWidth="54"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 'p' Loop */}
          <circle
            cx="336"
            cy="224"
            r="80"
            fill="none"
            stroke={iconColor}
            strokeWidth="54"
          />
          {/* Globe Grid */}
          <circle
            cx="336"
            cy="224"
            r="40"
            fill="none"
            stroke={iconColor}
            strokeWidth="6"
          />
          <line
            x1="296"
            y1="224"
            x2="376"
            y2="224"
            stroke={iconColor}
            strokeWidth="6"
          />
          <line
            x1="336"
            y1="184"
            x2="336"
            y2="264"
            stroke={iconColor}
            strokeWidth="6"
          />
          <ellipse
            cx="336"
            cy="224"
            rx="20"
            ry="40"
            fill="none"
            stroke={iconColor}
            strokeWidth="6"
          />
          <ellipse
            cx="336"
            cy="224"
            rx="40"
            ry="20"
            fill="none"
            stroke={iconColor}
            strokeWidth="6"
          />
        </svg>
      </div>

      {/* Wordmark */}
      {showText && (
        <span className={`font-sans font-bold tracking-tight text-xl ${textColor}`}>
          NovaPay
        </span>
      )}
    </div>
  )
}
