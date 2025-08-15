'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ChatMessage {
	id: string;
	role: 'rag' | 'user';
	content: string;
	ts: number;
}

export default function RagChat() {
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState<ChatMessage[]>(() => [
		{
			id: crypto.randomUUID(),
			role: 'rag',
			ts: Date.now(),
			content:
				"Hi, I'm your RAG assistant. I've loaded a quick knowledge snippet for this briefing. Ask any follow-up questions or request a deeper dive on a section.",
		},
	]);

	const scrollRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		// Auto-scroll to bottom on new message
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages.length]);

	const send = async () => {
		const text = input.trim();
		if (!text) return;

		// Add user message immediately
		setMessages((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				role: 'user',
				content: text,
				ts: Date.now(),
			},
		]);
		setInput('');

		try {
			const briefingId = localStorage.getItem('lastNewsBriefing')
				? JSON.parse(localStorage.getItem('lastNewsBriefing')!).id
				: null;

			if (!briefingId) {
				throw new Error('No briefing loaded');
			}

			const response = await fetch('/api/pharos/briefing/rag', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					query: text,
					briefingId,
				}),
			});

			if (!response.ok) {
				throw new Error('Failed to get RAG response');
			}

			const data = await response.json();

			// Add RAG response
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: 'rag',
					content: data.response,
					ts: Date.now(),
				},
			]);
		} catch (error) {
			console.error(`Error fetching RAG response: ${error}`);
			// Add error message
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: 'rag',
					content:
						'Sorry, I had trouble processing your request. Please try again.',
					ts: Date.now(),
				},
			]);
		}
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	};

	return (
		<Card className='h-[78vh] flex flex-col'>
			<CardHeader className='py-4'>
				<CardTitle className='text-base'>RAG Chat</CardTitle>
			</CardHeader>
			<CardContent className='flex-1 flex flex-col gap-3 pt-0'>
				<ScrollArea className='flex-1 rounded border' ref={scrollRef}>
					<div className='p-3 space-y-4'>
						{messages.map((m) => (
							<div
								key={m.id}
								className={`flex items-start gap-2 ${
									m.role === 'user'
										? 'justify-end'
										: 'justify-start'
								}`}
							>
								{m.role === 'rag' && (
									<Avatar className='h-6 w-6'>
										<AvatarFallback>R</AvatarFallback>
									</Avatar>
								)}

								<div
									className={`max-w-[80%] rounded-md px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
										m.role === 'user'
											? 'bg-primary text-primary-foreground'
											: 'bg-muted text-foreground'
									}`}
								>
									{m.content}
								</div>

								{m.role === 'user' && (
									<Avatar className='h-6 w-6'>
										<AvatarFallback>U</AvatarFallback>
									</Avatar>
								)}
							</div>
						))}
					</div>
				</ScrollArea>

				<div className='flex items-center gap-2'>
					<Input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={onKeyDown}
						placeholder='Ask about this briefing...'
					/>
					<Button onClick={send} type='button'>
						Send
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
