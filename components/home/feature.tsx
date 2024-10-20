import styles from './feature.module.css'

export default function Feature() {

  return (
    <div className={styles.container}>
      <div className={`${styles.panel} ${styles['feature-table']}`}>
        Recent Posts
      </div>
      
    </div>
  )
}
