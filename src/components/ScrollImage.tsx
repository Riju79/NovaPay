'use client'

import React, { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'

export default function ScrollImage() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Track scroll progress of the container relative to the viewport
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  // Create smooth physics spring-based progress
  const smoothProgress = useSpring(scrollYProgress, {
    damping: 25,
    stiffness: 120,
    mass: 0.5,
    restDelta: 0.001
  })

  // Map progress (0 to 0.5) to width (50% to 100%) and scale (1.0 to 1.08)
  const widthVal = useTransform(smoothProgress, [0.05, 0.45], ['50%', '100%'])
  const scaleVal = useTransform(smoothProgress, [0.05, 0.45], [1.0, 1.08])

  return (
    <div 
      ref={containerRef} 
      className="relative w-full flex justify-center overflow-hidden bg-white pb-0"
    >
      <motion.div 
        className="relative overflow-hidden rounded-t-[2rem] md:rounded-t-[3.5rem] shadow-2xl border-t border-x border-black/5"
        style={{
          width: widthVal,
          scale: scaleVal,
          transformOrigin: 'top center',
        }}
      >
        <img
          src="/hero-student.jpg"
          alt="International students traveling and processing tuition payments on NovaPay"
          className="w-full h-auto block"
          loading="eager"
        />
        
        {/* Right-aligned text overlay */}
        <div className="absolute inset-0 flex items-center justify-end p-8 md:p-16 bg-black/15">
          <h2 className="text-white text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter text-right drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)] select-none uppercase font-sans leading-tight">
            Pay Securely<br />On Stellar
          </h2>
        </div>
        
        {/* Fintech glass style top overlay */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
      </motion.div>
    </div>
  )
}
