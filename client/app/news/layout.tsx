import Header from '@/components/layout/Header';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className='jfk-files-layout'>
			<div className={`${inter.className} flex flex-col min-h-screen`}>
				<Header />
				{children}
			</div>
		</div>
	);
}
