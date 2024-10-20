import type { AppProps } from 'next/app'
import type { ReactElement } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/next'
// import { Analytics } from '@vercel/analytics/react';
import '../style.css'
import {Nunito_Sans} from 'next/font/google'
const nunito = Nunito_Sans({
  subsets: ['latin'],
})
export default function App({ Component, pageProps }: AppProps): ReactElement {
  return (
    <main className={nunito.className}>
      <Component {...pageProps} />
      <SpeedInsights />
      {/* <Analytics /> */}
    </main>
  )
}