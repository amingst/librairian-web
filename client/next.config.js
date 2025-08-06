/** @type {import('next').NextConfig} */
const nextConfig = {
	basePath: '',
	async rewrites() {
		return [
			{
				source: '/jfk-files/api/:path*',
				destination: '/api/:path*',
			},
			{
				source: '/api/:path*',
				destination: '/api/:path*',
			},
		];
	},
	devIndicators: false,
};

module.exports = nextConfig;
