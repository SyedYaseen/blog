import Link from 'next/link';
import styles from './feature.module.css'

export default function Feature() {

  return (
    <div className={styles.container}>
      <div className={`${styles.panel} ${styles['feature-table']}`}>
        <div className={styles['feature-plan']}>
 
          <ul className={styles['feature-desc']}>
            <li key='1' className={styles['feature-desc-item']}>Custom Path</li>
            <li key='2' className={styles['feature-desc-item']}>Multi Path</li>
            <li key='3' className={styles['feature-desc-item']}>Package Prefix</li>
            <li key='4' className={styles['feature-desc-item']}>Package Cache</li>
          </ul>
        </div>
        <div className={styles['feature-plan']}>
   
          <ul className={styles['feature-desc']}>
            <li key='1' className={styles['feature-desc-item']}>Proxy Cache</li>
            <li key='2' className={styles['feature-desc-item']}>Promisify</li>
            <li key='3' className={styles['feature-desc-item']}>Async Stream</li>
            <li key='4' className={styles['feature-desc-item']}>Middleware</li>
          </ul>
        </div>
        <div className={styles['feature-plan']}>

          <ul className={styles['feature-desc']}>
            <li key='1' className={styles['feature-desc-item']}>Call Proxy</li>
            <li key='2' className={styles['feature-desc-item']}>Promisify</li>
            <li key='3' className={styles['feature-desc-item']}>Async Stream</li>
            <li key='4' className={styles['feature-desc-item']}>Middleware</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
