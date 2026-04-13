import { ChevronRight, Server } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ApplianceModel } from '../../data/appliance-models'
import styles from './ApplianceModelTile.module.css'

function parseThreatProtection(tp: string): { value: string; unit: string } {
  const parts = tp.trim().split(/\s+/)
  if (parts.length >= 2) {
    return {
      value: parts.slice(0, -1).join(' '),
      unit: parts[parts.length - 1] ?? '',
    }
  }
  return { value: tp, unit: '' }
}

type ApplianceModelTileProps = {
  model: ApplianceModel
}

export function ApplianceModelTile({ model }: ApplianceModelTileProps) {
  const { value: metricNum, unit: metricUnit } = parseThreatProtection(
    model.threatProtection,
  )
  const detailPath = `/appliance-models/${model.slug}`

  const specLines = [
    `Threat protection: ${model.threatProtection}`,
    'Product datasheet included',
    model.hasVideo ? 'Video overview available' : 'Video overview not listed',
  ]

  return (
    <article className={styles.article}>
      <div className={styles.imageWrap}>
        {model.hasDetailPage && (
          <div className={styles.badges} aria-hidden>
            <span className={`${styles.badge} ${styles.badgeSolid}`}>7000F series</span>
            <span className={`${styles.badge} ${styles.badgeOutline}`}>In-app details</span>
          </div>
        )}
        <div className={styles.imageArea} aria-hidden>
          <Server size={56} strokeWidth={1.25} />
        </div>
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>
          {model.hasDetailPage ? (
            <Link className={styles.titleLink} to={detailPath}>
              {model.name}
            </Link>
          ) : (
            <span>{model.name}</span>
          )}
        </h3>

        <ul className={styles.specs}>
          {specLines.map((line) => (
            <li key={line} className={styles.specRow}>
              <ChevronRight className={styles.specIcon} size={14} strokeWidth={2.5} aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <div className={styles.footer}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Threat protection</span>
            <p className={styles.metricValue}>
              {metricNum}
              {metricUnit ? (
                <span className={styles.metricUnit}>{metricUnit}</span>
              ) : null}
            </p>
          </div>

          {model.hasDetailPage ? (
            <Link className={styles.cta} to={detailPath}>
              View details
            </Link>
          ) : (
            <button type="button" className={`${styles.cta} ${styles.ctaDisabled}`} disabled>
              View details
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
