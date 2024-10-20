
import type { DocsThemeConfig } from 'nextra-theme-docs'
import { LocaleSwitch, useConfig, ThemeSwitch } from 'nextra-theme-docs'
import Footer from '@components/footer'
import { LogoTitle } from '@components/logoImage'

const config: DocsThemeConfig = {
  logo: () => {

    
    return (
      <a className='_flex _items-center hover:_opacity-75 ltr:_mr-auto rtl:_ml-auto' href={'/en'}>
        <span className='logo'><LogoTitle /> Yaseen</span>
      </a>
    )
  },
  logoLink: false,
  project: {
    link: 'https://github.com/syedyaseen',
  },
  docsRepositoryBase: 'https://github.com/syedyaseen',
  head: () => {
    const config = useConfig()
 

    const description =
      config.frontMatter.description ||
      'gPRCity is a simple, easy-to-use, and advanced gRPC microservices library based on Node.js.'
    const title = config.title

    return (
      <>
        <title>{title}</title>
        <meta property="og:title" content={title} />
        <meta name="description" content={description} />
        <meta property="og:description" content={description} />
        <link rel="icon" href="/img/favicon.png" type="image/png" />
        <link
          rel="icon"
          href="/img/favicon-dark.png"
          type="image/png"
          media="(prefers-color-scheme: dark)"
        />
        <meta name="apple-mobile-web-app-title" content="gRPCity" />
      </>
    )
  },
  footer: {
    content: () => {
      

      return (
        <>
          <Footer/>
        </>
      )
    }
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true
  },
  navbar: {
    extraContent: () => {
      return (
        <>
          {ThemeSwitch({ lite: true, className: 'button-switch theme-switch' })}
          {LocaleSwitch({ lite: true, className: 'button-switch' })}
        </>
      )
    }
  },
  toc: {
    backToTop: true
  },
  banner: {
    key: '2.0-release',
    content: (
      <a href="https://github.com/syedyaseen" target="_blank">
        🎉 Hey you made it! Try not to steal too much from here
      </a>
    )
  }
}

export default config
