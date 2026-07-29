"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Magnetic from "@/components/ui/magnetic";

// --- Animation Variants ---
export const cardHoverVariants = {
  hover: {
    y: -6,
    scale: 1.015,
    boxShadow: "var(--lift-shadow)" as unknown as string,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 20,
    },
  },
};

/**
 * PastelCard（原 GlassCard）
 * Galgame 风格卡片：白底、粉色描边、大圆角、柔和暖色投影
 */
export const GlassCard = ({
  children,
  className,
  hover = true,
  noPadding = false,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  noPadding?: boolean;
} & HTMLMotionProps<"div">) => {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");
  const enableHover = hover && !isAdminRoute;

  return (
    <motion.div
      variants={enableHover ? cardHoverVariants : undefined}
      whileHover={enableHover ? "hover" : undefined}
      className={cn(
        "relative overflow-hidden rounded-3xl border-2 border-border bg-card shadow-soft transition-shadow",
        noPadding ? "" : "p-6",
        className
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

/**
 * PastelButton（原 GlassButton）
 * 圆润饱满的糖果按钮：primary 为樱花粉填充 + 白色内描边，次要为白底粉边
 */
export const GlassButton = ({
  children,
  onClick,
  primary = false,
  icon: Icon,
  iconClassName,
  className,
  magnetic = true,
  ...props
}: any) => {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");
  const enableMagnetic = !isAdminRoute && magnetic;
  const enableHover = !isAdminRoute;

  const button = (
    <motion.button
      whileHover={enableHover ? { scale: 1.04, y: -1 } : undefined}
      whileTap={enableHover ? { scale: 0.95 } : undefined}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-shadow shadow-soft relative",
        primary
          ? "bg-primary text-white ring-2 ring-white/70 ring-inset hover:shadow-lift"
          : "bg-card text-foreground border-2 border-border hover:border-primary hover:shadow-lift",
        className
      )}
      {...props}
    >
      {Icon && (
        <Icon
          className={cn(
            "w-5 h-5 transition-transform",
            iconClassName ? iconClassName : "group-hover:scale-110 group-hover:-rotate-6"
          )}
        />
      )}
      {children}
    </motion.button>
  );

  // 管理后台默认关闭磁吸效果；其他页面如需也可通过 magnetic={false} 关闭
  if (!enableMagnetic) {
    return button;
  }

  return <Magnetic>{button}</Magnetic>;
};
