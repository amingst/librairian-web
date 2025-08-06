'use client';

import { useState, useEffect, useRef } from 'react';
import {
	MessageSquare,
	X,
	Volume2,
	VolumeX,
	Mic,
	MicOff,
	Loader2,
} from 'lucide-react';
import { useConversation } from '@11labs/react';
// @ts-ignore
const { v4: uuidv4 } = require('uuid');

interface ChatInterfaceProps {
	documentId: string;
	elevenlabsAgentId?: string; // Optional agent ID from ElevenLabs
	elevenlabsApiKey?: string; // Add API key prop
	pageContent?: {
		pageNumber: number;
		summary: string;
		fullText: string;
		dates?: string[];
		names?: string[];
		places?: string[];
		objects?: string[];
	} | null;
	documentSummary?: string;
	currentPage?: number;
}

interface Message {
	id: string;
	sender: 'user' | 'ai';
	message: string;
	timestamp?: number; // Add timestamp
}

export default function ChatInterface({
	documentId,
	elevenlabsAgentId,
	elevenlabsApiKey, // Add API key from props
	pageContent,
	documentSummary,
	currentPage,
}: ChatInterfaceProps) {
	// Chat state
	const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
	const [dialogueId, setDialogueId] = useState<string | null>(null);
	const [conversationHistory, setConversationHistory] = useState<
		Array<{ role: string; content: string }>
	>([]);
	const [userInput, setUserInput] = useState<string>('');
	const chatLogRef = useRef<HTMLDivElement>(null);
	const [streamingMessage, setStreamingMessage] = useState<string>('');

	// Audio state with ElevenLabs
	const [isMuted, setIsMuted] = useState<boolean>(false);
	const [isListening, setIsListening] = useState<boolean>(false);
	const [micPermission, setMicPermission] = useState<
		'granted' | 'denied' | 'prompt' | 'unknown'
	>('unknown');
	const [agentId, setAgentId] = useState<string | undefined>(
		elevenlabsAgentId || undefined
	); // Use provided agent ID or undefined
	const [connectionInProgress, setConnectionInProgress] =
		useState<boolean>(false);
	const [agentError, setAgentError] = useState<boolean>(false);
	const [activeConversation, setActiveConversation] =
		useState<boolean>(false);
	const [micTranscriptionCount, setMicTranscriptionCount] =
		useState<number>(0);
	const [transcriptionCheckTimer, setTranscriptionCheckTimer] =
		useState<NodeJS.Timeout | null>(null);

	// ElevenLabs conversation hook
	const conversation = useConversation({
		onConnect: () => {
			console.log('Connected to ElevenLabs AI');
			setConnectionInProgress(false);
			setAgentError(false);

			// On successful connect, try a standard greeting
			// This helps verify that the audio pipeline is working
			console.log('🔈 Testing audio pipeline with a direct message...');
			setTimeout(() => {
				try {
					if (!isMuted && agentId) {
						console.log('🔈 Attempting to play a test message...');
						trySpeaking('Connection established');
					}
				} catch (e) {
					console.error('Error sending test message:', e);
				}
			}, 1000);
		},
		onDisconnect: () => {
			console.log('Disconnected from ElevenLabs AI');
			setIsListening(false);

			// IMPORTANT: Reconnect immediately if we're not intentionally disconnecting
			// This is critical to prevent audio playback from being cut off
			if (activeConversation && !isMuted) {
				console.log(
					'IMPORTANT: Immediate reconnection to prevent audio cutoff'
				);
				// Use immediate reconnection - no delay
				ensureElevenLabsConnection();
			}
		},
		onMessage: (message: any) => {
			console.log('Received message:', message);

			// For transcript messages (microphone input)
			if (message.type === 'transcript' && message.transcription) {
				// Increment the transcription count to show the mic is working
				setMicTranscriptionCount((prev) => prev + 1);

				// Set the mic as active whenever we get a transcript
				setIsMicActive(true);

				// Reset mic active timer - will turn off if no activity for 2 seconds
				if (micInactiveTimer.current) {
					clearTimeout(micInactiveTimer.current);
				}
				micInactiveTimer.current = setTimeout(() => {
					setIsMicActive(false);
				}, 2000);

				// Set the input field to show the user what's being transcribed
				setUserInput(message.transcription);

				if (message.isFinal) {
					console.log('FINAL TRANSCRIPT:', message.transcription);
					// Add to conversation Messages using our new system
					if (message.transcription.trim().length > 0) {
						// Use the addMessage function for user input
						addMessage('user', message.transcription.trim());
						// Clear input field
						setUserInput('');
						// Also update the old conversation history for API compatibility
						const updatedHistory = [
							...conversationHistory,
							{
								role: 'user',
								content: message.transcription.trim(),
							},
						];
						setConversationHistory(updatedHistory);

						// Send transcript to the API
						handleAPIRequest(
							message.transcription.trim(),
							updatedHistory
						);
					}
				}
			}

			// IMPORTANT: For AI responses, don't do anything that could interrupt playback
			if (message.source === 'ai') {
				console.log('AI RESPONSE - DO NOT INTERRUPT:', message.message);

				// The key is to do NOTHING here that might interrupt the audio
				// Just log it and let the SDK handle the audio playback
			}
		},
		onError: (error) => {
			console.error('ElevenLabs error:', error);
			setConnectionInProgress(false);

			const errorString = String(error);
			if (errorString.toLowerCase().includes('microphone')) {
				setMicPermission('denied');
				setIsListening(false);
				alert(
					'Microphone access was denied. Please allow access in your browser settings.'
				);
			}

			if (
				errorString.includes('agent') &&
				errorString.includes('does not exist')
			) {
				setAgentError(true);
			}
		},
		volume: isMuted ? 0 : 1,
		micMuted: !isListening,
		// Support higher quality audio while staying within constraints
		audioQuality: 'high',
		// CRITICAL FIX: Use custom container element to prevent DOM conflicts
		containerElement:
			typeof document !== 'undefined'
				? document.getElementById('elevenlabs-audio-container') ||
				  undefined
				: undefined,
	});

	// Extract status and isSpeaking from the hook
	const { isSpeaking, status } = conversation;

	// Track the last text sent to the AI agent for speech
	const lastTextSentForSpeech = useRef<string>('');

	// Check microphone permission on component mount
	useEffect(() => {
		async function checkMicrophonePermission() {
			try {
				// Check if navigator.permissions API is available
				if (navigator.permissions && navigator.permissions.query) {
					const permissionStatus = await navigator.permissions.query({
						name: 'microphone' as PermissionName,
					});
					setMicPermission(
						permissionStatus.state as
							| 'granted'
							| 'denied'
							| 'prompt'
					);

					// Listen for permission changes
					permissionStatus.onchange = () => {
						setMicPermission(
							permissionStatus.state as
								| 'granted'
								| 'denied'
								| 'prompt'
						);
					};
				} else {
					// Fallback for browsers that don't support the Permissions API
					try {
						const stream =
							await navigator.mediaDevices.getUserMedia({
								audio: true,
							});
						setMicPermission('granted');
						// Clean up the stream immediately since we're just checking permission
						stream.getTracks().forEach((track) => track.stop());
					} catch (err) {
						setMicPermission('denied');
					}
				}
			} catch (error) {
				console.error('Error checking microphone permission:', error);
				setMicPermission('unknown');
			}
		}

		checkMicrophonePermission();
	}, []);

	// Function to handle sending chat messages
	const sendMessage = async () => {
		if (!userInput.trim()) return;
		await handleSendMessage(userInput);
	};

	// Separate the message sending logic to allow for voice input
	const handleSendMessage = async (text: string) => {
		if (!text.trim()) return;

		// Add user message to conversation history using new method
		addMessage('user', text.trim());

		// Add to old conversation history for API compatibility
		// First check if we have a system message at the beginning
		let updatedHistory;

		if (
			conversationHistory.length > 0 &&
			conversationHistory[0].role === 'system'
		) {
			// Keep the system message and add the new user message
			updatedHistory = [
				conversationHistory[0],
				...conversationHistory.slice(1),
				{ role: 'user', content: text.trim() },
			];
		} else {
			// If there's no system message, create one with current context
			let contextMessage = `Document Context for ${documentId}`;
			if (pageContent) {
				contextMessage += `, page ${currentPage}: ${pageContent.summary}`;
			}

			updatedHistory = [
				{ role: 'system', content: contextMessage },
				...conversationHistory,
				{ role: 'user', content: text.trim() },
			];
		}

		setConversationHistory(updatedHistory);

		// Clear input field
		setUserInput('');

		// Send to API
		handleAPIRequest(text.trim(), updatedHistory);
	};

	// Update message state to use the Message interface
	const [conversationMessages, setConversationMessages] = useState<Message[]>(
		[]
	);

	// Add the addMessage function to handle message creation with timestamps
	const addMessage = (sender: 'user' | 'ai', message: string) => {
		const newMessage: Message = {
			id: uuidv4(),
			sender,
			message,
			timestamp: Date.now(), // Add current timestamp
		};

		setConversationMessages((prev) => {
			const lastMessage = prev[prev.length - 1];

			// If the last message is from the same sender and within 10 seconds, update it
			if (
				lastMessage &&
				lastMessage.sender === sender &&
				sender === 'user' &&
				newMessage.timestamp &&
				lastMessage.timestamp &&
				newMessage.timestamp - lastMessage.timestamp < 10000
			) {
				const updatedConversation = [...prev];
				updatedConversation[updatedConversation.length - 1] = {
					...lastMessage,
					message: `${lastMessage.message} ${message}`,
					timestamp: newMessage.timestamp,
				};
				return updatedConversation;
			}

			return [...prev, newMessage];
		});
	};

	// Create a separate function for API requests to reduce duplication
	const handleAPIRequest = async (
		text: string,
		history: Array<{ role: string; content: string }>
	) => {
		try {
			// Prepare document context in a structured format for the LLM
			let contextString = '';

			if (documentSummary) {
				contextString += `DOCUMENT SUMMARY: ${documentSummary}\n\n`;
			}

			if (pageContent) {
				contextString += `CURRENT PAGE: ${pageContent.pageNumber}\n`;
				contextString += `PAGE SUMMARY: ${pageContent.summary}\n\n`;

				if (pageContent.names && pageContent.names.length > 0) {
					contextString += `PEOPLE IN THIS PAGE: ${pageContent.names.join(
						', '
					)}\n`;
				}

				if (pageContent.places && pageContent.places.length > 0) {
					contextString += `PLACES IN THIS PAGE: ${pageContent.places.join(
						', '
					)}\n`;
				}

				if (pageContent.objects && pageContent.objects.length > 0) {
					contextString += `OBJECTS IN THIS PAGE: ${pageContent.objects.join(
						', '
					)}\n`;
				}

				contextString += `\nPAGE TEXT:\n${pageContent.fullText}\n`;
			}

			// Create full document context object with raw data and formatted string
			const documentContext = {
				documentId,
				currentPage,
				documentSummary,
				pageContent: pageContent
					? {
							pageNumber: pageContent.pageNumber,
							summary: pageContent.summary,
							fullText: pageContent.fullText,
							people: pageContent.names || [],
							places: pageContent.places || [],
							objects: pageContent.objects || [],
							dates: pageContent.dates || [],
					  }
					: null,
				formattedContext: contextString,
			};

			// Make sure the conversation always has the context
			// If the first message isn't already a system message with context, add it
			let updatedHistory = [...history];

			// Check if we need to add context as a system message at the start
			if (
				updatedHistory.length === 0 ||
				updatedHistory[0].role !== 'system'
			) {
				updatedHistory = [
					{
						role: 'system',
						content: `Document Context: ${contextString}`,
					},
					...updatedHistory,
				];
			} else {
				// Update existing system message with fresh context
				updatedHistory[0] = {
					role: 'system',
					content: `Document Context: ${contextString}`,
				};
			}

			// Log context being sent (for debugging)
			console.log(
				'Sending document context with history:',
				updatedHistory[0]
			);

			// Build the system prompt with the document context
			const systemPrompt = `You are a helpful assistant specializing in analyzing JFK documents. You can help understand the contents, context, and significance of these historical documents.

Here is the context about the document you're currently analyzing:

${contextString}

Use this information to provide accurate responses about the document. If the user asks about content not present in this document, you can mention that it's not covered in the current document or page.`;

			// Send to server with enhanced context
			const response = await fetch(
				'http://100.124.42.82:3005/api/generate/chat',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						userInput: text.trim(),
						dialogueId: dialogueId,
						documentId: documentId,
						documentContext: JSON.stringify(documentContext),
						conversationHistory: JSON.stringify(updatedHistory),
						personality: JSON.stringify({
							name: 'JFK Document Assistant',
							model: 'grok-2',
							temperature: 0.7,
							systemPrompt: systemPrompt,
							voices: {
								elevenLabs: {
									voice_id: agentId,
									model_id: 'eleven_turbo_v2',
									stability: 0.5,
									similarity_boost: 0.75,
								},
							},
						}),
					}),
				}
			);

			const data = await response.json();
			setDialogueId(data.dialogueId);

			// Log the dialogue ID for debugging
			console.log('API generated dialogueId:', data.dialogueId);

			// Connect to SSE stream for text streaming
			connectToEventStream(data.dialogueId);
		} catch (error) {
			console.error('Error sending message:', error);
			addMessage('ai', 'Error: Could not send message');
		}
	};

	// Make sure elevenlabsConnected is properly declared with the other state variables
	const [elevenlabsConnected, setElevenlabsConnected] =
		useState<boolean>(false);

	// Function to connect to event stream - MODIFIED TO SEPARATE TEXT FROM VOICE
	const connectToEventStream = (dialogId: string) => {
		const url = `http://100.124.42.82:3005/api/generate/open-stream?id=${dialogId}`;

		// Create a new EventSource
		const eventSource = new EventSource(url);

		setStreamingMessage('');
		setActiveConversation(true); // Mark that we have an active conversation

		// Track the complete response for audio playback
		let completeResponse = '';

		eventSource.addEventListener('connected', (event) => {
			console.log('Connected to event stream:', event.data);
		});

		eventSource.addEventListener('textChunk', (event) => {
			const data = JSON.parse(event.data);
			if (data.role === 'assistant') {
				const newText = data.text;
				setStreamingMessage((prev) => prev + newText);
				completeResponse += newText;
			}
		});

		eventSource.addEventListener('done', (event) => {
			console.log('Conversation complete:', event.data);

			// Add complete response to conversation history
			if (streamingMessage) {
				// Add to new message system
				addMessage('ai', streamingMessage);

				// Add to old system for compatibility
				setConversationHistory((prev) => [
					...prev,
					{ role: 'assistant', content: streamingMessage },
				]);

				// IMPORTANT: Speech happens AFTER the text is complete and added to the chat
				if (!isMuted && agentId) {
					// Try to speak the text - but don't let it block the UI
					setTimeout(() => {
						speakText(streamingMessage);
					}, 100);
				}

				setStreamingMessage('');
			}

			// Keep the active conversation state for a short time
			setTimeout(() => {
				setActiveConversation(false);
			}, 5000);

			// Close the event source when done
			eventSource.close();
		});

		eventSource.addEventListener('error', (event: Event) => {
			console.error('Error in event stream:', event);

			// Close on error
			eventSource.close();
			setActiveConversation(false);
		});
	};

	// Helper function for debugging ElevenLabs connection
	const logSessionStatus = () => {
		console.log(
			`ElevenLabs Session Status: ${status}, Active Conversation: ${activeConversation}, Muted: ${isMuted}`
		);
	};

	// Add API key state
	const [apiKey, setApiKey] = useState<string | null>(
		elevenlabsApiKey || null
	);

	// Get environment variables for ElevenLabs API key on component mount
	useEffect(() => {
		// Check for API key in props first
		if (elevenlabsApiKey) {
			setApiKey(elevenlabsApiKey);
			console.log('Using API key from props');
			return;
		}

		// Try to get from environment variables next
		let envApiKey = null;

		// Check for both formats of the environment variable
		if (process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY) {
			envApiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
			console.log('Using API key from NEXT_PUBLIC_ELEVENLABS_API_KEY');
		} else if (process.env.ELEVENLABS_API_KEY) {
			envApiKey = process.env.ELEVENLABS_API_KEY;
			console.log('Using API key from ELEVENLABS_API_KEY');
		}

		if (envApiKey) {
			setApiKey(envApiKey);
			// Also store in localStorage for persistence
			localStorage.setItem('elevenlabs-api-key', envApiKey);
			return;
		}

		// Finally check localStorage
		const storedKey = localStorage.getItem('elevenlabs-api-key');
		if (storedKey) {
			setApiKey(storedKey);
			console.log('Using API key from localStorage');
		}
	}, [elevenlabsApiKey]);

	// Direct ElevenLabs TTS function that uses API key
	const directTTS = async (text: string) => {
		try {
			console.log('🎙️ Attempting direct TTS with ElevenLabs API');

			if (!agentId) {
				console.error('No voice ID provided for TTS');
				return false;
			}

			// Create a unique audio element ID
			const audioId = `elevenlabs-direct-tts-${Date.now()}`;

			// Get or create container for audio elements
			let audioContainer = document.getElementById(
				'elevenlabs-direct-audio-container'
			);
			if (!audioContainer) {
				audioContainer = document.createElement('div');
				audioContainer.id = 'elevenlabs-direct-audio-container';
				audioContainer.style.display = 'none';
				document.body.appendChild(audioContainer);
			}

			// Create audio element
			const audioElement = document.createElement('audio');
			audioElement.id = audioId;
			audioContainer.appendChild(audioElement);

			// Set up request info
			const endpoint = 'https://api.elevenlabs.io/v1/text-to-speech';

			// Get API key with improved handling
			let keyToUse = '';

			// Try the state value first (which is populated from props, env vars, or localStorage)
			if (apiKey) {
				keyToUse = apiKey;
				console.log('Using API key from state');
			}
			// Then try localStorage as fallback
			else {
				const storedKey = localStorage.getItem('elevenlabs-api-key');
				if (storedKey) {
					keyToUse = storedKey;
					console.log('Using API key from localStorage');
				}
				// If still no key, prompt the user
				else {
					const promptedKey = prompt(
						'Please enter your ElevenLabs API key to enable voice features:'
					);
					if (promptedKey) {
						localStorage.setItem('elevenlabs-api-key', promptedKey);
						setApiKey(promptedKey);
						keyToUse = promptedKey;
						console.log('API key saved for future use');
					} else {
						console.error(
							"No API key provided - can't perform TTS"
						);
						alert(
							'ElevenLabs API key is required for voice features. Voice will not work.'
						);
						return false;
					}
				}
			}

			// Ensure we have an API key
			if (!keyToUse) {
				console.error('No valid API key available');
				return false;
			}

			const headers = new Headers({
				'Content-Type': 'application/json',
				'xi-api-key': keyToUse,
			});

			// Log what we're sending (without the API key)
			console.log(
				`Sending TTS request to ${endpoint} for voice ID ${agentId}`
			);

			// Basic TTS settings
			const ttsPayload = {
				text: text,
				model_id: 'eleven_turbo_v2',
				voice_settings: {
					stability: 0.5,
					similarity_boost: 0.75,
				},
			};

			// Make API request
			const response = await fetch(`${endpoint}/${agentId}`, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify(ttsPayload),
			});

			if (!response.ok) {
				const errorData = await response.text();
				console.error(
					`ElevenLabs API error (${response.status}):`,
					errorData
				);
				throw new Error(
					`ElevenLabs API error: ${response.status} - ${errorData}`
				);
			}

			// Get audio blob
			const audioBlob = await response.blob();

			// Create object URL
			const audioUrl = URL.createObjectURL(audioBlob);

			// Set audio source
			audioElement.src = audioUrl;

			// Set up event listeners
			audioElement.onplay = () => {
				console.log('▶️ Direct TTS audio playback started');
				setIsPlayingAudio(true);
			};

			audioElement.onended = () => {
				console.log('⏹️ Direct TTS audio playback ended');
				setIsPlayingAudio(false);
				// Clean up
				URL.revokeObjectURL(audioUrl);
				audioElement.remove();
			};

			audioElement.onerror = (e) => {
				console.error('❌ Direct TTS audio playback error:', e);
				setIsPlayingAudio(false);
				// Clean up
				URL.revokeObjectURL(audioUrl);
				audioElement.remove();
			};

			// Play the audio
			console.log('🔊 Playing direct TTS audio...');
			const playPromise = audioElement.play();

			// Handle play promise
			if (playPromise !== undefined) {
				playPromise.catch((error) => {
					console.error('❌ Direct TTS audio play error:', error);
					// Try to create a user interaction triggered play button
					if (error.name === 'NotAllowedError') {
						console.log(
							'⚠️ Audio autoplay blocked - creating interactive button'
						);
						createManualPlayButton(audioUrl, text);
					}
				});
			}

			return true;
		} catch (error) {
			console.error('❌ Direct TTS failed:', error);
			return false;
		}
	};

	// Helper function to create a manual play button when autoplay is blocked
	const createManualPlayButton = (audioUrl: string, text: string) => {
		// Create a simple play button that overlays the chat
		const playButtonContainer = document.createElement('div');
		playButtonContainer.style.position = 'fixed';
		playButtonContainer.style.bottom = '80px';
		playButtonContainer.style.right = '20px';
		playButtonContainer.style.backgroundColor = '#3b82f6';
		playButtonContainer.style.color = 'white';
		playButtonContainer.style.padding = '8px 16px';
		playButtonContainer.style.borderRadius = '8px';
		playButtonContainer.style.cursor = 'pointer';
		playButtonContainer.style.zIndex = '50';
		playButtonContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
		playButtonContainer.innerText = '🔊 Tap to hear response';

		playButtonContainer.onclick = () => {
			const audio = new Audio(audioUrl);
			audio
				.play()
				.then(() => {
					console.log('▶️ Manual play started');
					// Remove the button after starting playback
					playButtonContainer.remove();
				})
				.catch((e) => {
					console.error('❌ Manual play failed:', e);
					playButtonContainer.innerText = '❌ Failed to play audio';
					setTimeout(() => {
						playButtonContainer.remove();
					}, 3000);
				});
		};

		document.body.appendChild(playButtonContainer);

		// Auto remove after 10 seconds if not clicked
		setTimeout(() => {
			if (document.body.contains(playButtonContainer)) {
				playButtonContainer.remove();
			}
		}, 10000);
	};

	// Modify the speakText function to use direct TTS if SDK fails
	const speakText = async (text: string) => {
		if (!text || isMuted) return;

		console.log(
			'🔊 Attempting to speak text:',
			text.substring(0, 50) + '...'
		);

		let sdkSuccess = false;

		// First try with the SDK
		try {
			// Don't create a new session - use the existing conversation object
			if (conversation && status === 'connected') {
				sdkSuccess = trySpeaking(text);
			} else if (!connectionInProgress) {
				// If not connected, connect once then speak
				console.log('Voice not connected, connecting once...');
				setConnectionInProgress(true);

				try {
					// Start a session only if we don't have one
					// Make sure agentId is not undefined
					if (!agentId) {
						console.error(
							'Cannot start session: No agent ID provided'
						);
						setConnectionInProgress(false);
						return;
					}

					// Use the voice ID as a string for the startSession method
					const voiceId: string = agentId;

					// Now call startSession with the string voice ID
					await conversation.startSession({
						agentId: voiceId, // Now this is guaranteed to be a string
						// Override default settings to avoid greeting
						overrides: {
							agent: {
								firstMessage: '',
							},
						},
					});

					console.log('Connected successfully, now speaking');
					setTimeout(() => {
						sdkSuccess = trySpeaking(text);
						setConnectionInProgress(false);
					}, 500);
				} catch (error) {
					console.error('Failed to connect for speech:', error);
					setConnectionInProgress(false);
					// Let the fallback handle it
					sdkSuccess = false;
				}
			}
		} catch (e) {
			console.error('Failed to speak text with SDK:', e);
			setConnectionInProgress(false);
			sdkSuccess = false;
		}

		// If SDK failed, try direct API
		if (!sdkSuccess && !isMuted) {
			console.log(
				'SDK speech failed or not available, trying direct API...'
			);
			directTTS(text);
		}
	};

	// Modify trySpeaking to return success status
	const trySpeaking = (text: string): boolean => {
		if (!conversation) return false;

		try {
			console.log(
				'🔈 SPEAKING TEXT through ElevenLabs SDK:',
				text.substring(0, 50) + '...'
			);
			console.log('🔈 Conversation object status:', status);
			console.log(
				'🔈 Available methods:',
				Object.keys(conversation).join(', ')
			);

			// Try to use the correct method for the ElevenLabs version
			if (typeof (conversation as any).playText === 'function') {
				// Modern method
				console.log('🔈 Using playText method');
				(conversation as any).playText(text);
				return true;
			} else if (typeof (conversation as any).text === 'function') {
				// Alternative method
				console.log('🔈 Using text method');
				(conversation as any).text(text);
				return true;
			} else if (typeof (conversation as any).send === 'function') {
				// Fallback to sending a message
				console.log('🔈 Using send method fallback');
				(conversation as any).send({
					type: 'text',
					text: text,
				});
				return true;
			} else {
				console.error(
					'🔈 NO VALID SPEAKING METHOD FOUND ON CONVERSATION OBJECT'
				);
				playTestSound(); // Try to play a test sound to check audio
				return false;
			}
		} catch (error) {
			console.error('🔈 Error during speech synthesis:', error);
			playTestSound(); // Try a test sound on error
			return false;
		}
	};

	// Add API key settings button
	const setElevenLabsKey = () => {
		try {
			const currentKey =
				apiKey || localStorage.getItem('elevenlabs-api-key') || '';
			const newKey = prompt('Enter your ElevenLabs API key:', currentKey);

			if (newKey !== null) {
				// Not cancelled
				if (newKey.trim()) {
					localStorage.setItem('elevenlabs-api-key', newKey.trim());
					setApiKey(newKey.trim());
					alert('API key saved. Voice features should now work.');
				} else {
					localStorage.removeItem('elevenlabs-api-key');
					setApiKey(null);
					alert('API key removed. Voice features will not work.');
				}
			}
		} catch (e) {
			console.error('Error setting API key:', e);
		}
	};

	// Also modify the test direct API function
	const testDirectElevenLabsAPI = async () => {
		try {
			console.log('🔊 Testing direct ElevenLabs API...');

			// This is a backup method to test if the ElevenLabs SDK is the issue
			// It makes a direct API call to generate speech
			const testButton = document.getElementById(
				'elevenlabs-test-direct'
			);
			if (testButton) {
				testButton.textContent = 'Testing...';
			}

			// Use the direct TTS function we created
			const success = await directTTS(
				'This is a direct test of the ElevenLabs voice API using your API key.'
			);

			if (success) {
				console.log('✅ Direct ElevenLabs API test succeeded');
				if (testButton) {
					testButton.textContent = 'API Success';
					setTimeout(() => {
						testButton.textContent = 'Test API';
					}, 3000);
				}
			} else {
				console.error('❌ Direct ElevenLabs API test failed');
				if (testButton) {
					testButton.textContent = 'API Failed';
					setTimeout(() => {
						testButton.textContent = 'Test API';
					}, 3000);
				}
			}
		} catch (error) {
			console.error('❌ Direct ElevenLabs API test failed:', error);
			const testButton = document.getElementById(
				'elevenlabs-test-direct'
			);
			if (testButton) {
				testButton.textContent = 'API Failed';
				setTimeout(() => {
					testButton.textContent = 'Test API';
				}, 3000);
			}
		}
	};

	// Fix the ensureElevenLabsConnection function to work properly with TypeScript
	const ensureElevenLabsConnection = async () => {
		if (!agentId) {
			console.warn(
				'No ElevenLabs Agent ID provided. Voice features will not work.'
			);
			return;
		}

		// At this point, agentId is guaranteed to be a string (not undefined)
		// Save it to a string variable to satisfy TypeScript
		const voiceId: string = agentId;

		if (status !== 'connected' && !connectionInProgress) {
			try {
				setConnectionInProgress(true);
				console.log(
					'⚠️ CONNECTING TO ELEVENLABS - ONE TIME CONNECTION ⚠️'
				);
				console.log('⚠️ Using Agent ID:', voiceId);

				// Test if we can create an audio element first
				try {
					const testAudio = new Audio();
					console.log(
						'📢 Audio element created successfully:',
						!!testAudio
					);
				} catch (e) {
					console.error('📢 Failed to create audio element:', e);
				}

				// Connect only once with settings to prevent the greeting
				await conversation.startSession({
					agentId: voiceId, // Use the string variable that's guaranteed to be a string
					// Override default settings to avoid greeting
					overrides: {
						agent: {
							firstMessage: '',
						},
					},
				});

				console.log('✅ ElevenLabs session started successfully');
				setElevenlabsConnected(true);

				// Force a test message to verify the voice stream
				setTimeout(() => {
					if (!isMuted) {
						playTestSound();
						console.log(
							'🔈 Testing ElevenLabs audio with message...'
						);
						trySpeaking('Audio test. Can you hear this message?');
					}
				}, 1000);
			} catch (error) {
				console.error('❌ Failed to start ElevenLabs session:', error);

				const errorString = String(error);
				console.error('❌ Error details:', errorString);

				if (
					errorString.includes('agent') &&
					errorString.includes('does not exist')
				) {
					setAgentError(true);
					console.error('❌ Agent ID does not exist:', agentId);
				}
			} finally {
				setConnectionInProgress(false);
			}
		}
	};

	// Critical: Initialize the connection once on component mount
	useEffect(() => {
		// Set up the ElevenLabs connection once when the component is mounted
		if (agentId && !isMuted) {
			console.log('Initializing ElevenLabs connection on mount');
			ensureElevenLabsConnection();
		}
	}, [agentId, isMuted]); // Only re-run if these critical dependencies change

	// Fix the microphone toggle to use existing connection
	const toggleMicrophone = async (): Promise<void> => {
		// If no agent ID, show alert
		if (!agentId) {
			alert(
				'No ElevenLabs Agent ID configured. Voice features will not work.'
			);
			return; // Explicit return for the early exit
		}

		// Save agentId to a string variable since we've confirmed it's not null/undefined
		const voiceId: string = agentId;

		// If already connecting, do nothing
		if (connectionInProgress) {
			console.log('Connection in progress, ignoring request');
			return; // Explicit return for the early exit
		}

		try {
			// If currently listening, stop listening
			if (isListening) {
				console.log('Stopping listening');
				// Set mic active state to false
				setIsMicActive(false);
				// Set listening state to false
				setIsListening(false);
				// Update UI state
				if (conversation) {
					conversation.micMuted = true;
				}
				return; // Explicit return for this condition
			}

			// Check for microphone permission
			if (micPermission === 'unknown') {
				console.log('Requesting microphone permission');
				try {
					// Request microphone access using standard constraints
					const stream = await navigator.mediaDevices.getUserMedia({
						audio: true,
					});

					// If we got here, permission was granted
					setMicPermission('granted');
					// Clean up the stream
					stream.getTracks().forEach((track) => track.stop());
				} catch (err) {
					console.error('Microphone permission denied:', err);
					setMicPermission('denied');
					alert(
						'Microphone permission denied. Please allow microphone access to use voice features.'
					);
					return; // Explicit return for the error case
				}
			} else if (micPermission === 'denied') {
				alert(
					'Microphone permission denied. Please allow microphone access in your browser settings.'
				);
				return; // Explicit return for the error case
			}

			// Not listening, start listening
			console.log('Starting listening');

			// Make sure we have a connection
			if (status !== 'connected') {
				setConnectionInProgress(true);

				try {
					// Connect once with settings to prevent the greeting
					await conversation.startSession({
						agentId: voiceId, // Use the string variable
						// Override default settings to avoid greeting
						overrides: {
							agent: {
								firstMessage: '',
							},
						},
					});

					setElevenlabsConnected(true);
				} catch (error) {
					console.error('Failed to connect ElevenLabs:', error);
					alert(
						'Could not connect to voice service. Please try again.'
					);
					setConnectionInProgress(false);
					return;
				}

				setConnectionInProgress(false);
			}

			// Update UI state
			setIsListening(true);
			setIsMicActive(true);

			// Enable microphone in conversation
			if (conversation) {
				conversation.micMuted = false;
			}

			// Reset transcription counter
			setMicTranscriptionCount(0);

			return; // Explicit return at the end
		} catch (error: unknown) {
			console.error('Error toggling microphone:', error);
			setIsListening(false);
			setIsMicActive(false);
			if (conversation) {
				conversation.micMuted = true;
			}

			// Type guard for the error message
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error';
			alert(`Microphone error: ${errorMessage}`);
			return;
		}
	};

	// Fix the microphone keep-alive mechanism
	useEffect(() => {
		if (!isListening || !agentId) return;

		console.log('🔄 Setting up microphone monitoring system');

		// Set up a more frequent check for microphone activity
		const micCheckInterval = setInterval(() => {
			// If we've detected sound but still no transcription after a few seconds,
			// there's likely a problem with the microphone connection
			if (micInputLevelRef.current > 30 && micTranscriptionCount === 0) {
				console.log(
					'🔄 Microphone appears to be working but not transcribing - attempting to fix'
				);

				// Reset the connection by toggling micMuted state
				const softReconnectMic = async () => {
					try {
						// Temporarily reset the isListening state
						setIsListening(false);

						// Short delay
						await new Promise((resolve) =>
							setTimeout(resolve, 300)
						);

						// Then turn it back on
						setIsListening(true);

						console.log('🔄 Attempted microphone soft reset');
					} catch (e) {
						console.error('Failed soft mic reset:', e);
					}
				};

				softReconnectMic();
			}
		}, 4000);

		// More aggressive last-resort reconnection if no transcriptions after 15 seconds
		const reconnectionTimeout = setTimeout(() => {
			if (
				isListening &&
				micTranscriptionCount === 0 &&
				!connectionInProgress
			) {
				console.log(
					'⚠️ No transcriptions received after extended period - performing full reconnection'
				);

				// Perform a full reconnection
				const fullReconnect = async () => {
					try {
						console.log(
							'Attempting full ElevenLabs reconnection for microphone'
						);

						// First disable listening
						setIsListening(false);

						// Wait a moment
						await new Promise((resolve) =>
							setTimeout(resolve, 500)
						);

						// End current session
						conversation.endSession();

						// Wait a moment
						await new Promise((resolve) =>
							setTimeout(resolve, 1000)
						);

						// Start fresh session
						await conversation.startSession({ agentId });

						// Wait for connection to stabilize
						await new Promise((resolve) =>
							setTimeout(resolve, 1500)
						);

						// Make sure we're still in listening mode
						setIsListening(true);

						console.log(
							'✅ Completed full microphone reconnection'
						);

						// Add helpful message
						addMessage(
							'ai',
							"I've reset the microphone connection. Please try speaking again."
						);
					} catch (e) {
						console.error('Failed full reconnection:', e);
					}
				};

				fullReconnect();
			}
		}, 15000);

		return () => {
			clearInterval(micCheckInterval);
			clearTimeout(reconnectionTimeout);
		};
	}, [
		isListening,
		micTranscriptionCount,
		agentId,
		conversation,
		connectionInProgress,
	]);

	// Replace the preventSessionDisconnect function with a more robust one
	const keepSessionAlive = useRef<NodeJS.Timeout | null>(null);

	// Use this when handling active sessions
	useEffect(() => {
		// Clear any existing interval
		if (keepSessionAlive.current) {
			clearInterval(keepSessionAlive.current);
			keepSessionAlive.current = null;
		}

		// If we have an active conversation and we're connected, set up a ping mechanism
		if (activeConversation && status === 'connected' && !isMuted) {
			console.log('Setting up keep-alive for ElevenLabs session');

			// Create a new interval to periodically check on the session
			keepSessionAlive.current = setInterval(() => {
				console.log('Keeping ElevenLabs session alive');
				// This is mostly a logging placeholder - the main protection is
				// preventing the session from being closed prematurely
			}, 5000); // Check every 5 seconds
		}

		// Cleanup interval when component unmounts or when parameters change
		return () => {
			if (keepSessionAlive.current) {
				clearInterval(keepSessionAlive.current);
				keepSessionAlive.current = null;
			}
		};
	}, [activeConversation, status, isMuted]);

	// Effect to ensure ElevenLabs stays connected during a chat
	useEffect(() => {
		if (
			activeConversation &&
			status !== 'connected' &&
			!isMuted &&
			!connectionInProgress &&
			agentId
		) {
			console.log('Reconnecting ElevenLabs during active conversation');
			ensureElevenLabsConnection();
		}
	}, [activeConversation, status, isMuted, connectionInProgress, agentId]);

	// Effect to scroll chat log to bottom when messages are added
	useEffect(() => {
		if (chatLogRef.current) {
			chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
		}
	}, [conversationHistory, streamingMessage]);

	// Toggle mute state
	const toggleMute = () => {
		setIsMuted(!isMuted);
	};

	// Helper to determine microphone button state
	const getMicButtonStyles = () => {
		if (connectionInProgress) {
			return {
				backgroundColor: '#fbbf24', // Yellow during connection
				color: 'white',
			};
		}

		if (isListening) {
			// Green when listening, brighter green when actively receiving transcriptions
			return {
				backgroundColor: isMicActive ? '#10b981' : '#22c55e',
				color: 'white',
			};
		}

		if (micPermission === 'denied') {
			return {
				backgroundColor: '#ef4444', // Red when denied
				color: 'white',
			};
		}

		return {
			backgroundColor: '#e5e7eb', // Default gray
			color: '#374151',
		};
	};

	// Add a flag to track if we're currently playing audio
	const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

	// At the top of useEffect for status
	useEffect(() => {
		// Log when the connection status changes
		console.log(`ElevenLabs connection status changed to: ${status}`);

		// Track speaking state changes to prevent disconnection during audio
		if (isSpeaking && !isPlayingAudio) {
			console.log('🎧 AUDIO PLAYBACK STARTED - PRESERVING CONNECTION');
			setIsPlayingAudio(true);
		} else if (!isSpeaking && isPlayingAudio) {
			console.log('🎧 AUDIO PLAYBACK ENDED');
			setIsPlayingAudio(false);
		}

		// If we have an active conversation and the status is 'connecting',
		// log detailed information to help with debugging
		if (activeConversation && status === 'connecting') {
			console.log('Attempting to connect while in active conversation');
			console.log('Current state:', {
				activeConversation,
				isMuted,
				connectionInProgress,
				agentId,
				conversationHistoryLength: conversationHistory.length,
				streamingMessage: streamingMessage
					? 'Yes (length: ' + streamingMessage.length + ')'
					: 'No',
			});
		}
	}, [status, activeConversation, isSpeaking, isPlayingAudio]);

	// At the top of your component, add this ref
	const audioContainerRef = useRef<HTMLDivElement | null>(null);

	// Add a useEffect to create and manage the audio container outside of React's lifecycle
	useEffect(() => {
		// This effect creates a stable DOM container for audio playback
		// that doesn't get affected by React's reconciliation

		// First, create the audio container if it doesn't exist
		if (!document.getElementById('elevenlabs-audio-container')) {
			const container = document.createElement('div');
			container.id = 'elevenlabs-audio-container';
			container.style.display = 'none';
			document.body.appendChild(container);
		}

		// Store reference to the container
		audioContainerRef.current = document.getElementById(
			'elevenlabs-audio-container'
		) as HTMLDivElement;

		// On cleanup, we DO NOT remove the container
		// This prevents the removeChild error by keeping the container stable
		return () => {
			// Instead of removing, just make sure any audio elements are paused
			const audioElements =
				audioContainerRef.current?.querySelectorAll('audio');
			if (audioElements && audioElements.length) {
				audioElements.forEach((audio) => {
					if (!audio.paused) {
						audio.pause();
					}
				});
			}
		};
	}, []);

	// Add back the robust cleanup logic for ElevenLabs
	useEffect(() => {
		return () => {
			// End any interval to keep the session alive
			if (keepSessionAlive.current) {
				clearInterval(keepSessionAlive.current);
				keepSessionAlive.current = null;
			}

			// IMPORTANT: Instead of immediately ending the session,
			// prepare it for cleanup without DOM modification
			if (status === 'connected' && !isPlayingAudio) {
				try {
					console.log(
						'Preparing ElevenLabs session for clean shutdown'
					);
					// Don't end immediately
					setTimeout(() => {
						try {
							conversation.endSession();
						} catch (e) {
							console.log(
								'Ignoring error during delayed session end:',
								e
							);
						}
					}, 500);
				} catch (e) {
					console.log('Ignoring error during session cleanup:', e);
				}
			} else {
				console.log(
					'Not disconnecting ElevenLabs - audio might still be playing'
				);
			}
		};
	}, [status, conversation, isPlayingAudio]);

	// Add a pulsing effect when the mic is active
	const MicrophonePulse = ({
		isActive,
		transcriptionCount,
	}: {
		isActive: boolean;
		transcriptionCount: number;
	}) => {
		if (!isActive && transcriptionCount === 0) return null;

		return (
			<div
				className={`absolute -inset-1 rounded-full animate-pulse ${
					isActive
						? 'bg-green-500 opacity-30'
						: 'bg-yellow-500 opacity-20'
				}`}
			/>
		);
	};

	// Add these state variables to better track mic activity
	const [isMicActive, setIsMicActive] = useState<boolean>(false);

	// Add this ref for microphone activity tracking
	const micInactiveTimer = useRef<NodeJS.Timeout | null>(null);

	// Add this ref to store the mic input level
	const micInputLevelRef = useRef<number>(0);

	// Add a useEffect to implement audio visualization to help debug mic input levels
	useEffect(() => {
		if (!isListening) return;

		// Setup audio context and analyzer for mic input level visualization
		let audioContext: AudioContext | null = null;
		let analyzer: AnalyserNode | null = null;
		let dataArray: Uint8Array | null = null;
		let source: MediaStreamAudioSourceNode | null = null;
		let animationFrame: number | null = null;

		const visualizeMicInput = async () => {
			try {
				// Create audio context
				audioContext = new (window.AudioContext ||
					(window as any).webkitAudioContext)();

				// Get microphone stream
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});

				// Create analyzer
				analyzer = audioContext.createAnalyser();
				analyzer.fftSize = 32;

				// Create buffer for analyzer data
				const bufferLength = analyzer.frequencyBinCount;
				dataArray = new Uint8Array(bufferLength);

				// Connect microphone to analyzer
				source = audioContext.createMediaStreamSource(stream);
				source.connect(analyzer);

				// Animation function to continuously check mic levels
				const checkMicLevel = () => {
					if (!analyzer || !dataArray) return;

					analyzer.getByteFrequencyData(dataArray);

					// Calculate average input level
					let sum = 0;
					for (let i = 0; i < dataArray.length; i++) {
						sum += dataArray[i];
					}
					const avg = sum / dataArray.length;

					// Store the input level for UI display and debugging
					micInputLevelRef.current = avg;

					// Log significant input levels to help with debugging
					if (avg > 30) {
						console.log(
							`🎤 Microphone input level: ${avg.toFixed(1)}`
						);
					}

					// If we're hearing sound but not getting transcriptions
					if (avg > 40 && micTranscriptionCount === 0) {
						console.log(
							'⚠️ WARNING: Detecting audio input but no transcriptions received'
						);
					}

					// Request next animation frame
					animationFrame = requestAnimationFrame(checkMicLevel);
				};

				// Start the animation loop
				checkMicLevel();
			} catch (error) {
				console.error('Error setting up mic visualization:', error);
			}
		};

		// Start visualization
		visualizeMicInput();

		// Cleanup
		return () => {
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}
			if (source) {
				source.disconnect();
			}
			if (audioContext) {
				audioContext.close();
			}
		};
	}, [isListening, micTranscriptionCount]);

	// Reset dialogue when document context changes (FIXED for proper context maintenance)
	useEffect(() => {
		// Only reset the dialogue when documentId changes, not on page changes
		// and only if we have a valid document context to work with
		if (documentId && currentPage !== undefined && pageContent) {
			console.log(
				'Document context changed to:',
				documentId,
				'page:',
				currentPage
			);

			// If document ID has changed, we need a complete reset
			// For page changes, we update the context but preserve the dialogue ID
			const documentChanged =
				dialogueId && documentIdRef.current !== documentId;

			// Update our reference to the current document ID
			documentIdRef.current = documentId;

			if (documentChanged) {
				console.log(
					'Document ID changed - performing full conversation reset'
				);

				// For document changes, we do a complete reset
				setDialogueId(null);
				setConversationHistory([
					{
						role: 'system',
						content: `Document Context for ${documentId}, page ${currentPage}: ${pageContent.summary}`,
					},
				]);
				setConversationMessages([]);
			} else if (conversationHistory.length === 0) {
				// Initialize conversation history with context if it's empty
				setConversationHistory([
					{
						role: 'system',
						content: `Document Context for ${documentId}, page ${currentPage}: ${pageContent.summary}`,
					},
				]);
			} else if (
				conversationHistory.length > 0 &&
				conversationHistory[0].role === 'system'
			) {
				// Update existing system message with fresh context
				const updatedHistory = [...conversationHistory];
				updatedHistory[0] = {
					role: 'system',
					content: `Document Context for ${documentId}, page ${currentPage}: ${pageContent.summary}`,
				};
				setConversationHistory(updatedHistory);
			}
		}
	}, [documentId, currentPage, pageContent, documentSummary, dialogueId]);

	// Add a ref to track document ID changes
	const documentIdRef = useRef<string | null>(null);

	// Add notification when page changes while chat is open
	const prevPageRef = useRef<number | undefined>(currentPage);
	const initialRenderRef = useRef(true);

	useEffect(() => {
		if (initialRenderRef.current) {
			// Skip the first render/initialization
			initialRenderRef.current = false;
			prevPageRef.current = currentPage;
			return;
		}

		// Only notify if the chat is open and page actually changes
		if (
			isChatOpen &&
			prevPageRef.current !== undefined &&
			currentPage !== undefined &&
			prevPageRef.current !== currentPage &&
			pageContent
		) {
			console.log(
				`Page changed from ${prevPageRef.current} to ${currentPage}`
			);

			// Update the previous page reference
			prevPageRef.current = currentPage;

			// Add a notification message about the page change
			const pageChangeMsg = `You've moved to page ${currentPage}. 

This page contains information about: ${pageContent.summary}

People mentioned: ${pageContent.names?.join(', ') || 'None'}
Places mentioned: ${pageContent.places?.join(', ') || 'None'}
Objects mentioned: ${pageContent.objects?.join(', ') || 'None'}`;

			// Add to UI messages
			addMessage('ai', pageChangeMsg);

			// CRITICAL: Also update conversation history with the new page context
			// This ensures the context is preserved across page changes
			setConversationHistory((history) => {
				let updatedHistory = [...history];

				// If first message is system message, update it with new context
				if (
					updatedHistory.length > 0 &&
					updatedHistory[0].role === 'system'
				) {
					updatedHistory[0] = {
						role: 'system',
						content: `Document Context for ${documentId}, page ${currentPage}: ${pageContent.summary}`,
					};
				} else {
					// Add a new system message with context
					updatedHistory.unshift({
						role: 'system',
						content: `Document Context for ${documentId}, page ${currentPage}: ${pageContent.summary}`,
					});
				}

				// Add the page change notification as an assistant message
				updatedHistory.push({
					role: 'assistant',
					content: pageChangeMsg,
				});

				return updatedHistory;
			});
		} else if (
			prevPageRef.current === undefined &&
			currentPage !== undefined
		) {
			// Initialize the previous page reference without adding a message
			prevPageRef.current = currentPage;
		}
	}, [currentPage, isChatOpen, pageContent, addMessage, documentId]);

	// Also add similar functionality to welcome message
	const [hasShownWelcomeMessage, setHasShownWelcomeMessage] =
		useState<boolean>(false);

	useEffect(() => {
		// Only show welcome message once when chat is first opened
		if (
			isChatOpen &&
			!hasShownWelcomeMessage &&
			conversationMessages.length === 0 &&
			documentSummary &&
			pageContent
		) {
			// Create a welcome message with document context
			const welcomeMsg = `Welcome! I'm your JFK Document Assistant. I'm currently looking at document ${documentId}, page ${
				currentPage || 1
			}.
      
This page contains information about: ${pageContent.summary}

People mentioned: ${pageContent.names?.join(', ') || 'None'}
Places mentioned: ${pageContent.places?.join(', ') || 'None'}
Objects mentioned: ${pageContent.objects?.join(', ') || 'None'}

How can I help you understand this document?`;

			// Add to UI messages
			addMessage('ai', welcomeMsg);

			// IMPORTANT: Also add to API conversation history to maintain context
			setConversationHistory([
				{
					role: 'system',
					content: `Document Context for ${documentId}, page ${currentPage}: ${pageContent.summary}`,
				},
				{ role: 'assistant', content: welcomeMsg },
			]);

			// Speak welcome message
			if (!isMuted && agentId) {
				setTimeout(() => {
					speakText(welcomeMsg);
				}, 500);
			}

			setHasShownWelcomeMessage(true);
		} else if (!isChatOpen) {
			// Reset the flag when chat is closed so next time it opens we can show welcome again
			setHasShownWelcomeMessage(false);
		}
	}, [
		isChatOpen,
		hasShownWelcomeMessage,
		conversationMessages.length,
		documentId,
		currentPage,
		documentSummary,
		pageContent,
		addMessage,
		agentId,
		isMuted,
	]);

	// Add a test sound function to verify audio is working
	const playTestSound = () => {
		try {
			console.log('🔊 Playing test sound to verify audio output');
			const audio = new Audio(
				'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
			);
			audio.volume = 0.5;
			audio
				.play()
				.then(() => {
					console.log(
						'✅ Test sound playback initiated successfully'
					);
				})
				.catch((e) => {
					console.error('❌ Test sound failed:', e);
				});
		} catch (e) {
			console.error('❌ Error creating test sound:', e);
		}
	};

	return (
		<div
			style={{
				position: 'fixed',
				bottom: '20px',
				right: '20px',
				zIndex: 40,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'flex-end',
			}}
		>
			{/* Chat Button */}
			<button
				onClick={() => setIsChatOpen(!isChatOpen)}
				style={{
					width: '60px',
					height: '60px',
					borderRadius: '30px',
					backgroundColor: '#3b82f6',
					color: 'white',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
					border: 'none',
					cursor: 'pointer',
					marginBottom: isChatOpen ? '10px' : '0',
				}}
			>
				<MessageSquare style={{ width: '24px', height: '24px' }} />
			</button>

			{/* Chat Panel */}
			{isChatOpen && (
				<div
					style={{
						width: '350px',
						backgroundColor: 'white',
						borderRadius: '8px',
						boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
						display: 'flex',
						flexDirection: 'column',
						overflow: 'hidden',
						maxHeight: '500px',
					}}
				>
					{/* Chat Header */}
					<div
						style={{
							padding: '10px 15px',
							backgroundColor: '#3b82f6',
							color: 'white',
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
						}}
					>
						<div>
							<h3
								style={{
									margin: 0,
									fontSize: '14px',
									fontWeight: 'bold',
								}}
							>
								JFK Document Assistant
								{isSpeaking && ' (Speaking...)'}
								{isListening &&
									' (Listening' +
										(micInputLevelRef.current > 20
											? ' 🎤 ' +
											  '|'.repeat(
													Math.min(
														10,
														Math.floor(
															micInputLevelRef.current /
																10
														)
													)
											  )
											: '...') +
										')'}
								{connectionInProgress && ' (Connecting...)'}
							</h3>
							{/* Add document context info */}
							{pageContent && (
								<div
									style={{
										fontSize: '12px',
										opacity: 0.9,
										marginTop: '2px',
									}}
								>
									Page {currentPage} of Document{' '}
									{documentId.substring(0, 8)}...
								</div>
							)}
						</div>
						<div style={{ display: 'flex', gap: '8px' }}>
							<button
								onClick={toggleMute}
								style={{
									background: 'none',
									border: 'none',
									color: 'white',
									cursor: 'pointer',
									padding: '0',
								}}
								title={isMuted ? 'Unmute audio' : 'Mute audio'}
							>
								{isMuted ? (
									<VolumeX
										style={{
											width: '18px',
											height: '18px',
										}}
									/>
								) : (
									<Volume2
										style={{
											width: '18px',
											height: '18px',
										}}
									/>
								)}
							</button>
							{/* Debug button - Let's add a simple test button */}
							<button
								onClick={() => {
									console.log(
										'🔍 DEBUG: ElevenLabs Status:',
										status
									);
									console.log(
										'🔍 DEBUG: Connected:',
										elevenlabsConnected
									);
									console.log('🔍 DEBUG: Agent ID:', agentId);
									console.log('🔍 DEBUG: Is Muted:', isMuted);
									console.log(
										'🔍 DEBUG: API Key:',
										apiKey ? 'Set' : 'Not set'
									);

									// Test creating and speaking with the conversation object
									if (!isMuted) {
										playTestSound();

										// Try to speak with current configuration
										speakText(
											'This is a test message to verify audio is working correctly.'
										);
									}
								}}
								style={{
									background: 'none',
									border: 'none',
									color: 'white',
									cursor: 'pointer',
									padding: '0',
									fontSize: '10px',
								}}
								title='Test Audio'
							>
								🔊
							</button>
							{/* Add direct API test button */}
							<button
								id='elevenlabs-test-direct'
								onClick={testDirectElevenLabsAPI}
								style={{
									background: 'none',
									border: 'none',
									color: 'white',
									cursor: 'pointer',
									padding: '0',
									fontSize: '10px',
								}}
								title='Test Direct API'
							>
								Test API
							</button>
							{/* Add API key setting button */}
							<button
								onClick={setElevenLabsKey}
								style={{
									background: 'none',
									border: 'none',
									color: 'white',
									cursor: 'pointer',
									padding: '0',
									fontSize: '10px',
								}}
								title='Set ElevenLabs API Key'
							>
								🔑
							</button>
							<button
								onClick={() => setIsChatOpen(false)}
								style={{
									background: 'none',
									border: 'none',
									color: 'white',
									cursor: 'pointer',
									padding: '0',
								}}
								title='Close chat'
							>
								<X style={{ width: '18px', height: '18px' }} />
							</button>
						</div>
					</div>

					{/* Chat Log */}
					<div
						ref={chatLogRef}
						style={{
							height: '300px',
							overflowY: 'auto',
							padding: '10px 15px',
							flexGrow: 1,
							backgroundColor: '#f9fafb',
						}}
					>
						{/* Welcome Message - Updated with document context */}
						{conversationMessages.length === 0 &&
							!streamingMessage && (
								<div
									style={{
										color: '#6b7280',
										fontSize: '13px',
										textAlign: 'center',
										marginTop: '20px',
									}}
								>
									{pageContent
										? `Ask me about this document${
												currentPage
													? ` (page ${currentPage})`
													: ''
										  } and I'll help you understand its contents and historical context.`
										: 'Ask me anything about this JFK document!'}
								</div>
							)}

						{/* Conversation Messages */}
						{conversationMessages.map((msg, idx) => (
							<div
								key={`msg-${idx}`}
								style={{
									marginBottom: '10px',
									color:
										msg.sender === 'user'
											? '#1d4ed8'
											: '#047857',
									backgroundColor:
										msg.sender === 'user'
											? '#eff6ff'
											: '#ecfdf5',
									padding: '8px 12px',
									borderRadius: '8px',
									maxWidth: '85%',
									alignSelf:
										msg.sender === 'user'
											? 'flex-end'
											: 'flex-start',
									marginLeft:
										msg.sender === 'user' ? 'auto' : '0',
									fontSize: '13px',
								}}
							>
								<strong>
									{msg.sender === 'user'
										? 'You'
										: 'Assistant'}
									:
								</strong>{' '}
								{msg.message}
							</div>
						))}

						{/* Streaming Message */}
						{streamingMessage && (
							<div
								style={{
									marginBottom: '10px',
									color: '#047857',
									backgroundColor: '#ecfdf5',
									padding: '8px 12px',
									borderRadius: '8px',
									maxWidth: '85%',
									alignSelf: 'flex-start',
									fontSize: '13px',
								}}
							>
								<strong>Assistant:</strong> {streamingMessage}
							</div>
						)}

						{/* Connection Status Message */}
						{connectionInProgress && (
							<div
								style={{
									color: '#6b7280',
									fontSize: '13px',
									textAlign: 'center',
									marginTop: '10px',
									fontStyle: 'italic',
								}}
							>
								Connecting to voice service...
							</div>
						)}

						{/* Microphone Permission Message */}
						{micPermission === 'denied' && (
							<div
								style={{
									color: '#ef4444',
									fontSize: '13px',
									textAlign: 'center',
									marginTop: '10px',
									padding: '8px',
									backgroundColor: '#fee2e2',
									borderRadius: '4px',
								}}
							>
								Microphone access denied. Please allow access in
								your browser settings.
							</div>
						)}

						{/* Agent Error Message */}
						{agentError && (
							<div
								style={{
									color: '#ef4444',
									fontSize: '13px',
									textAlign: 'center',
									marginTop: '10px',
									padding: '8px',
									backgroundColor: '#fee2e2',
									borderRadius: '4px',
								}}
							>
								<p>
									Error: The ElevenLabs Agent ID is invalid or
									does not exist.
								</p>
								<p style={{ marginTop: '8px' }}>
									Please create an agent in ElevenLabs at{' '}
									<a
										href='https://elevenlabs.io/app/conversational-ai'
										target='_blank'
										rel='noopener noreferrer'
										style={{
											color: '#ef4444',
											textDecoration: 'underline',
										}}
									>
										elevenlabs.io/app/conversational-ai
									</a>
								</p>
							</div>
						)}

						{/* No Agent ID Message */}
						{!agentId && !agentError && (
							<div
								style={{
									color: '#f59e0b',
									fontSize: '13px',
									textAlign: 'center',
									marginTop: '10px',
									padding: '8px',
									backgroundColor: '#fef3c7',
									borderRadius: '4px',
								}}
							>
								<p>No ElevenLabs Agent ID configured.</p>
								<p style={{ marginTop: '8px' }}>
									Voice features will not work. Please create
									an agent in ElevenLabs at{' '}
									<a
										href='https://elevenlabs.io/app/conversational-ai'
										target='_blank'
										rel='noopener noreferrer'
										style={{
											color: '#d97706',
											textDecoration: 'underline',
										}}
									>
										elevenlabs.io/app/conversational-ai
									</a>
								</p>
							</div>
						)}

						{/* Add suggestion buttons at the bottom of the chat log */}
						{conversationMessages.length === 0 &&
							!streamingMessage &&
							pageContent && (
								<div
									style={{
										marginTop: '15px',
										display: 'flex',
										flexWrap: 'wrap',
										gap: '8px',
										justifyContent: 'center',
									}}
								>
									<div
										style={{
											width: '100%',
											textAlign: 'center',
											color: '#6b7280',
											fontSize: '12px',
											marginBottom: '5px',
										}}
									>
										Try asking:
									</div>
									<button
										onClick={() =>
											handleSendMessage(
												`Can you summarize this document for me?`
											)
										}
										style={{
											fontSize: '12px',
											padding: '6px 10px',
											backgroundColor: '#f3f4f6',
											border: '1px solid #e5e7eb',
											borderRadius: '12px',
											color: '#374151',
											cursor: 'pointer',
										}}
									>
										Summarize this document
									</button>
									<button
										onClick={() =>
											handleSendMessage(
												`Who are the key people mentioned on this page?`
											)
										}
										style={{
											fontSize: '12px',
											padding: '6px 10px',
											backgroundColor: '#f3f4f6',
											border: '1px solid #e5e7eb',
											borderRadius: '12px',
											color: '#374151',
											cursor: 'pointer',
										}}
									>
										Key people
									</button>
									<button
										onClick={() =>
											handleSendMessage(
												`What is the historical significance of this document?`
											)
										}
										style={{
											fontSize: '12px',
											padding: '6px 10px',
											backgroundColor: '#f3f4f6',
											border: '1px solid #e5e7eb',
											borderRadius: '12px',
											color: '#374151',
											cursor: 'pointer',
										}}
									>
										Historical significance
									</button>
									<button
										onClick={() =>
											handleSendMessage(
												`Can you explain the context of "${
													pageContent.places &&
													pageContent.places.length >
														0
														? pageContent.places[0]
														: pageContent.names &&
														  pageContent.names
																.length > 0
														? pageContent.names[0]
														: 'this document'
												}"?`
											)
										}
										style={{
											fontSize: '12px',
											padding: '6px 10px',
											backgroundColor: '#f3f4f6',
											border: '1px solid #e5e7eb',
											borderRadius: '12px',
											color: '#374151',
											cursor: 'pointer',
										}}
									>
										Explain context
									</button>
								</div>
							)}
					</div>

					{/* Input Area with Voice Button */}
					<div
						style={{
							display: 'flex',
							padding: '10px',
							borderTop: '1px solid #e5e7eb',
							backgroundColor: 'white',
						}}
					>
						<input
							type='text'
							value={userInput}
							onChange={(e) => setUserInput(e.target.value)}
							onKeyPress={(e) =>
								e.key === 'Enter' && sendMessage()
							}
							placeholder={
								isListening
									? 'Listening...'
									: connectionInProgress
									? 'Connecting...'
									: 'Type your message...'
							}
							style={{
								flexGrow: 1,
								padding: '8px 12px',
								border: '1px solid #d1d5db',
								borderRadius: '4px',
								marginRight: '8px',
								fontSize: '13px',
								backgroundColor: isListening
									? '#f0fdf4'
									: connectionInProgress
									? '#fef3c7'
									: 'white',
							}}
							disabled={connectionInProgress}
						/>
						{/* Microphone button for voice input */}
						<div className='relative'>
							<MicrophonePulse
								isActive={isMicActive}
								transcriptionCount={micTranscriptionCount}
							/>
							<button
								className={`${getMicButtonStyles()} p-2 rounded-full transition-all duration-200 relative z-10`}
								onClick={toggleMicrophone}
								disabled={connectionInProgress}
							>
								{connectionInProgress ? (
									<Loader2 className='h-5 w-5 animate-spin' />
								) : isListening ? (
									<MicOff className='h-5 w-5' />
								) : (
									<Mic className='h-5 w-5' />
								)}
							</button>
						</div>
						<button
							onClick={sendMessage}
							disabled={!userInput.trim() || connectionInProgress}
							style={{
								backgroundColor:
									!userInput.trim() || connectionInProgress
										? '#e5e7eb'
										: '#3b82f6',
								color:
									!userInput.trim() || connectionInProgress
										? '#9ca3af'
										: 'white',
								border: 'none',
								borderRadius: '4px',
								padding: '8px 12px',
								fontSize: '13px',
								cursor:
									!userInput.trim() || connectionInProgress
										? 'not-allowed'
										: 'pointer',
							}}
						>
							Send
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
