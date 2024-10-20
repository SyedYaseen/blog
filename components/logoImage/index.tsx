import styles from './style.module.css'
import Image from 'next/image'
import type { ComponentProps, ReactElement } from 'react'

const Logo = (props: ComponentProps<'svg'>): ReactElement => (
  <div className='h-[25px] w-[25px]'>
    <Image alt='logo' width={35} height={40}  src="./img/SyedYaseenLogoWhite.png" />
  </div>
)



export function LogoTitle() {
  return (<Logo />)
}
