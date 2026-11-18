// Small line icons drawn as SVG, so there is no icon library to download.
// aria-hidden keeps screen readers from reading them; the text next to each icon carries the meaning.
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const PhoneIcon = () => (
  <svg {...base}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </svg>
)

export const ChevronIcon = () => (
  <svg {...base}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)

export const BackIcon = () => (
  <svg {...base}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
)

export const CloseIcon = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const ShareIcon = () => (
  <svg {...base}>
    <path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </svg>
)

export const WheelchairIcon = () => (
  <svg {...base}>
    <circle cx="11" cy="4.5" r="1.5" />
    <path d="M11 8v6h5l2.5 5M11 11h4" />
    <path d="M8.5 11.5a5 5 0 1 0 6.5 6" />
  </svg>
)
