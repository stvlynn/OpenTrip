import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { createAnimatedIcon } from "./createAnimatedIcon";

const RAY_VARIANTS: Variants = {
  normal: { opacity: 1 },
  animate: (i: number) => ({
    opacity: [0, 1],
    transition: { delay: i * 0.1, duration: 0.3 },
  }),
};

const SUN_RAYS = [
  "M12 2v2",
  "m19.07 4.93-1.41 1.41",
  "M20 12h2",
  "m17.66 17.66 1.41 1.41",
  "M12 20v2",
  "m6.34 17.66-1.41 1.41",
  "M2 12h2",
  "m4.93 4.93 1.41 1.41",
];

export const SunIcon = createAnimatedIcon(
  "SunIcon",
  (controls) => (
    <>
      <circle cx="12" cy="12" r="4" />
      {SUN_RAYS.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          custom={i + 1}
          initial="normal"
          animate={controls}
          variants={RAY_VARIANTS}
        />
      ))}
    </>
  ),
  { size: 28 },
);

export const MoonIcon = createAnimatedIcon(
  "MoonIcon",
  () => <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  {
    size: 28,
    svg: {
      variants: {
        normal: { rotate: 0 },
        animate: { rotate: [0, -10, 10, -5, 5, 0] },
      },
      transition: { duration: 1.2, ease: "easeInOut" },
    },
  },
);

const CLOUD_WIGGLE_VARIANTS: Variants = {
  normal: { x: 0, y: 0 },
  animate: {
    x: [-1, 1, -1, 1, 0],
    y: [-1, 1, -1, 1, 0],
    transition: { duration: 1, ease: "easeInOut" },
  },
};

const CLOUD_SUN_RAY_VARIANTS: Variants = {
  normal: { opacity: 1 },
  animate: (i: number) => ({
    opacity: [0, 1],
    transition: { delay: i * 0.1, duration: 0.3 },
  }),
};

const CLOUD_SUN_RAYS = [
  "M12 2v2",
  "m4.93 4.93 1.41 1.41",
  "M20 12h2",
  "m19.07 4.93-1.41 1.41",
  "M15.947 12.65a4 4 0 0 0-5.925-4.128",
];

export const CloudSunIcon = createAnimatedIcon(
  "CloudSunIcon",
  (controls) => (
    <>
      <motion.g initial="normal" animate={controls} variants={CLOUD_WIGGLE_VARIANTS}>
        <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />
      </motion.g>
      {CLOUD_SUN_RAYS.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          custom={i + 1}
          initial="normal"
          animate={controls}
          variants={CLOUD_SUN_RAY_VARIANTS}
        />
      ))}
    </>
  ),
  { size: 28 },
);

const DROP_GROUP_VARIANTS: Variants = {
  animate: { transition: { staggerChildren: 0.2 } },
};

const DROP_VARIANTS: Variants = {
  normal: { opacity: 1 },
  animate: {
    opacity: [1, 0.2, 1],
    transition: {
      duration: 1,
      repeat: Number.POSITIVE_INFINITY,
      ease: "easeInOut",
    },
  },
};

export const CloudRainIcon = createAnimatedIcon(
  "CloudRainIcon",
  (controls) => (
    <>
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <motion.g initial="normal" animate={controls} variants={DROP_GROUP_VARIANTS}>
        <motion.path d="M16 14v6" variants={DROP_VARIANTS} />
        <motion.path d="M8 14v6" variants={DROP_VARIANTS} />
        <motion.path d="M12 16v6" variants={DROP_VARIANTS} />
      </motion.g>
    </>
  ),
);

const BOLT_VARIANTS: Variants = {
  normal: { opacity: 1 },
  animate: {
    opacity: [1, 0.4, 1],
    transition: {
      duration: 1,
      repeat: Number.POSITIVE_INFINITY,
      ease: "easeInOut",
    },
  },
};

export const CloudLightningIcon = createAnimatedIcon(
  "CloudLightningIcon",
  (controls) => (
    <>
      <path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" />
      <motion.path
        d="m13 12-3 5h4l-3 5"
        initial="normal"
        animate={controls}
        variants={BOLT_VARIANTS}
      />
    </>
  ),
  { size: 28 },
);

const SNOW_GROUP_VARIANTS: Variants = {
  animate: { transition: { staggerChildren: 0.3 } },
};

const SNOW_VARIANTS: Variants = {
  normal: { opacity: 1 },
  animate: {
    opacity: [1, 0.3, 1],
    transition: {
      duration: 1.5,
      repeat: Number.POSITIVE_INFINITY,
      ease: "easeInOut",
    },
  },
};

const SNOWFLAKES = [
  "M8 15h.01",
  "M8 19h.01",
  "M12 17h.01",
  "M12 21h.01",
  "M16 15h.01",
  "M16 19h.01",
];

export const CloudSnowIcon = createAnimatedIcon(
  "CloudSnowIcon",
  (controls) => (
    <>
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <motion.g initial="normal" animate={controls} variants={SNOW_GROUP_VARIANTS}>
        {SNOWFLAKES.map((d) => (
          <motion.path key={d} d={d} variants={SNOW_VARIANTS} />
        ))}
      </motion.g>
    </>
  ),
  { size: 28 },
);

const GUST_VARIANTS: Variants = {
  normal: (custom: number) => ({
    pathLength: 1,
    opacity: 1,
    pathOffset: 0,
    transition: { duration: 0.3, ease: "easeInOut", delay: custom },
  }),
  animate: (custom: number) => ({
    pathLength: [0, 1],
    opacity: [0, 1],
    pathOffset: [1, 0],
    transition: { duration: 0.5, ease: "easeInOut", delay: custom },
  }),
};

const GUSTS = [
  { d: "M12.8 19.6A2 2 0 1 0 14 16H2", delay: 0.2 },
  { d: "M17.5 8a2.5 2.5 0 1 1 2 4H2", delay: 0 },
  { d: "M9.8 4.4A2 2 0 1 1 11 8H2", delay: 0.4 },
];

export const WindIcon = createAnimatedIcon(
  "WindIcon",
  (controls) => (
    <>
      {GUSTS.map((gust) => (
        <motion.path
          key={gust.d}
          d={gust.d}
          custom={gust.delay}
          initial="normal"
          animate={controls}
          variants={GUST_VARIANTS}
        />
      ))}
    </>
  ),
  { size: 28 },
);
