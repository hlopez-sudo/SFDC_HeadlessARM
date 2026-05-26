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
            Select the Account to use. When Creating Quotes, Orders, etc., this Account will be
            used.
          </li>
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
        <p className={local.intro}>
          Select the Product Categories you wish to display in the Product Search Page. Each
          Category selected will display all Active Products within each Category.
        </p>
        <p className={local.intro}>
          There is no need to select Product Selling Models or individual Products. This is
          leftover in the UI but can be ignored.
        </p>
      </section>
    </div>
  )
}
