import type { DocsThemeConfig } from 'nextra-theme-docs'
import { useConfig, ThemeSwitch } from 'nextra-theme-docs'
import Footer from '@components/footer'
import { LogoTitle } from '@components/logoImage'

const config: DocsThemeConfig = {
  search: {
    placeholder: "Search blog"
  },
  logo: () => {    
    return (
      <a className='hover:_opacity-75 ltr:_mr-auto rtl:_ml-auto' href={'/'}>
        <span className='logo'><LogoTitle /> </span>
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
 

    const description = config.frontMatter.description 
    const title = config.title

    return (
      <>
        <title>{title}</title>
        <meta property="og:title" content={title} />
        <meta name="description" content={description} />
        <meta property="og:description" content={description} />
        <link rel="icon" href="/img/favicon.ico" type="image/png" />
        <link
          rel="icon"
          href="/img/favicon-dark.ico"
          type="image/png"
          media="(prefers-color-scheme: dark)"
        />
        <meta name="apple-mobile-web-app-title" content="CompileAndCry" />
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
        🎉 Hey you made it!!!
      </a>
    )
  }
}

export default config
