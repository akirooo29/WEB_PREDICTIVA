const variantes = {
  primary: 'button-primary',
  secondary: 'button-secondary',
};

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button
      data-slot="button"
      className={`button inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${variantes[variant] || variantes.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
