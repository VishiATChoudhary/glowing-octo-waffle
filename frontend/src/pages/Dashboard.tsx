import React from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom";

import { AnimatedGradient } from "@/components/ui/animated-gradient-with-svg"

interface BentoCardProps {
  title: string
  value: string | number
  subtitle?: string
  colors: string[]
  delay: number
}

const BentoCard: React.FC<BentoCardProps> = ({
  title,
  value,
  subtitle,
  colors,
  delay,
}) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: delay + 0.3,
      },
    },
  }

  const item = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.5 } },
  }

  return (
    <motion.div
      className="relative overflow-hidden h-full bg-background dark:bg-background/50" // Изменено здесь
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      <AnimatedGradient colors={colors} speed={0.05} blur="medium" />
      <motion.div
        className="relative z-10 p-3 sm:p-5 md:p-8 text-foreground backdrop-blur-sm" // Добавлен backdrop-blur
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.h3 
          className="text-sm sm:text-base md:text-lg text-foreground" 
          variants={item}
        >
          {title}
        </motion.h3>
        <motion.p
          className="text-2xl sm:text-4xl md:text-5xl font-medium mb-4 text-foreground"
          variants={item}
        >
          {value}
        </motion.p>
        {subtitle && (
          <motion.p 
            className="text-sm text-foreground/80" 
            variants={item}
          >
            {subtitle}
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  )
}

const AnimatedGradientDemo: React.FC = () => {
  return (
    <div className="w-full bg-background h-full">
      <div className="grid grid-cols-1 md:grid-cols-3 grow h-full">
        <div className="md:col-span-2">
          <Link to="/total-revenue">
            <BentoCard
              title="New Papers"
              value="84"
              subtitle="since last login"
              colors={["#3B82F6", "#60A5FA", "#93C5FD"]}
              delay={0.2}
            />
          </Link>
        </div>
        <BentoCard
          title="Top 5%"
          value="17"
          subtitle="of 84"
          colors={["#60A5FA", "#34D399", "#93C5FD"]}
          delay={0.4}
        />
        <BentoCard
          title="Talent Pipeline"
          value="56"
          subtitle="Researchers in data bank"
          colors={["#F59E0B", "#A78BFA", "#FCD34D"]}
          delay={0.6}
        />
        <div className="md:col-span-2">
          <BentoCard
            title="Top Emerging Hubs"
            value="TU Delft"
            subtitle="Highest volume of high-potential papers over the last four weeks"
            colors={["#3B82F6", "#A78BFA", "#FBCFE8"]}
            delay={0.8}
          />
        </div>
        <div className="md:col-span-3">
          <Link to="/fastest-rising-topics">
            <BentoCard
              title="Fastest Rising Topics"
              value="Metal-Air Batteries"
              subtitle="Highest % growth in mention frequency over the last four weeks"
              colors={["#EC4899", "#F472B6", "#3B82F6"]}
              delay={1}
            />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default AnimatedGradientDemo;