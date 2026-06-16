import styles from './AdminPage.module.css'
import local from './AdminReadmePage.module.css'

export function AdminReadmePage() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Read Me</h1>

      <section className={local.card} aria-labelledby="readme-sf-heading">
        <h2 id="readme-sf-heading" className={local.cardTitle}>
          Salesforce Configuration
        </h2>
        <p className={local.body}>
          Log in to your org. The Pricing, Product Catalog, and Defaults are all configured
          specifically to QuantumBit environments created via Storm. Customizations are not currently
          configurable in the app directly and will have to be done directly in the Repository
          Workbook.
        </p>
        <p className={local.body}>
          Select the Account to use. When Creating Quotes, Orders, etc., this Account will be used.
          Records will be created on the Account in Salesforce. Quote, Orders, and Assets will be
          visible in the "My Account" Section.
        </p>
        <p className={local.body}>
          In "Headless Pricing Configuration" populate the required fields using the lookup icon and
          corresponding help text for: <strong>ContextDefinitionId</strong>,{' '}
          <strong>ContextMappingId</strong>, <strong>PricingProcedureAPIName</strong>, and{' '}
          <strong>Pricebook</strong>. Revert to Defaults will default the values corresponding to
          the inline prompts.
        </p>
      </section>

      <section className={local.card} aria-labelledby="readme-catalog-heading">
        <h2 id="readme-catalog-heading" className={local.cardTitle}>
          Product Catalog
        </h2>
        <p className={local.body}>
          Select the Product Categories you wish to display in the Product Search Page. Each
          Category selected will display all Active Products within each Category.
        </p>
        <p className={local.body}>
          There is no need to select Product Selling Models or individual Products. This is leftover
          in the UI but can be ignored.
        </p>
      </section>

      <section className={local.card} aria-labelledby="readme-general-heading">
        <h2 id="readme-general-heading" className={local.cardTitle}>
          General
        </h2>
        <p className={local.body}>
          To show Product Led Growth (PLG) use cases in addition to B2B, there is an "Enable PLG"
          checkbox in the General Config section. This will hard-code 4 products for "Trial",
          "Professional", "Enterprise" and "Custom". Any product should be available but
          corresponding Monthly/Annual Selling Models may not always be available depending on the
          Products you select. It could be worth configuring some new products in your QuantumBit
          Org to show a simple License-Subscription with Volume Based Pricing.
        </p>
      </section>
    </div>
  )
}
