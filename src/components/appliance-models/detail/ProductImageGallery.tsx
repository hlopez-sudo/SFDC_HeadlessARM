import styles from './ProductImageGallery.module.css'

type GalleryImage = { src: string; alt: string }

type ProductImageGalleryProps = {
  images: readonly GalleryImage[]
  activeIndex: number
  onSelectIndex: (index: number) => void
}

export function ProductImageGallery({
  images,
  activeIndex,
  onSelectIndex,
}: ProductImageGalleryProps) {
  const main = images[activeIndex] ?? images[0]

  if (!main) {
    return null
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.main}>
        <img className={styles.mainImg} src={main.src} alt={main.alt} />
      </div>
      <div className={styles.thumbs} role="group" aria-label="Product images">
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            className={`${styles.thumb} ${i === activeIndex ? styles.thumbActive : ''}`}
            onClick={() => onSelectIndex(i)}
            aria-label={`Show image ${i + 1}: ${img.alt}`}
            aria-pressed={i === activeIndex}
          >
            <img className={styles.thumbImg} src={img.src} alt="" />
          </button>
        ))}
      </div>
    </div>
  )
}
