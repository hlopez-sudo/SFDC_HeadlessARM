import { useState } from 'react'
import { Server } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CatalogProduct } from '../../catalog/types'
import styles from './ProductTile.module.css'

type ProductTileProps = {
  product: CatalogProduct
  viewMode?: 'tiles' | 'list'
}

export function ProductTile({ product, viewMode = 'tiles' }: ProductTileProps) {
  const detailPath = `/products/${product.id}`
  const [imgFailed, setImgFailed] = useState(false)
  const isListView = viewMode === 'list'

  const showImg = Boolean(product.imageUrl.trim()) && !imgFailed

  return (
    <article className={`${styles.article} ${isListView ? styles.articleList : ''}`}>
      <div className={`${styles.imageWrap} ${isListView ? styles.imageWrapList : ''}`}>
        <div className={`${styles.imageArea} ${isListView ? styles.imageAreaList : ''}`} aria-hidden>
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

      <div className={`${styles.body} ${isListView ? styles.bodyList : ''}`}>
        {product.family && <p className={styles.family}>{product.family}</p>}

        <h3 className={styles.title}>
          <Link className={styles.titleLink} to={detailPath}>
            {product.name}
          </Link>
        </h3>

        {product.description && <p className={`${styles.description} ${isListView ? styles.descriptionList : ''}`}>{product.description}</p>}

        <div className={`${styles.footer} ${isListView ? styles.footerList : ''}`}>
          <Link className={styles.cta} to={detailPath}>
            View details
          </Link>
        </div>
      </div>
    </article>
  )
}
