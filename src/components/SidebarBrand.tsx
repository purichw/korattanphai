/** Public branding only: safe to render before the session is resolved. */
export function SidebarBrand({ compactMobileLogo, label }: { compactMobileLogo: boolean; label: string }) {
  return <div className="brand-lockup is-logo-only">
    <div className="brand-mark is-sidebar-logo">
      <picture>
        <source media="(max-width: 720px)" srcSet={compactMobileLogo ? "/brand/korat-tan-phai-sidebar-logo.webp" : "/brand/korat-tan-phai-emblem.webp"} />
        <img src="/brand/korat-tan-phai-sidebar-logo.webp" width="640" height="585" alt={label} decoding="async" />
      </picture>
    </div>
  </div>;
}
