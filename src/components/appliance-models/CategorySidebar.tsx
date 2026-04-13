import { Building2, Cloud, Router, Server } from 'lucide-react'
import type { CategoryId } from '../../data/appliance-models'
import { categories } from '../../data/appliance-models'
import styles from './CategorySidebar.module.css'

const icons: Record<CategoryId, typeof Server> = {
  'data-center': Server,
  campus: Building2,
  branch: Router,
  fgaas: Cloud,
}

type CategorySidebarProps = {
  activeId: CategoryId
  onSelect: (id: CategoryId) => void
}

export function CategorySidebar({ activeId, onSelect }: CategorySidebarProps) {
  return (
    <div className={styles.rail} role="tablist" aria-label="Product categories">
      {categories.map((cat) => {
        const Icon = icons[cat.id]
        const selected = activeId === cat.id
        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`${styles.card} ${selected ? styles.cardActive : ''}`}
            onClick={() => onSelect(cat.id)}
          >
            <span className={styles.thumb} aria-hidden>
              <Icon size={28} strokeWidth={1.5} />
            </span>
            <span className={styles.label}>{cat.label}</span>
          </button>
        )
      })}
    </div>
  )
}
