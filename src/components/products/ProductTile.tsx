import { useState } from 'react'
import { Server } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CatalogProduct } from '../../catalog/types'
import styles from './ProductTile.module.css'

type ProductTileProps = {
  product: CatalogProduct
}

export function ProductTile({ product }: ProductTileProps) {
  const detailPath = `/appliance-models/${product.id}`
  const [imgFailed, setImgFailed] = useState(false)

  const showImg = Boolean(product.imageUrl.trim()) && !imgFailed

  return (
    <article className={styles.article}>
      <div className={styles.imageWrap}>
        <div className={styles.imageArea} aria-hidden>
          {showImg ? (
            <img
              className={styles.tileImg}
              src={product.imageUrl}
              alt={product.name}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <Server size={56} strokeWidth={1.25} />
          )}
        </div>
      </div>

      <div className={styles.body}>
        {product.family && <p className={styles.family}>{product.family}</p>}

        <h3 className={styles.title}>
          <Link className={styles.titleLink} to={detailPath}>
            {product.name}
          </Link>
        </h3>

        {product.description && (
          <p className={styles.description}>{product.description}</p>
        )}

        <div className={styles.footer}>
          <Link className={styles.cta} to={detailPath}>
            View details
          </Link>
        </div>
      </div>
    </article>
  )
}
