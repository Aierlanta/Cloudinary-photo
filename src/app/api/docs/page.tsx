"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Copy,
  CheckCircle2,
  Terminal,
  BookOpen,
  AlertTriangle,
  Info,
  ShieldCheck,
  Server,
  FileJson,
  ArrowLeft,
  Image as ImageIcon,
} from "lucide-react";
import { useLocale, LocaleProvider } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

// --- Components ---
const GlassCard = ({
  children,
  className,
  hover = false, // Default false for docs usually
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) => {
  return (
    <motion.div
      variants={itemVariants} // Ensure it participates in stagger
      whileHover={hover ? { y: -5, scale: 1.01 } : undefined}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-lg transition-colors",
        "dark:border-white/10 dark:bg-slate-900/30",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-50" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

function APIDocsContent() {
  const { t } = useLocale();
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);

  const generateBaseUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.protocol}//${window.location.host}`;
  };

  useEffect(() => {
    setBaseUrl(generateBaseUrl());
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Helper for copy buttons
  const CopyButton = ({ text, id }: { text: string; id: string }) => (
     <button
      onClick={() => copyToClipboard(text, id)}
      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105 active:scale-95"
      title={t.common.copy}
    >
      {copied === id ? (
        <CheckCircle2 className="w-4 h-4 text-green-400" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen relative overflow-x-hidden selection:bg-primary/30 pb-20">
      {/* Background Elements */}
       <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/10 to-transparent opacity-30" />
       </div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl h-16 flex items-center">
         <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
               <ArrowLeft className="w-4 h-4" />
               {t.common.back}
            </Link>
            <span className="font-bold">{t.apiDocs.title}</span>
            <div className="w-16" /> {/* Spacer for centering */}
         </div>
      </nav>

      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/60">
              {t.apiDocs.title}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t.apiDocs.subtitle}
            </p>
          </motion.div>

          {/* Access Links */}
          <GlassCard className="p-6 sm:p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
               <Server className="w-6 h-6 text-primary" />
               {t.apiDocs.apiAccessLinks}
            </h2>
            <div className="space-y-4">
               <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">{t.apiDocs.baseApiAddress}</h3>
                  <div className="flex items-center gap-2 bg-slate-950/50 rounded-xl p-2 pl-4 border border-white/10">
                     <code className="flex-1 font-mono text-sm text-blue-300 truncate">{baseUrl}/api/random</code>
                     {baseUrl && <CopyButton text={`${baseUrl}/api/random`} id="base-url" />}
                  </div>
               </div>
            </div>
          </GlassCard>

           {/* Auth */}
          <GlassCard className="p-6 sm:p-8 border-blue-500/20 bg-blue-500/5">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-500">
               <ShieldCheck className="w-6 h-6" />
               {t.apiDocs.apiKeyAuth}
            </h2>
            <div className="space-y-4 text-muted-foreground">
               <p>{t.apiDocs.apiKeyAuthDesc}</p>
               <div className="flex items-center gap-2 bg-slate-950/50 rounded-xl p-3 pl-4 border border-white/10">
                  <code className="flex-1 font-mono text-sm text-slate-300">
                     {baseUrl}/api/random<span className="text-blue-400">?key=your-api-key</span>
                  </code>
               </div>
               <p className="text-sm opacity-80 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  {t.apiDocs.apiKeyConfigTip}
               </p>
            </div>
          </GlassCard>

          {/* Usage Examples */}
          <GlassCard className="p-6 sm:p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
               <Terminal className="w-6 h-6 text-secondary" />
               {t.apiDocs.usageExamples}
            </h2>
            
            <div className="space-y-8">
               {/* Redirect */}
               <div>
                  <h3 className="font-semibold mb-3 text-lg">{t.apiDocs.redirectMode}</h3>
                   <div className="flex items-center gap-2 bg-slate-950/50 rounded-xl p-2 pl-4 border border-white/10">
                     <code className="flex-1 font-mono text-sm text-slate-300">{baseUrl}/api/random</code>
                     {baseUrl && <CopyButton text={`${baseUrl}/api/random`} id="ex-redirect" />}
                  </div>
               </div>

               {/* JSON */}
               <div>
                  <h3 className="font-semibold mb-3 text-lg">{t.apiDocs.directResponseMode}</h3>
                   <div className="flex items-center gap-2 bg-slate-950/50 rounded-xl p-2 pl-4 border border-white/10">
                     <code className="flex-1 font-mono text-sm text-slate-300">{baseUrl}/api/response</code>
                     {baseUrl && <CopyButton text={`${baseUrl}/api/response`} id="ex-json" />}
                  </div>
               </div>

               {/* Params */}
               <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                     <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase">{t.apiDocs.withParamsR18}</h3>
                     <div className="flex items-center gap-2 bg-slate-950/50 rounded-xl p-2 pl-4 border border-white/10">
                        <code className="flex-1 font-mono text-xs sm:text-sm text-slate-300">.../random<span className="text-red-400">?r18=true</span></code>
                        {baseUrl && <CopyButton text={`${baseUrl}/api/random?r18=true`} id="ex-r18" />}
                     </div>
                  </div>
                  <div>
                     <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase">{t.apiDocs.withParamsSfw}</h3>
                     <div className="flex items-center gap-2 bg-slate-950/50 rounded-xl p-2 pl-4 border border-white/10">
                        <code className="flex-1 font-mono text-xs sm:text-sm text-slate-300">.../random<span className="text-green-400">?sfw=true</span></code>
                        {baseUrl && <CopyButton text={`${baseUrl}/api/random?sfw=true`} id="ex-sfw" />}
                     </div>
                  </div>
               </div>
            </div>
          </GlassCard>

          {/* Orientation & Resize */}
          <GlassCard className="p-6 sm:p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-primary" />
              {t.apiDocs.orientationAndSize}
            </h2>

            <div className="space-y-6 text-sm text-muted-foreground">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">{t.apiDocs.orientationTitle}</h3>
                <p>{t.apiDocs.orientationDesc}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>`orientation` = `landscape` | `portrait` | `square`</li>
                  <li>{t.apiDocs.orientationNote}</li>
                </ul>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { id: "ori-random", label: t.apiDocs.exampleLandscapeRandom, url: "/api/random?orientation=landscape" },
                    { id: "ori-response", label: t.apiDocs.exampleLandscapeResponse, url: "/api/response?orientation=landscape" },
                  ].map((ex) => (
                    <div key={ex.id} className="bg-slate-950/50 rounded-xl p-2 pl-4 border border-white/10 flex items-center gap-2">
                      <code className="flex-1 font-mono text-xs sm:text-sm text-slate-300 truncate">
                        {baseUrl}
                        {ex.url}
                      </code>
                      {baseUrl && <CopyButton text={`${baseUrl}${ex.url}`} id={ex.id} />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">{t.apiDocs.resizeTitle}</h3>
                <p>{t.apiDocs.resizeDesc}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>`width` / `height` {t.apiDocs.resizeWidthHeight}</li>
                  <li>`fit` = `cover` | `contain` ({t.apiDocs.resizeFitDefault})</li>
                </ul>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { id: "resize-cover", label: t.apiDocs.exampleResizeCover, url: "/api/response?width=800&height=600&fit=cover" },
                    { id: "resize-contain", label: t.apiDocs.exampleResizeContain, url: "/api/response?width=800&height=600&fit=contain" },
                  ].map((ex) => (
                    <div key={ex.id} className="bg-slate-950/50 rounded-xl p-2 pl-4 border border-white/10 flex items-center gap-2">
                      <code className="flex-1 font-mono text-xs sm:text-sm text-slate-300 truncate">
                        {baseUrl}
                        {ex.url}
                      </code>
                      {baseUrl && <CopyButton text={`${baseUrl}${ex.url}`} id={ex.id} />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Transparency */}
          <GlassCard className="p-6 sm:p-8">
             <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
               <BookOpen className="w-6 h-6 text-accent" />
               {t.apiDocs.transparencyAdjustment}
            </h2>
            <p className="text-muted-foreground mb-6">
               {t.apiDocs.transparencyIntro}
            </p>

            <div className="space-y-6">
               <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="font-bold mb-4">{t.apiDocs.parameterDescription}</h3>
                  <ul className="space-y-4">
                     <li className="flex gap-4">
                        <code className="text-sm font-mono text-primary bg-primary/10 px-2 py-1 rounded h-fit">opacity</code>
                        <div>
                           <p className="text-sm">{t.apiDocs.opacityDesc}</p>
                           <p className="text-xs text-muted-foreground mt-1">{t.apiDocs.opacityDetails}</p>
                        </div>
                     </li>
                     <li className="flex gap-4">
                        <code className="text-sm font-mono text-secondary bg-secondary/10 px-2 py-1 rounded h-fit">bgColor</code>
                        <div>
                           <p className="text-sm">{t.apiDocs.bgColorDesc}</p>
                           <p className="text-xs text-muted-foreground mt-1 font-mono">white | black | #hex</p>
                        </div>
                     </li>
                  </ul>
               </div>

               <div>
                  <h3 className="font-bold mb-4">{t.apiDocs.examples}</h3>
                  <div className="space-y-3">
                     {[
                        { desc: t.apiDocs.opacity50White, url: "/api/response?opacity=0.5&bgColor=white", id: "op-1" },
                        { desc: t.apiDocs.opacity80Black, url: "/api/response?opacity=0.8&bgColor=black", id: "op-2" },
                        { desc: t.apiDocs.opacity30Custom, url: "/api/response?opacity=0.3&bgColor=ff6b6b", id: "op-3" },
                     ].map((item) => (
                        <div key={item.id}>
                           <p className="text-xs text-muted-foreground mb-1">{item.desc}</p>
                           <div className="flex items-center gap-2 bg-slate-950/50 rounded-xl p-2 pl-4 border border-white/10">
                              <code className="flex-1 font-mono text-xs sm:text-sm text-slate-300 truncate">{baseUrl}{item.url}</code>
                              {baseUrl && <CopyButton text={`${baseUrl}${item.url}`} id={item.id} />}
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          </GlassCard>

          {/* Response Format */}
          <GlassCard className="p-6 sm:p-8">
             <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
               <FileJson className="w-6 h-6 text-orange-500" />
               {t.apiDocs.responseFormat}
            </h2>
            
            <div className="space-y-6">
               <div>
                  <h3 className="font-bold text-green-500 mb-2">{t.apiDocs.successResponse} (200 OK)</h3>
                  <div className="bg-slate-950/50 rounded-xl p-4 border border-white/10 font-mono text-sm text-slate-300">
                     <p><span className="text-blue-400">Content-Type:</span> image/jpeg, image/png, image/webp</p>
                     <div className="h-px bg-white/10 my-2" />
                     <p className="text-muted-foreground mb-1">{"// Headers"}</p>
                     <p><span className="text-purple-400">X-Image-Id:</span> ...</p>
                     <p><span className="text-purple-400">X-Image-Filename:</span> ...</p>
                     <p><span className="text-purple-400">X-Response-Time:</span> ...ms</p>
                  </div>
               </div>

               <div>
                  <h3 className="font-bold text-red-500 mb-2">{t.apiDocs.errorResponse}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                     {[
                        { code: 400, label: t.apiDocs.badRequest },
                        { code: 403, label: t.apiDocs.forbidden },
                        { code: 404, label: t.apiDocs.notFound },
                        { code: 429, label: t.apiDocs.tooManyRequests },
                        { code: 500, label: t.apiDocs.internalError },
                     ].map(err => (
                        <div key={err.code} className="flex items-center gap-2 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                           <span className="font-mono font-bold text-red-500">{err.code}</span>
                           <span className="text-muted-foreground">{err.label}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          </GlassCard>

          {/* Notices */}
           <GlassCard className="p-6 sm:p-8 border-yellow-500/20 bg-yellow-500/5">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-500">
               <AlertTriangle className="w-6 h-6" />
               {t.apiDocs.notice}
            </h2>
            <ul className="space-y-3 text-sm">
               <li className="flex gap-3">
                  <span className="font-bold text-yellow-500 min-w-fit">{t.apiDocs.rateLimit}</span>
                  <span className="text-muted-foreground">{t.apiDocs.rateLimitDesc}</span>
               </li>
               <li className="flex gap-3">
                   <span className="font-bold text-blue-500 min-w-fit">{t.apiDocs.cache}</span>
                  <span className="text-muted-foreground">{t.apiDocs.cacheDesc}</span>
               </li>
               <li className="flex gap-3">
                   <span className="font-bold text-green-500 min-w-fit">{t.apiDocs.https}</span>
                  <span className="text-muted-foreground">{t.apiDocs.httpsDesc}</span>
               </li>
            </ul>
          </GlassCard>

        </motion.div>
      </main>
    </div>
  );
}

export default function APIDocsPage() {
  return (
    <LocaleProvider>
      <APIDocsContent />
    </LocaleProvider>
  );
}
