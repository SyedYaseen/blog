import styles from './style.module.css'

export default function Footer() {



  return (
    <>
    <div className={`${styles.root} _flex _text-sm`}>
      <div className={`${styles['w-1-4']}`}>
        © {new Date().getFullYear()} gRPCity.
      </div>
      <div className={`${styles.columns} ${styles['w-3-4']}`}>
        Footer
      </div>
    </div>
    </>
  )
}