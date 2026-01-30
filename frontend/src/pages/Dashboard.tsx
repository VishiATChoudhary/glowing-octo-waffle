import React from "react"
import { Link } from "react-router-dom";

import { AnimatedGradient } from "@/components/ui/animated-gradient-with-svg"

interface BentoCardProps {
  title: string
  value: string | number
  subtitle?: string
  colors: string[]
}

const BentoCard: React.FC<BentoCardProps> = ({
  title,
  value,
  subtitle,
  colors,
}) => {
  return (
    <div className="relative overflow-hidden h-full bg-background dark:bg-background/50">
      <AnimatedGradient colors={colors} speed={0.05} blur="medium" />
      <div className="relative z-10 p-3 sm:p-5 md:p-8 text-foreground backdrop-blur-sm">
        <h3 className="text-sm sm:text-base md:text-lg text-foreground">
          {title}
        </h3>
        <p className="text-2xl sm:text-4xl md:text-5xl font-medium mb-4 text-foreground">
          {value}
        </p>
        {subtitle && (
          <p className="text-sm text-foreground/80">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

const AnimatedGradientDemo: React.FC = () => {
  // Check demo mode (frontend env var)
  const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';

  return (
    <div className="w-full bg-background h-full relative">
      <div className="grid grid-cols-1 md:grid-cols-3 grow h-full">
        <div className="md:col-span-3">
          <Link to="/total-revenue">
            <BentoCard
              title="New Papers"
              value="84"
              subtitle="since last login"
              colors={["#3B82F6", "#60A5FA", "#93C5FD"]}
            />
          </Link>
        </div>
        <Link to="/talent-pipeline">
          <BentoCard
            title="Talent Pipeline"
            value="56"
            subtitle="Researchers in data bank"
            colors={["#F59E0B", "#A78BFA", "#FCD34D"]}
          />
        </Link>
        <div className="md:col-span-2">
          <BentoCard
            title="Top Emerging Hubs"
            value="TU Delft"
            subtitle="Highest volume of high-potential papers over the last four weeks"
            colors={["#3B82F6", "#A78BFA", "#FBCFE8"]}
          />
        </div>
        <div className="md:col-span-3">
          <Link to="/fastest-rising-topics">
            <BentoCard
              title="Fastest Rising Topics"
              value="Metal-Air Batteries"
              subtitle="Highest % growth in mention frequency over the last four weeks"
              colors={["#EC4899", "#F472B6", "#3B82F6"]}
            />
          </Link>
        </div>
      </div>
      {demoMode && (
        <div className="fixed bottom-4 right-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-3 py-1.5 text-xs rounded-md shadow-sm z-50">
          Mock Data
        </div>
      )}
    </div>
  )
}

export default AnimatedGradientDemo;