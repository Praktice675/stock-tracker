"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

export const staggerParentVariants = {
  hidden: { opacity: 1 },
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

const parentVariants = staggerParentVariants;
const itemVariants = staggerItemVariants;

type ContainerProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function StaggerContainer({
  children,
  className,
  style,
}: ContainerProps) {
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      animate="visible"
      variants={parentVariants}
    >
      {children}
    </motion.div>
  );
}

type ItemProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
};

export function StaggerItem({
  children,
  className,
  style,
  id,
}: ItemProps) {
  return (
    <motion.div
      id={id}
      className={className}
      style={style}
      variants={itemVariants}
    >
      {children}
    </motion.div>
  );
}
