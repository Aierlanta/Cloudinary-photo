'use client'

import LogViewer from '@/components/admin/LogViewer'
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import { Flower2 } from 'lucide-react'
import { OrnateIcon } from '@/components/ui/ornate-icon'
import styles from '../admin-pages.module.css'

export default function SystemLogsPage() {
  const { t } = useLocale()

  return (
    <div className={cn(styles.page, styles.fillHeight, 'admin-logs-page')}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>
            <span>{t.adminUi.accessLogs}</span>
            <OrnateIcon icon={Flower2} tone="pink" size="sm" className={styles.heroIconBadge} />
          </h1>
          <p className={styles.heroSubtitle}>{t.adminLogs.description}</p>
        </div>
      </header>

      <section className={styles.panel}>
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
          <LogViewer maxEntries={7} autoRefresh={true} refreshInterval={5000} />
        </div>
      </section>
    </div>
  )
}
