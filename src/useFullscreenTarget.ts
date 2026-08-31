import { useEffect, useState, type RefObject } from "react";

export function useFullscreenTarget(ref: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(ref.current && document.fullscreenElement === ref.current));
    };

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, [ref]);

  const toggleFullscreen = async () => {
    const target = ref.current;
    if (!target) return;

    if (document.fullscreenElement === target) {
      await document.exitFullscreen();
      return;
    }

    await target.requestFullscreen();
  };

  return { isFullscreen, toggleFullscreen };
}
