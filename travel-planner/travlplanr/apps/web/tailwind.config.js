/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}', './projects/admin/src/**/*.{html,ts}', './projects/b2b/src/**/*.{html,ts}'],
  // Classes dynamically added via Angular [class.xxx] bindings are invisible to
  // Tailwind's static scanner and get purged from the CSS bundle. Safelisting
  // them ensures they are always emitted, regardless of how they are applied.
  safelist: [
    'opacity-0',
    'opacity-100',
    'translate-y-0',
    'translate-y-12',
  ],
  theme: {
    extend: {
      colors: {
        // Aero Cartography — shared visual language for discovery, planning,
        // community and operations. Components consume semantic roles instead
        // of introducing surface-specific hard-coded colours.
        atmosphere: {
          DEFAULT: '#07111F',
          elevated: '#0D1B2A',
          glass: 'rgba(13, 27, 42, 0.72)',
        },
        route: {
          DEFAULT: '#0060EA',
          glow: '#37D6D0',
          orbit: '#8B7CFF',
          sunrise: '#FFB86B',
        },
        primary: {
          DEFAULT: '#0060EA',
          hover: '#0860C8',
          50: '#F0F7FF',
          subtle: '#E3F0FF',
        },
        // Semantic feedback colors. Text shades meet WCAG AA on white surfaces.
        danger: {
          DEFAULT: '#DC2626',
          hover: '#B91C1C',
          50: '#FEF2F2',
        },
        success: {
          DEFAULT: '#16A34A',
          50: '#F0FDF4',
        },
        warning: {
          DEFAULT: '#D97706',
          50: '#FFFBEB',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#FAFAFA',
        },
        // Dark-mode surface palette used with dark:bg-… or [class.bg-surface-default].
        // These tokens map the same role names to dark surfaces so components can
        // switch with a single utility when wrapped inside an ancestor that has `dark`.
        'surface-dark': {
          DEFAULT: '#111827',       // surface  — page panels, cards
          elevated: '#1F2937',      // elevation — modals, dropdowns, popovers
          muted: '#0B111A',         // muted backgrounds (code blocks, chat bubbles)
        },
        text: {
          primary: '#141414',
          secondary: '#525252',
          tertiary: '#737373',
          // Muted/meta text (section labels, stat captions, timestamps). Was missing
          // entirely, so every existing "text-text-faint" usage across the Community
          // components silently emitted no color and fell back to the inherited
          // near-black body text instead of this gray.
          faint: '#8B94A3',
          disabled: '#A3A3A3',
          inverse: '#FFFFFF',
        },
        // Community "Events" surfaces (list + detail) mirror the Manrope /
        // blue-gray palette from the Community Home design reference, which
        // differs slightly from the app-wide `text` tokens above.
        eventText: {
          deep: '#0B1220',
          mid: '#5A6472',
          soft: '#8B94A3',
        },
        // Category badge colors (Meetup/Food share blue, Online gets purple —
        // matches the design reference's typeStyle exactly).
        eventTag: {
          blueBg: '#EAF1FE',
          blueBorder: '#BFDBFE',
          purpleBg: '#F3EEFF',
          purpleBorder: '#DDD0F7',
          purpleText: '#6B3FA0',
        },
        border: {
          DEFAULT: '#D4D4D4',
          light: '#E0E0E0',
        },
        dark: {
          DEFAULT: '#1A1A1A',
          footer: '#141414',
        },
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        data: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        manrope: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      // Named type scale. Each token equals the EXACT pixel size already in use
      // via text-[Npx] arbitrary classes, so migrating to the named class is a
      // zero-visual-change rename (see scripts/migrate-text-size-to-scale.mjs).
      // Surveyed sizes present: 10,11,12,13,14,15,16,17,18,20,22,24,28,30,32,34,36,40,44,48,128.
      fontSize: {
        '2xs': '10px',
        '2xs-plus': '11px',
        xs: '12px',
        'xs-plus': '13px',
        sm: '14px',
        'sm-plus': '15px',
        base: '16px',
        'base-plus': '17px',
        lg: '18px',
        xl: '20px',
        '2xl': '22px',
        '3xl': '24px',
        '4xl': '28px',
        '4xl-plus': '30px',
        '5xl': '32px',
        '5xl-plus': '34px',
        '6xl': '36px',
        '7xl': '40px',
        '7xl-plus': '44px',
        '8xl': '48px',
        '9xl': '128px',
      },
      maxWidth: {
        content: '1280px',
        page: '1440px',
      },
      // Semantic spacing tokens. Because Tailwind derives p-*/m-*/gap-* from
      // every key here, `section` already yields `gap-section`/`p-section`;
      // add new named spacings here rather than inline `p-[Npx]` values.
      spacing: {
        section: '72px',
        card: '24px',
        gutter: '16px',
      },
      borderRadius: {
        card: '16px',
        tile: '12px',
        btn: '8px',
      },
      boxShadow: {
        chatbot: '0px 5px 12.5px rgba(17, 25, 34, 0.2)',
        'card-hover': '0px 4px 24px rgba(0, 96, 234, 0.12)',
        route: '0 0 0 1px rgba(55, 214, 208, 0.18), 0 18px 50px rgba(0, 96, 234, 0.16)',
        orbit: '0 18px 60px rgba(7, 17, 31, 0.28)',
      },
    },
  },
  plugins: [],
};
