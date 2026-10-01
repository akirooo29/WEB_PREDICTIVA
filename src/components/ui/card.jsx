export function Card({ as: Element = 'article', className = '', children, ...props }) {
  return <Element data-slot="card" className={className} {...props}>{children}</Element>;
}
