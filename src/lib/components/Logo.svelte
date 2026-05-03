<svg
	width="100%"
	height="100%"
	viewBox="0 0 256 256"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
>
	<defs>
		<linearGradient id="logo-bg" x1="0" y1="0" x2="256" y2="256" gradientUnits="userSpaceOnUse">
			<stop stop-color="#1A1A1A" />
			<stop offset="1" stop-color="#111111" />
		</linearGradient>
		<linearGradient id="logo-top" x1="0%" y1="0%" x2="100%" y2="100%">
			<stop offset="0%" stop-color="#FF5C33" />
			<stop offset="100%" stop-color="#FF3300" />
		</linearGradient>
		<linearGradient id="logo-left" x1="0%" y1="0%" x2="0%" y2="100%">
			<stop offset="0%" stop-color="#E62E00" />
			<stop offset="100%" stop-color="#991F00" />
		</linearGradient>
		<linearGradient id="logo-right" x1="0%" y1="0%" x2="0%" y2="100%">
			<stop offset="0%" stop-color="#CC2900" />
			<stop offset="100%" stop-color="#660F00" />
		</linearGradient>
		<filter id="logo-glow" x="-50%" y="-50%" width="200%" height="200%">
			<feGaussianBlur stdDeviation="24" />
		</filter>
		<linearGradient id="logo-fade" x1="0%" y1="0%" x2="0%" y2="100%">
			<stop offset="50%" stop-color="white" />
			<stop offset="85%" stop-color="black" />
		</linearGradient>
		<mask id="logo-mask">
			<rect x="0" y="0" width="256" height="256" fill="url(#logo-fade)" />
		</mask>
	</defs>

	<rect width="256" height="256" rx="56" fill="url(#logo-bg)" />

	<circle cx="128" cy="131" r="50" fill="#FF3300" filter="url(#logo-glow)" opacity="0.4" />

	<g mask="url(#logo-mask)">
		<path d="M 68 96 L 128 132 L 128 202 L 68 166 Z" fill="url(#logo-left)" />
		<path d="M 128 132 L 188 96 L 188 166 L 128 202 Z" fill="url(#logo-right)" />
		<path d="M 128 60 L 188 96 L 128 132 L 68 96 Z" fill="url(#logo-top)" />

		<path d="M 128 60 L 68 96" stroke="#FF8566" stroke-width="2" stroke-linecap="round" />
		<path d="M 128 60 L 188 96" stroke="#FF8566" stroke-width="2" stroke-linecap="round" />
		<path d="M 68 96 L 128 132" stroke="#FFAD99" stroke-width="2" stroke-linecap="round" />
		<path d="M 188 96 L 128 132" stroke="#FF3300" stroke-width="2" stroke-linecap="round" />
		<path d="M 128 132 L 128 200" stroke="#FF5C33" stroke-width="2" stroke-linecap="round" />
	</g>
</svg>
