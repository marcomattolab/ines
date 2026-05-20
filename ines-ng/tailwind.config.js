/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-0': '#050508',
        'text-0': '#f8fafc',
        'text-1': '#cbd5e1',
        'text-2': '#94a3b8',
        'accent-blue': '#60a5fa',
        'accent-green': '#34d399',
        'accent-amber': '#fbbf24',
        'accent-rose': '#fb7185',
        'accent-purple': '#c084fc',
        'accent-cyan': '#22d3ee',
      },
      fontFamily: {
        'ui': ['Syne', 'sans-serif'],
        'body': ['IBM Plex Sans', 'sans-serif'],
        'mono': ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
