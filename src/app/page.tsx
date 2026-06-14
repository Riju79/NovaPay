import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import ScrollImage from '@/components/ScrollImage'
import BenefitsZigzag from '@/components/BenefitsZigzag'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white selection:bg-black selection:text-white">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <Hero />

        {/* Scroll Image Section */}
        <ScrollImage />

        {/* Alternate Benefits Section */}
        <BenefitsZigzag />
      </main>

      {/* Footer Section */}
      <Footer />
    </div>
  )
}
