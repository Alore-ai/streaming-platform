import React, {
    MutableRefObject,
    PropsWithChildren,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import styled from "styled-components";
import {
    resetPlayer,
    setBuffer,
    setFullscreen,
    setPlaying,
    setProgress,
    setWaiting,
} from "@lib/redux/reducer/player";
import { handleFullscreen } from "@lib/player/fullscreen";
import { convertToTimeCode, DEFAULT_TIMESTAMP } from "@lib/player";
import { useWatchlist } from "@lib/watchlist/context";
import { createContext, useContext } from "react";
import { PlayerProps } from "./Player";
import { useDispatch } from "react-redux";
import { useAppSelector } from "@lib/redux";

interface PlayerContextData {
    videoRef: MutableRefObject<HTMLVideoElement | null>;
    controlsActive: boolean;
    togglePlay: () => void;
    toggleFullscreen: () => void;
    currentTimeStamp: () => string;
    missingTimeStamp: () => string;
    timeStampFromAbs: (abs: number) => string;
    jumpToAbs: (abs: number) => void;
    promptValue: string;
    setPromptValue: (value: string) => void;
}

const PlayerContext = createContext<PlayerContextData>({} as PlayerContextData);

const PlayerContainer = styled.div`
  display: flex;
  height: 100vh;
`;

const Video = styled.video`
    top: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    object-fit: contain; /* Maintain aspect ratio */
    pointer-events: none;
    user-select: none;
`;

const VideoContainer = styled.div`
  flex-grow: 1;
  flex-shrink: 1;
  position: relative;
  overflow: hidden;
`;

const PromptField = styled.input`
  background-color: lightblue;
  color: black;
  padding: 5px 10px;
  border: 2px solid blue;
  border-radius: 5px;
  font-size: 16px;
  outline: none;
  width: 80%; /* Adjust width */
  margin-bottom: 20px; /* Add some margin */
  z-index: 2;
`;

const SidePanel = styled.div`
  display: flex;
  flex-direction: column;
  width: 30%;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
`;

const ChatHistory = styled.div`
  height: calc(100vh - 100px); /* Adjust height based on your needs */
  overflow-y: auto; /* Add scrollbar if content exceeds height */
  padding: 10px;
  background-color: #f0f0f0; /* Add a background color for better visibility */
`;

export const PlayerProvider: React.FC<PropsWithChildren<PlayerProps>> = ({
    show,
    fullscreenContainer,
    children,
}) => {
    const dispatch = useDispatch();
    const playing = useAppSelector(state => state.player.playing);
    const { loading: watchlistLoading, hasShowProgress, addProgressToWatchlist } = useWatchlist();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [controlsActive, setControlsActive] = useState<boolean>(false);
    const [promptValue, setPromptValue] = useState<string>('');

    const handlePromptChange = async (promptValue: string) => {
        const newPromptValue = promptValue;

        try {
            const response = await fetch('https://alore--alore-alore-prompt-dev.modal.run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: newPromptValue })
            });

            if (response.ok) {
                console.log('Prompt sent successfully');
            } else {
                throw new Error('Failed to send prompt');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>, promptValue: string) => {
        if (event.key === 'Enter') {
            handlePromptChange(promptValue);
        }
    };

    useEffect(() => {
        if (!videoRef.current || watchlistLoading) {
            return;
        }

        const eventSource = new EventSource('https://alore--alore-alore-video-stream-dev.modal.run');

        eventSource.onmessage = (event) => {
            const videoData = JSON.parse(event.data);

            // Update the video player with the received data
            if (videoRef.current) {
                videoRef.current.src = videoData.videoUrl;
                videoRef.current.play();
            }
        };

        const progress = hasShowProgress(show.id);

        if (progress) {
            videoRef.current.currentTime = progress;
        }

        if (videoRef.current.paused) {
            videoRef.current.play();
        }

        return () => {
            // if (hls.media) {
            //     addProgressToWatchlist(show, hls.media.currentTime);
            // }

            eventSource.close();
            dispatch(resetPlayer());
        };
    }, [watchlistLoading, addProgressToWatchlist, dispatch, hasShowProgress, show]);

    const interact = useCallback(() => {
        setControlsActive(true);
        document.body.classList.remove("hide-cursor");

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        timeoutRef.current = setTimeout(() => {
            if (!playing) {
                return;
            }

            document.body.classList.add("hide-cursor");
            setControlsActive(false);
        }, 3000);
    }, [playing]);

    useEffect(() => {
        interact();
    }, [interact]);

    useEffect(() => {
        const beforeUnload = () => {
            if (!videoRef.current) {
                return;
            }

            addProgressToWatchlist(show, videoRef.current.currentTime);
        };

        document.addEventListener("mousemove", interact);
        window.addEventListener("beforeunload", beforeUnload);

        return () => {
            document.removeEventListener("mousemove", interact);
            window.removeEventListener("beforeunload", beforeUnload);

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [addProgressToWatchlist, show, interact]);

    /** Plays video if pause, else pause video. */
    const togglePlay = useCallback(() => {
        if (!videoRef.current) {
            return;
        }

        if (videoRef.current.paused) {
            videoRef.current.play();
        } else {
            videoRef.current.pause();
        }
    }, []);

    /** Opens container fullscreen if closed, else closes fullscreen. */
    const toggleFullscreen = useCallback(() => {
        if (!fullscreenContainer.current) {
            return;
        }

        handleFullscreen(fullscreenContainer.current).then(isFullscreen =>
            dispatch(setFullscreen(isFullscreen))
        );
    }, [dispatch, fullscreenContainer]);

    /** Sets play state according to video paused state. */
    const handlePlayState = useCallback(() => {
        if (!videoRef.current) {
            return;
        }

        dispatch(setPlaying(!videoRef.current.paused));
    }, [dispatch]);

    /**
     * Calculates progress from video's current time and duration.
     * @returns {number}
     */
    const calcProgress = useCallback((): number => {
        if (!videoRef.current) {
            return 0;
        }

        return videoRef.current.currentTime / videoRef.current.duration;
    }, []);

    /**
     * Calculates buffer from video's buffered length and duration.
     * @returns {number}
     */
    const calcBuffer = useCallback((): number => {
        if (!videoRef.current) {
            return 0;
        }

        const buffer = videoRef.current.buffered.end(videoRef.current.buffered.length - 1) || 0;

        return buffer / videoRef.current.duration;
    }, []);

    /**
     * Generates timestamp from absolute number and duration.
     * @param {number} abs
     * @returns {string}
     */
    const timeStampFromAbs = useCallback((abs: number): string => {
        if (!videoRef.current) {
            return DEFAULT_TIMESTAMP;
        }

        const time = videoRef.current.duration * abs;

        return convertToTimeCode(time);
    }, []);

    /**
     * Generates timestamp from current time.
     * @returns {string} Current time in time code.
     */
    const currentTimeStamp = useCallback((): string => {
        if (!videoRef.current) {
            return DEFAULT_TIMESTAMP;
        }

        return convertToTimeCode(videoRef.current.currentTime);
    }, []);

    /**
     * Generates timestamp from current time and duration.
     * @returns {string} Missing time in time code.
     */
    const missingTimeStamp = useCallback((): string => {
        if (!videoRef.current) {
            return DEFAULT_TIMESTAMP;
        }

        return convertToTimeCode(videoRef.current.duration - videoRef.current.currentTime);
    }, []);

    /**
     * Jump to specific time from absolute number and duration.
     * @param {number} abs
     */
    const jumpToAbs = useCallback((abs: number): void => {
        if (!videoRef.current) {
            return;
        }

        videoRef.current.currentTime = videoRef.current.duration * abs;
    }, []);

    /**
     * Event Listeners
     */
    const onPlay = useCallback(() => {
        handlePlayState();
    }, [handlePlayState]);

    const onPause = useCallback(() => {
        handlePlayState();
    }, [handlePlayState]);

    const onProgress = useCallback(() => {
        dispatch(setBuffer(calcBuffer()));
    }, [dispatch, calcBuffer]);

    const onTimeUpdate = useCallback(() => {
        dispatch(setProgress(calcProgress()));
        dispatch(setWaiting(false));
    }, [dispatch, calcProgress]);

    const onWaiting = useCallback(() => {
        dispatch(setWaiting(true));
    }, [dispatch]);

    const eventListeners = {
        onPlay,
        onPause,
        onProgress,
        onTimeUpdate,
        onWaiting,
    };

    return (
        <PlayerContext.Provider
            value={{
                videoRef,
                controlsActive,
                togglePlay,
                toggleFullscreen,
                currentTimeStamp,
                missingTimeStamp,
                timeStampFromAbs,
                jumpToAbs,
                promptValue,
                setPromptValue,
            }}>
            <PlayerContainer>
                <VideoContainer>
                    <Video ref={videoRef} {...eventListeners} />
                </VideoContainer>
                <SidePanel>
                    <PromptField
                        type="text"
                        placeholder="Enter your prompt here"
                        value={promptValue}
                        onChange={(event) => setPromptValue(event.target.value)}
                        onKeyPress={(event) => handleKeyPress(event, promptValue)}
                    />
                    <ChatHistory>
                        {/* Add chat history components or content here */}
                    </ChatHistory>
                </SidePanel>
            </PlayerContainer>
            {children}
        </PlayerContext.Provider>
    );
};

export const withPlayer = <T,>(WrappedComponent: React.ComponentType<T & PlayerProps>) => {
    const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component";

    const ComponentWithProvider = (props: T & PlayerProps) => {
        return (
            <PlayerProvider {...props}>
                <WrappedComponent {...props} />
            </PlayerProvider>
        );
    };

    ComponentWithProvider.displayName = `withPlayer(${displayName})`;

    return ComponentWithProvider;
};

export const usePlayer = () => useContext(PlayerContext);
