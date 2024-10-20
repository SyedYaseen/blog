import Link from 'next/link';
import styles from './hero.module.css'

export default function Hero() {
  const headlineOne = 'Syed Yaseen'
  const subtitleOne = 'I am constantly learning and I like to share it here. More like a log than a educational content, but it might be useful to someone atleast'
  const subtitleTwo = 'p.s. the bit about constantly learning, don\'t do it if you can help it, its a pain in rear'
  const cta = 'Read posts'

  return (
    <div className={styles.root}>
      <div className={styles.tilesBg}></div>
      <div className={styles.tiles}></div>
      <div className={styles.content}>
        <h1 className={styles.headline}>
          <p className={styles.head}>
            <span></span>
            <span>
              {headlineOne}<br className="max-md:_hidden" />

              <span className={styles.pops}>
                <span className={styles.pop}></span>
                <span className={styles.pop}></span>
                <span className={styles.pop}></span>
                <span className={styles.pop}></span>
                <span className={styles.pop}></span>
              </span>
            </span>
            <span></span>
          </p>
        </h1>
        <p className={styles.subtitle}>
          {subtitleOne}
        </p>
        <p className={styles.subtitle + ' text-sm'}>{subtitleTwo}</p>
        <div className={styles.actions}>
          <Link className={styles.cta} href={`$docs`}>
            {cta} <span>→</span>
          </Link>
          <Link
            className={styles.secondaryAction}
            href="https://github.com/syedyaseen"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub <span>↗</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
