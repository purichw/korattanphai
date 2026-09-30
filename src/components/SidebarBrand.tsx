/** Public branding only: safe to render before the session is resolved. */
export function SidebarBrand({ compactMobileLogo, label, mobileWordmark = false }: { compactMobileLogo: boolean; label: string; mobileWordmark?: boolean }) {
  return <div className={`brand-lockup is-logo-only${mobileWordmark ? ' has-mobile-wordmark' : ''}`}>
    <div className="brand-mark is-sidebar-logo">
      <picture>
        {mobileWordmark && <source media="(max-width: 1180px)" srcSet="/brand/korat-tan-phai-emblem.webp" />}
        <source media="(max-width: 720px)" srcSet={compactMobileLogo ? "/brand/korat-tan-phai-sidebar-logo.webp" : "/brand/korat-tan-phai-emblem.webp"} />
        <img src="/brand/korat-tan-phai-sidebar-logo.webp" width="640" height="585" alt={label} decoding="async" />
      </picture>
    </div>
    {mobileWordmark && <span className="brand-mobile-wordmark" aria-hidden="true"><strong>โคราชทันภัย</strong><small>Korat Tan Phai</small></span>}
  </div>;
}
