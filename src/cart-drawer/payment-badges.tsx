"use client"

import type { ReactNode } from "react"

/**
 * CartPaymentBadges — row of small payment-method logos shown near the
 * checkout button.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-payment-badges.tsx.
 * Inline SVGs are kept so stores don't need to provide asset files for the
 * default set, but stores can pass their own badges map via the `badges`
 * prop to override.
 */

type BadgeKey = "visa" | "mastercard" | "applepay" | "googlepay" | "amex"

const defaultBadges: Record<BadgeKey, ReactNode> = {
  visa: (
    <svg viewBox="0 0 48 32" width="42" height="28" fill="none">
      <rect width="48" height="32" rx="4" fill="#fff" stroke="#e4e4e7" strokeWidth="1" />
      <path
        d="M20.3 21h-2.7l1.7-10.5h2.7L20.3 21zm-4.7 0l-2.5-7.2-.3-1.5c-.5-1.3-1.7-1.8-1.7-1.8h-.1l-1 .2L7 21h2.8l.6-1.5h3.4l.3 1.5h2.5zm-3.2-3.6l1.4-3.8.8 3.8h-2.2zM32 10.5L29.3 21h-2.5l1.5-8.2-.1-.2-2 8.4h-2l-2-8.4v.3L20.7 21h-2.4l2.8-10.5h3.4l1.7 7.2 1.7-7.2H32zm8.8 0L38 21h-2.5l2.8-10.5h2.5z"
        fill="#1a1f71"
      />
    </svg>
  ),
  mastercard: (
    <svg viewBox="0 0 48 32" width="42" height="28" fill="none">
      <rect width="48" height="32" rx="4" fill="#fff" stroke="#e4e4e7" strokeWidth="1" />
      <circle cx="19" cy="16" r="8" fill="#eb001b" />
      <circle cx="29" cy="16" r="8" fill="#f79e1b" />
      <path d="M24 9.8a8 8 0 010 12.4 8 8 0 000-12.4z" fill="#ff5f00" />
    </svg>
  ),
  applepay: (
    <svg viewBox="0 0 48 32" width="42" height="28" fill="none">
      <rect width="48" height="32" rx="4" fill="#000" />
      <g fill="#fff">
        <path d="M15.2 11.8c-.6.7-1.5 1.2-2.4 1.1-.1-1 .4-2 .9-2.6.6-.7 1.5-1.2 2.3-1.2.1 1-.3 2-.8 2.7zm.8 1.4c-1.3-.1-2.5.8-3.1.8s-1.6-.7-2.7-.7c-1.4 0-2.7.8-3.4 2.1-1.4 2.5-.4 6.2 1 8.2.7 1 1.5 2.1 2.6 2s1.4-.7 2.7-.7 1.6.7 2.7.7 1.8-1 2.5-2c.8-1.1 1.1-2.2 1.1-2.3-1.2-.5-2-1.8-2-3.3 0-1.3.7-2.5 1.8-3.1-.7-1-1.8-1.7-3.2-1.7z" />
        <path d="M25 12.5v10.8h1.7v-3.7h2.3c2.1 0 3.6-1.5 3.6-3.6s-1.5-3.5-3.5-3.5H25zm1.7 1.4h1.9c1.5 0 2.3.8 2.3 2.1s-.8 2.1-2.3 2.1h-1.9v-4.2zm8.8 9.5c1.1 0 2.1-.5 2.5-1.4h0v1.3H39.6v-5.2c0-1.8-1.4-2.9-3.5-2.9-2 0-3.4 1.1-3.4 2.8h1.6c.1-.8.9-1.4 1.8-1.4 1.2 0 1.8.5 1.8 1.5v.7l-2.4.1c-2.2.1-3.4 1-3.4 2.6 0 1.6 1.2 2.7 2.9 2.7v-.8zm.4-1.3c-1 0-1.7-.5-1.7-1.3 0-.8.6-1.3 1.8-1.4l2.1-.1v.7c0 1.2-1 2.1-2.2 2.1z" />
      </g>
    </svg>
  ),
  googlepay: (
    <svg viewBox="0 0 48 32" width="42" height="28" fill="none">
      <rect width="48" height="32" rx="4" fill="#fff" stroke="#e4e4e7" strokeWidth="1" />
      <path
        d="M23.5 16.7v3.1h-1v-7.6h2.7c.7 0 1.2.2 1.7.6.5.4.7.9.7 1.5s-.2 1.1-.7 1.5c-.5.4-1 .6-1.7.6h-1.7zm0-3.5v2.5h1.7c.4 0 .8-.2 1.1-.4.3-.3.4-.6.4-1s-.1-.7-.4-1c-.3-.3-.6-.4-1.1-.4h-1.7z"
        fill="#3c4043"
      />
      <path
        d="M30.6 14.2c.7 0 1.3.2 1.8.6.4.4.7 1 .7 1.7v3.3h-1v-.7c-.4.6-.9.9-1.6.9-.6 0-1.1-.2-1.5-.5-.4-.3-.6-.8-.6-1.3 0-.5.2-1 .5-1.3.4-.3.9-.5 1.5-.5.6 0 1.1.2 1.4.5v-.3c0-.4-.2-.7-.4-.9-.3-.2-.6-.4-1-.4-.6 0-1 .2-1.3.7l-.8-.5c.5-.7 1.1-1 2-1h.3zm-1 4.6c.3.2.6.3 1 .3s.7-.1 1-.3c.3-.2.4-.5.4-.8s-.1-.6-.4-.8c-.3-.2-.6-.3-1-.3s-.7.1-1 .3c-.3.2-.4.5-.4.8s.2.6.4.8z"
        fill="#3c4043"
      />
      <path d="M37 14.4l-2.4 5.5h-1l.9-1.9-1.6-3.6h1.1l1 2.5 1-2.5H37z" fill="#3c4043" />
      <path d="M18.3 16c0-.3 0-.6-.1-.9h-4.6v1.7h2.7c-.1.6-.4 1.1-.9 1.4v1.2h1.5c.9-.8 1.4-2 1.4-3.4z" fill="#4285f4" />
      <path d="M13.6 19.7c1.2 0 2.2-.4 3-1.1l-1.5-1.2c-.4.3-.9.4-1.5.4-1.2 0-2.1-.8-2.5-1.8H9.7v1.2c.7 1.5 2.2 2.5 3.9 2.5z" fill="#34a853" />
      <path d="M11.1 16c0-.3.1-.7.2-1v-1.2H9.7c-.4.7-.6 1.4-.6 2.2s.2 1.5.6 2.2l1.6-1.2c-.1-.3-.2-.7-.2-1z" fill="#fbbc04" />
      <path d="M13.6 12.2c.7 0 1.3.2 1.8.7l1.3-1.3c-.8-.8-1.9-1.2-3.1-1.2-1.7 0-3.2 1-3.9 2.5l1.6 1.2c.4-1.1 1.3-1.9 2.3-1.9z" fill="#ea4335" />
    </svg>
  ),
  amex: (
    <svg viewBox="0 0 48 32" width="42" height="28" fill="none">
      <rect width="48" height="32" rx="4" fill="#006fcf" />
      <text x="24" y="20" fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="Arial, sans-serif">
        AMEX
      </text>
    </svg>
  ),
}

type CartPaymentBadgesProps = {
  methods?: BadgeKey[]
  badges?: Partial<Record<BadgeKey, ReactNode>>
}

export function CartPaymentBadges({
  methods = ["visa", "mastercard", "googlepay", "applepay"],
  badges,
}: CartPaymentBadgesProps) {
  const resolved = { ...defaultBadges, ...badges }
  return (
    <div className="flex items-center justify-center gap-2 px-5 py-3">
      {methods.map((method) => (
        <div
          key={method}
          className="opacity-70 hover:opacity-100 transition-opacity"
        >
          {resolved[method]}
        </div>
      ))}
    </div>
  )
}
