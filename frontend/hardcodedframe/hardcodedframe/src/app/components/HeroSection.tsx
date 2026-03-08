import { Button } from "./ui/button";
import phoneImage from "figma:asset/a25cb85e40712138bc5fc5f6a17bf0b23f7e9bda.png";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function HeroSection() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#e8f3ff]">
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <div 
          className="text-2xl tracking-tight text-black"
          style={{
            fontFamily: 'Coolvetica, sans-serif',
            WebkitTextStroke: '1px black',
            WebkitTextFillColor: 'transparent',
            textStroke: '1px black',
            color: 'transparent',
            fontWeight: 'normal'
          }}
        >
          tactile
        </div>
        <div className="flex items-center gap-4">
          <button className="px-4 py-2 text-sm font-medium text-black transition-colors hover:text-gray-600">
            Examples
          </button>
          <button className="px-4 py-2 text-sm font-medium text-black transition-colors hover:text-gray-600">
            Docs
          </button>
          <button className="px-4 py-2 text-sm font-medium text-black transition-colors hover:text-gray-600">
            Pricing
          </button>
          <button className="rounded-full border border-black bg-white px-6 py-2 text-sm font-medium transition-colors hover:bg-gray-50">
            Sign In
          </button>
          <button className="rounded-full bg-[#91c1ff] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#7ab0ee]">
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-8">
        <div className="grid grid-cols-1 gap-12 pt-12 lg:grid-cols-2 lg:pt-20">
          {/* Left Column - Text Content */}
          <div className="flex flex-col justify-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-6xl font-bold leading-tight tracking-tight text-black lg:text-7xl">
                Give your design <span className="text-[#91c1ff]">soul</span>
              </h1>
            </div>

            <p className="max-w-lg text-lg text-gray-700">
              Transform your ideas into meaningful products without technical barriers. Describe your vision with human words like "warm" or "approachable" – we'll create soulful interfaces that feel intentional, not cheap.
            </p>

            <div className="flex items-center gap-6">
              <Button 
                className="rounded-full bg-[#91c1ff] px-8 py-6 text-base font-medium text-white hover:bg-[#7ab0ee] transition-colors"
              >
                Start Building with Tactile
              </Button>
              
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  <ImageWithFallback 
                    src="https://images.unsplash.com/photo-1623932078839-44eb01fbee63?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNpZ25lciUyMHdvcmtpbmclMjBjcmVhdGl2ZXxlbnwxfHx8fDE3NzI5NDg0MDd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                    alt="Designer"
                    className="h-8 w-8 rounded-full object-cover border-2 border-white"
                  />
                  <ImageWithFallback 
                    src="https://images.unsplash.com/photo-1640653410511-bee9946865ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbnRlcmZhY2UlMjBkZXNpZ24lMjB3b3Jrc3BhY2V8ZW58MXx8fHwxNzcyOTQ4NDA3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                    alt="Design Interface"
                    className="h-8 w-8 rounded-full object-cover border-2 border-white"
                  />
                  <ImageWithFallback 
                    src="https://images.unsplash.com/photo-1752860872185-78926b52ef77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMHByb2Zlc3Npb25hbCUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MjkwMTI2OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                    alt="Creative Professional"
                    className="h-8 w-8 rounded-full object-cover border-2 border-white"
                  />
                </div>
                <span className="text-sm font-medium text-black">
                  Design meets impact
                </span>
              </div>
            </div>
          </div>

          {/* Right Column - Phone Mockup */}
          <div className="flex items-center justify-center lg:justify-end">
            <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-3xl shadow-2xl">
              <ImageWithFallback 
                src={phoneImage}
                alt="Tactile App Interface"
                className="h-full w-full object-cover object-center"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}