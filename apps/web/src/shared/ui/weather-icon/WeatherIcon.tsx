import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib";
import { type WeatherData } from "@/shared/api";
import {
  AnimatedIcon,
  CloudLightningIcon,
  CloudRainIcon,
  CloudSnowIcon,
  CloudSunIcon,
  MoonIcon,
  SunIcon,
  WindIcon,
  type AnimatedIconComponent,
  type AnimatedIconPlay,
  type AnimatedIconTrigger,
} from "@/shared/ui/animated-icons";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

export interface WeatherIconProps {
  data?: WeatherData | null;
  size?: number;
  className?: string;
  /** What starts the animation. Defaults to `"hover"`. */
  trigger?: AnimatedIconTrigger;
  /** How long the animation runs once triggered. Defaults to `"once"`. */
  play?: AnimatedIconPlay;
}

/** Maps OpenWeather condition codes to lucide-animated glyphs. Night sky
 * conditions collapse to the moon since the animated set has no cloud-moon
 * variant; atmospheric codes (mist/fog/haze) use the wind glyph. */
const CONDITION_ICONS: Record<string, AnimatedIconComponent> = {
  "01d": SunIcon,
  "01n": MoonIcon,
  "02d": CloudSunIcon,
  "02n": MoonIcon,
  "03d": CloudSunIcon,
  "03n": MoonIcon,
  "04d": CloudSunIcon,
  "04n": MoonIcon,
  "09d": CloudRainIcon,
  "09n": CloudRainIcon,
  "10d": CloudRainIcon,
  "10n": CloudRainIcon,
  "11d": CloudLightningIcon,
  "11n": CloudLightningIcon,
  "13d": CloudSnowIcon,
  "13n": CloudSnowIcon,
  "50d": WindIcon,
  "50n": WindIcon,
};

export function WeatherIcon({
  data,
  size = 24,
  className,
  trigger = "hover",
  play = "once",
}: WeatherIconProps) {
  const { t, i18n } = useTranslation("planner");

  if (!data) return null;

  const formatTemp = (value: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: "unit",
      unit: "celsius",
      maximumFractionDigits: 0,
    }).format(value);

  const formatPercent = (value: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value / 100);

  const formatSpeed = (value: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: "unit",
      unit: "meter-per-second",
      maximumFractionDigits: 1,
    }).format(value);

  const description =
    data.description.charAt(0).toUpperCase() + data.description.slice(1);

  const icon = CONDITION_ICONS[data.icon] ?? CloudSunIcon;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-label={description}
            className={cn(
              "inline-flex flex-none cursor-help items-center justify-center text-muted-foreground transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:scale-110 focus:outline-none",
              className,
            )}
            style={{ width: size, height: size }}
          />
        }
      >
        <AnimatedIcon
          icon={icon}
          size={size}
          trigger={trigger}
          play={play}
          aria-hidden
        />
      </TooltipTrigger>
      <TooltipPopup className="max-w-56">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium capitalize">{description}</span>
          <span className="tabular-nums">
            {t("weather.tooltip.temp")}: {formatTemp(data.temp)}
          </span>
          <span className="tabular-nums">
            {t("weather.tooltip.feelsLike")}: {formatTemp(data.feelsLike)}
          </span>
          <span className="tabular-nums">
            {t("weather.tooltip.humidity")}: {formatPercent(data.humidity)}
          </span>
          <span className="tabular-nums">
            {t("weather.tooltip.wind")}: {formatSpeed(data.windSpeed)}
          </span>
        </div>
      </TooltipPopup>
    </Tooltip>
  );
}
