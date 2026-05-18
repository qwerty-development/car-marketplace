module.exports = function (api) {
	api.cache(true);

	const isProduction =
		process.env.BABEL_ENV === 'production' ||
		process.env.NODE_ENV === 'production';

	return {
		presets: ['babel-preset-expo'],
		plugins: [
			'nativewind/babel',
			// Strip console.* (except error/warn) from production bundles.
			// Saves the cost of bridge serialization per call on Android cold start.
			// Sentry breadcrumbs auto-capture warns/errors, so observability stays intact.
			...(isProduction
				? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
				: []),
			// Reanimated plugin MUST remain last per the official Reanimated docs.
			'react-native-reanimated/plugin',
		],
	};
};
