'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface BenefitRow {
  title: string
  description: string
  illustration: React.ReactNode
}

export default function BenefitsZigzag() {
  const router = useRouter()
  const benefits: BenefitRow[] = [
    {
      title: 'Zero Tuition Pay Fees',
      description: "Pay your university fees directly without any platform markup or processing fees. NovaPay routes transactions with zero friction, saving you hundreds of dollars on banking overhead.",
      illustration: (
        <div className="w-full flex items-center justify-center overflow-hidden bg-[#FBFBFB]">
          <img
            src="/fx-rate.jpg"
            alt="Zero tuition payment fees visual concept"
            className="w-full h-auto block"
            loading="lazy"
          />
        </div>
      )
    },
    {
      title: 'On-Chain Transparency',
      description: 'Every transfer is logged as a cryptographic receipt on-chain. Track payment routes, FX conversion points, and university clearance status in real-time.',
      illustration: (
        <div className="w-full flex items-center justify-center overflow-hidden bg-[#FBFBFB]">
          <img
            src="/transparency.jpg"
            alt="Airport passenger with luggage representing transparent cross-border money transfer flow"
            className="w-full h-auto block"
            loading="lazy"
          />
        </div>
      )
    }
  ]

  return (
    <section id="payment-mode" className="w-full bg-white pt-24 md:pt-32 pb-0">
      <div className="max-w-7xl mx-auto px-6 flex flex-col gap-24 md:gap-32">

        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-black font-sans">
            Designed for Modern International Education
          </h2>
          <p className="mt-4 text-base md:text-lg text-black/60 font-sans leading-relaxed">
            NovaPay coordinates tuition settlements directly on the Stellar blockchain network, removing the standard friction of global bank processing.
          </p>
        </div>

        {/* Alternate Benefits Layout & Taglines wrapper */}
        <div className="flex flex-col gap-12 md:gap-16">
          {/* Alternate Benefits Layout */}
          <div className="flex flex-col gap-20 md:gap-28">
            {benefits.map((benefit, index) => {
              const isEven = index % 2 === 0
              return (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`flex flex-col md:items-center gap-10 md:gap-16 ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'
                    }`}
                >
                  {/* Visual Graphic Side */}
                  <div className="flex-1 w-full flex justify-center items-center">
                    <div className="w-full max-w-[400px] border border-black/5 rounded-[1.5rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                      {benefit.illustration}
                    </div>
                  </div>

                  {/* Content Side */}
                  <div className="flex-1 space-y-4 md:space-y-6">
                    {/* Row Counter Badge */}
                    <span className="inline-block text-xs font-bold font-mono text-black/40 tracking-wider">
                      0{index + 1} / BENEFIT
                    </span>

                    <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-black font-sans">
                      {benefit.title}
                    </h3>

                    <p className="text-base md:text-lg text-black/60 font-sans font-normal leading-relaxed">
                      {benefit.description}
                    </p>

                    <div className="pt-2">
                      <a
                        href="#home"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-black hover:text-black/70 group"
                      >
                        Learn more
                        <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                      </a>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Two short lines after the last benefit */}
          <div className="text-center pt-8 md:pt-12 pb-10 md:pb-14 border-t border-black/5 flex flex-col items-center gap-6">
            <div className="flex flex-col gap-2">
              <p className="text-lg md:text-xl font-bold text-black font-sans">
                Global education, unified currency.
              </p>
              <p className="text-sm md:text-base text-black/50 font-medium font-sans">
                Empowering international student journeys with the future of payment routing.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Full width bottom image with adjusted height */}
      <div className="w-full h-[260px] sm:h-[380px] md:h-[450px] overflow-hidden border-t border-black/5 relative">
        <img
          src="/tagline-bottom.jpg"
          alt="Silhouetted travelers at a terminal representing global tuition journeys"
          className="w-full h-full object-cover object-center block"
          loading="lazy"
        />

        {/* Widescreen image content overlay on the right dark area */}
        <div className="absolute inset-0 flex items-center justify-end p-6 sm:p-12 md:p-20 bg-black/25 md:bg-transparent">
          <div className="max-w-md text-right flex flex-col items-end gap-3 sm:gap-4">
            <h3 className="text-white text-lg sm:text-2xl font-black tracking-tight font-sans uppercase">
              Tuition Request System
            </h3>
            <p className="text-white/80 text-[10px] sm:text-xs md:text-sm font-medium leading-relaxed font-sans max-w-xs sm:max-w-sm">
              Generate secure payment requests instantly on the Stellar ledger. Send requests directly to parents or sponsors, allowing them to settle tuition balances instantly in local currency.
            </p>
            <button 
              onClick={() => router.push('/payment-mode?tab=invoice')}
              className="mt-1 sm:mt-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-black bg-white hover:bg-white/95 rounded-full shadow-lg transition-all cursor-pointer hover:scale-[1.03] active:scale-[0.98]"
            >
              Send Request
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
