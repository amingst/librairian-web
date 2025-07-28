import { X, Pause, Play } from 'lucide-react';

type PlaylistItem = {
	id: string;
	title: string;
	showName: string;
	audioUrl: string;
	documentIds: string[];
	tags: string[];
};

type Playlist = PlaylistItem[];

export default function InvestigationsPanel({
	audioRef,
	showPlaylist,
	setShowPlaylist,
	playlist,
	currentPlaylistItem,
	setCurrentPlaylistItem,
	isPlaying,
	setIsPlaying,
	setCurrentPlayer,
}: {
	audioRef: React.RefObject<HTMLAudioElement | null>;
	showPlaylist: boolean;
	setShowPlaylist: React.Dispatch<React.SetStateAction<boolean>>;
	playlist: Playlist;
	currentPlaylistItem: number | null;
	setCurrentPlaylistItem: React.Dispatch<React.SetStateAction<number | null>>;
	isPlaying: boolean;
	setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
	setCurrentPlayer: React.Dispatch<
		React.SetStateAction<'report' | 'podcast' | null>
	>;
}) {
	if (!showPlaylist) return null;

	return (
		<div className='fixed right-0 top-0 bottom-0 w-[300px] bg-muted border-l border-border flex flex-col overflow-hidden z-9200'>
			<div className='px-3 py-3 border-b border-border flex justify-between items-center'>
				<h4 className='m-0 text-[14px] font-semibold text-foreground'>
					Investigations
				</h4>
				<div className='flex gap-2'>
					<span className='text-xs text-muted-foreground'>
						{playlist.length} Reports
					</span>
					<button
						onClick={() => setShowPlaylist(false)}
						className='p-1 rounded cursor-pointer bg-transparent border-0 hover:bg-secondary'
						aria-label='Close investigations'
					>
						<X size={16} />
					</button>
				</div>
			</div>

			<div className='flex-1 overflow-y-auto p-2'>
				{playlist.length === 0 ? (
					<div className='p-4 text-center text-muted-foreground text-sm'>
						No investigative reports yet. Generate reports to add
						them to your investigations.
					</div>
				) : (
					playlist.map((item, index) => (
						<div
							key={item.id}
							className={`p-2 rounded mb-2 cursor-pointer ${
								currentPlaylistItem === index
									? 'bg-muted'
									: 'bg-background'
							}`}
							onClick={() => {
								setCurrentPlaylistItem(index);
								if (audioRef.current) {
									audioRef.current.src = item.audioUrl;
									audioRef.current.load();
									audioRef.current.play();
									setIsPlaying(true);
									setCurrentPlayer('report');
								}
							}}
						>
							<div className='text-[13px] font-medium mb-1 text-foreground'>
								{item.title}
							</div>
							<div className='text-xs text-muted-foreground mb-1'>
								{item.showName}
							</div>
							<div className='flex flex-wrap gap-1 mb-1'>
								{item.documentIds.map((docId) => (
									<a
										key={docId}
										href={`/jfk-files/${docId}`}
										className='text-[11px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground no-underline'
									>
										{docId}
									</a>
								))}
							</div>
							<div className='flex flex-wrap gap-1'>
								{item.tags.slice(0, 3).map((tag, i) => (
									<span
										key={i}
										className='text-[11px] px-2 py-0.5 bg-background rounded-full text-muted-foreground'
									>
										{tag}
									</span>
								))}
								{item.tags.length > 3 && (
									<span className='text-[11px] text-muted-foreground'>
										+{item.tags.length - 3} more
									</span>
								)}
							</div>
						</div>
					))
				)}
			</div>

			{/* Audio player at the bottom if playing from playlist */}
			{currentPlaylistItem !== null && playlist[currentPlaylistItem] && (
				<div className='p-2 border-t border-border bg-muted'>
					<div className='flex items-center gap-2 mb-2'>
						<button
							onClick={() => {
								if (audioRef.current) {
									if (isPlaying) {
										audioRef.current.pause();
									} else {
										audioRef.current.play();
									}
									setIsPlaying(!isPlaying);
								}
							}}
							className='p-2 bg-destructive text-white rounded-full flex items-center justify-center border-0 cursor-pointer'
						>
							{isPlaying ? (
								<Pause size={16} />
							) : (
								<Play size={16} />
							)}
						</button>
						<div className='text-xs font-medium flex-1'>
							{playlist[currentPlaylistItem].title.length > 40
								? playlist[currentPlaylistItem].title.substring(
										0,
										40
								  ) + '...'
								: playlist[currentPlaylistItem].title}
						</div>
					</div>
					<audio
						ref={audioRef}
						src={playlist[currentPlaylistItem].audioUrl}
						onEnded={() => {
							if (currentPlaylistItem < playlist.length - 1) {
								setCurrentPlaylistItem(currentPlaylistItem + 1);
								if (audioRef.current) {
									audioRef.current.src =
										playlist[
											currentPlaylistItem + 1
										].audioUrl;
									audioRef.current.load();
									audioRef.current.play();
								}
							} else {
								setIsPlaying(false);
							}
						}}
						className='w-full'
						controls
					/>
				</div>
			)}
		</div>
	);
}
