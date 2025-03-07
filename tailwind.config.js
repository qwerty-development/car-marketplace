module.exports = {
	content: [
		'./App.{js,jsx,ts,tsx}',
		'./app/**/*.{js,jsx,ts,tsx}',
		'./components/**/*.{js,jsx,ts,tsx}',
		'./node_modules/expo-image/src/**/*.{js,jsx,ts,tsx}'
	],
	theme: {
		extend: {
			colors: {
				night: '#0D0D0D',
				textgray: '#4C4C4C',
				gray:'f9f9f9',
				red: '#D55004',
				white: '#FFFFFF',
				light: {
					background: '#FFFFFF',
					text: '#333333',
					secondary: '#F5F5F5',
					accent: '#D55004'
				}
			}
		}
	},
	plugins: []
}
