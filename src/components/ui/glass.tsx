"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Magnetic from "@/components/ui/magnetic";

// --- Animation Variants ---
export const cardHoverVariants = {
  hover: {
    y: -8,
    scale: 1.02,
    boxShadow: "0 20px 40px -10px rgba(0,0,0,0.2)",
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 20,
    },
  },
};

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
        "relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-lg transition-colors",
        "dark:border-white/10 dark:bg-slate-900/40",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500",
        noPadding ? "" : "p-6",
        className
      )}
      {...props}
    >
      {/* Noise texture overlay specifically for cards if needed, or rely on global */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-50 mix-blend-overlay" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

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
      whileHover={enableHover ? { scale: 1.05 } : undefined}
      whileTap={enableHover ? { scale: 0.96 } : undefined}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all shadow-md backdrop-blur-md relative overflow-hidden",
        primary
          ? "bg-primary text-white hover:shadow-primary/40 border border-primary/50"
          : "bg-white/10 hover:bg-white/20 text-foreground border border-white/20 dark:bg-white/5 dark:hover:bg-white/10",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
      {Icon && (
        <Icon className={cn("w-5 h-5 transition-transform", iconClassName ? iconClassName : "group-hover:rotate-12 group-hover:scale-110")} />
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

