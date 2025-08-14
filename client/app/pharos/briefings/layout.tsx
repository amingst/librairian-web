export default function BriefingsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <div className='container mx-auto p-6 max-w-4xl'>{children}</div>;
}
