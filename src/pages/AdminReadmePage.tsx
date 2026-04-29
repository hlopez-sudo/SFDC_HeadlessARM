import styles from './AdminPage.module.css'
import local from './AdminReadmePage.module.css'

export function AdminReadmePage() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>README</h1>
      <p className={local.intro}>
        Quick steps for configuring Salesforce and the product catalog in this app.
      </p>

      <section className={local.section} aria-labelledby="readme-sf-heading">
        <h2 id="readme-sf-heading" className={local.sectionTitle}>
          Salesforce Configuration
        </h2>
        <ol className={local.list}>
          <li>Log in to your org.</li>
          <li>
            Populate the required fields using the lookup icon and corresponding help text for:{' '}
            <strong>ContextDefinitionId</strong>, <strong>ContextMappingId</strong>,{' '}
            <strong>PricingProcedureAPIName</strong>, and <strong>Pricebook</strong>.
          </li>
        </ol>
      </section>

      <section className={local.section} aria-labelledby="readme-catalog-heading">
        <h2 id="readme-catalog-heading" className={local.sectionTitle}>
          Product Catalog
        </h2>
        <ul className={local.list}>
          <li>
            Add values for Product Selling Model Options. Typically Term-Monthly, Term-Annual,
            One-Time. These will vary based on your product configuration.
          </li>
          <li>
            Add products directly from your connected org. These will add product tiles to the
            Products navigation page.
          </li>
        </ul>
      </section>
    </div>
  )
}
