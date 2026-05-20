import type { ReactNode } from 'react'
import { TopNav } from '../navigation/TopNav'
import { Sidebar } from '../navigation/Sidebar'
import { QuoteCartModal } from '../quote/QuoteCartModal'
import styles from './AppShell.module.css'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <TopNav />
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>{children}</main>
      </div>
      <QuoteCartModal />
    </div>
  )
}
