/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Ativa o modo escuro via classe ".dark" na <html> (ver src/lib/theme.tsx),
  // em vez de seguir cegamente a preferência do sistema — permite alternância manual.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Cada cor lê de uma variável CSS "R G B" (ver :root/.dark em index.css),
        // por isso o modificador de opacidade do Tailwind (ex.: bg-accent/40) continua
        // funcionando normalmente — e o tema muda sem precisar trocar nenhuma classe.
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--color-surface-2) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'border-strong': 'rgb(var(--color-border-strong) / <alpha-value>)',
        'text-main': 'rgb(var(--color-text) / <alpha-value>)',
        'text-dim': 'rgb(var(--color-text-dim) / <alpha-value>)',
        'text-faint': 'rgb(var(--color-text-faint) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--color-accent-soft) / <alpha-value>)',
        'accent-bg': 'rgb(var(--color-accent-bg) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Source Serif 4', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
