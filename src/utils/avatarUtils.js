const AVATAR_COLORS = [
  '#4f46e5', '#7c3aed', '#2563eb', '#0891b2', 
  '#059669', '#65a30d', '#ca8a04', '#dc2626'
];

export function generateInitialAvatar(username) {
  const initial = (username || '?').charAt(0).toUpperCase();
  const colorIndex = Math.abs(username.split('').reduce((acc, char) => 
    acc + char.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${AVATAR_COLORS[colorIndex]}"/>
      <text x="50" y="50" 
            font-family="Arial" 
            font-size="40" 
            fill="white" 
            text-anchor="middle" 
            dominant-baseline="middle">
        ${initial}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
