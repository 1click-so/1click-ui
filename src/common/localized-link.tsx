"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import React from "react"

type LocalizedLinkProps = {
  children?: React.ReactNode
  href: string
  className?: string
  onClick?: () => void
  passHref?: true
  [x: string]: any
}

const LocalizedLink = ({
  children,
  href,
  ...props
}: LocalizedLinkProps) => {
  const { countryCode } = useParams()

  return (
    <Link href={`/${countryCode}${href}`} {...props}>
      {children}
    </Link>
  )
}

export default LocalizedLink
