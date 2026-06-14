'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function Hero() {
  const generateGridSvg = () => {
    const activeCells = [
      { col: 1, row: 0, seed: 1 },
      { col: 3, row: 0, seed: 2 },
      { col: 0, row: 1, seed: 3 },
      { col: 2, row: 1, seed: 4 },
      { col: 1, row: 2, seed: 5 },
      { col: 3, row: 2, seed: 6 },
      { col: 0, row: 3, seed: 7 },
      { col: 2, row: 3, seed: 8 }
    ];

    let linesHtml = '';

    // Generate grid line dividers (4 columns, 4 rows of 96px each)
    for (let i = 1; i <= 4; i++) {
      const coord = i * 96;
      linesHtml += `<line x1="${coord}" y1="0" x2="${coord}" y2="384" stroke="black" stroke-opacity="0.18" stroke-width="1" />`;
      linesHtml += `<line x1="0" y1="${coord}" x2="384" y2="${coord}" stroke="black" stroke-opacity="0.18" stroke-width="1" />`;
    }

    // Draw code-like textures inside active cells
    activeCells.forEach(cell => {
      const startX = cell.col * 96;
      const startY = cell.row * 96;
      
      const lineCount = 11;
      const paddingX = 14;
      const startYOffset = 16;
      const gap = 6;
      
      linesHtml += `<g stroke="black" stroke-opacity="0.22" stroke-width="1.8" stroke-linecap="round">`;
      
      for (let l = 0; l < lineCount; l++) {
        const y = startY + startYOffset + (l * gap);
        
        // Indentation: some lines are indented
        const isIndented = (cell.seed + l) % 3 === 0 && l > 1 && l < lineCount - 2;
        const indent = isIndented ? 12 : 0;
        
        const left = startX + paddingX + indent;
        
        // Calculate length based on seed and line number
        const lengthFactor = Math.abs(Math.sin(cell.seed * 1.5 + l * 2.3)); // yields 0 to 1
        const maxLength = 96 - (paddingX * 2) - indent;
        const lineLength = 15 + lengthFactor * (maxLength - 15);
        
        const right = left + lineLength;
        
        linesHtml += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" />`;
      }
      
      linesHtml += `</g>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="384" viewBox="0 0 384 384">
      ${linesHtml}
    </svg>`;
  };

  const svgString = generateGridSvg();
  const gridBackground = `url("data:image/svg+xml,${encodeURIComponent(svgString)}")`;

  return (
    <section id="home" className="relative isolate pt-32 pb-16 md:pt-40 md:pb-20 overflow-hidden flex flex-col items-center text-center px-6">
      {/* Hero Radial Glow */}
      <div 
        className="absolute top-0 left-0 w-full h-[550px] pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.45), transparent)',
          filter: 'blur(60px)',
          zIndex: -2,
        }}
      />

      {/* Grid of structured boxes fading down */}
      <div 
        className="absolute top-0 left-0 w-full h-[550px] pointer-events-none"
        style={{
          backgroundImage: gridBackground,
          backgroundSize: '384px 384px',
          maskImage: 'linear-gradient(to bottom, black 30%, transparent 85%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 85%)',
          zIndex: -1,
        }}
      />

      {/* Main Hero Container */}
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        {/* Stellar Badge */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/[0.04] border border-black/[0.08] text-xs font-semibold text-black/75 mb-6"
        >
          <span className="flex h-1.5 w-1.5 rounded-full bg-black animate-pulse" />
          Powered by Stellar Blockchain
        </motion.div>

        {/* Hero Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
          className="text-4xl md:text-6xl font-black tracking-tight text-black leading-[1.1] max-w-3xl font-sans"
        >
          Send Tuition Anywhere.<br />Instantly. On Stellar.
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          className="mt-6 text-lg md:text-xl text-black/60 max-w-xl font-medium font-sans leading-relaxed"
        >
          Fast, transparent, and low-cost cross-border payments for students globally.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          className="mt-10 flex flex-col sm:flex-row gap-4 items-center"
        >
          <button className="px-8 py-3.5 text-sm font-semibold text-white bg-black hover:bg-black/90 rounded-full transition-all duration-200 shadow-md shadow-black/10 hover:shadow-black/25 flex items-center gap-2 cursor-pointer group">
            Send Money
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
          </button>
          <button className="px-8 py-3.5 text-sm font-semibold text-black border border-black/15 hover:border-black rounded-full transition-all duration-200 bg-transparent cursor-pointer">
            Pay Tuition
          </button>
        </motion.div>
      </div>
    </section>
  )
}
