import { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, View, type GestureResponderEvent } from 'react-native';
import { G } from 'react-native-svg';
import { cameraMatrix, DEFAULT_CAMERA, MAP_HEIGHT, MAP_WIDTH, moveCamera, zoomCamera, type MapCamera } from './mapCamera';

export function useMapCamera(areaCode: string) {
  const group = useRef<G<{}>>(null);
  const viewport = useRef<View>(null);
  const camera = useRef(DEFAULT_CAMERA);
  const frame = useRef<number | null>(null);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const target = useRef<MapCamera | null>(null);
  const reduceMotion = useRef(false);
  const ignorePressUntil = useRef(0);
  const bounds = useRef({ x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT });

  function paint() {
    // Only the native SVG group changes during movement, never the 289 path props.
    group.current?.setNativeProps({ matrix: cameraMatrix(camera.current) });
  }
  function flush() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    paint();
  }
  function stop() {
    animation.current?.stop();
    animation.current = null;
    target.current = null;
    progress.removeAllListeners();
    flush();
  }
  function reset() {
    stop();
    camera.current = DEFAULT_CAMERA;
    paint();
  }
  function zoom(factor: number) {
    const next = zoomCamera(target.current ?? camera.current, factor);
    stop();
    if (reduceMotion.current) { camera.current = next; paint(); return; }
    const from = camera.current;
    target.current = next;
    progress.setValue(0);
    progress.addListener(({ value }) => {
      camera.current = {
        scale: from.scale + (next.scale - from.scale) * value,
        x: from.x + (next.x - from.x) * value,
        y: from.y + (next.y - from.y) * value,
      };
      paint();
    });
    animation.current = Animated.timing(progress, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.current.start(({ finished }) => {
      if (finished) { camera.current = next; target.current = null; paint(); }
    });
  }
  function measure() {
    // Match touch.pageX/pageY, including a sheet's own React root coordinates.
    viewport.current?.measure((_left, _top, width, height, x, y) => {
      if (width > 0 && height > 0) bounds.current = { x, y, width, height };
    });
  }
  const responder = useMemo(() => {
    function sample(event: GestureResponderEvent) {
      const touches = event.nativeEvent.touches.slice(0, 2);
      if (!touches.length) return null;
      const [a, b = a] = touches;
      const rect = bounds.current;
      return {
        point: { x: ((a.pageX + b.pageX) / 2 - rect.x) * MAP_WIDTH / rect.width, y: ((a.pageY + b.pageY) / 2 - rect.y) * MAP_HEIGHT / rect.height },
        distance: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY),
        pointers: touches.map(t => t.identifier).sort().join(','),
      };
    }
    let anchor: ReturnType<typeof sample> = null;
    let initial = DEFAULT_CAMERA;
    function rebase(event: GestureResponderEvent) { anchor = sample(event); initial = camera.current; }
    function finish() { flush(); anchor = null; ignorePressUntil.current = Date.now() + 150; }
    return PanResponder.create({
      onMoveShouldSetPanResponder: (event, gesture) => event.nativeEvent.touches.length > 1 || (camera.current.scale > 1 && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 6),
      onPanResponderGrant: event => { stop(); ignorePressUntil.current = Infinity; rebase(event); },
      onPanResponderMove: event => {
        const current = sample(event);
        if (!current) return;
        if (!anchor || current.pointers !== anchor.pointers) { rebase(event); return; }
        const ratio = anchor.distance > 0 ? current.distance / anchor.distance : 1;
        camera.current = moveCamera(initial, anchor.point, current.point, initial.scale * ratio);
        if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; paint(); });
      },
      onPanResponderStart: rebase,
      onPanResponderEnd: rebase,
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
      onPanResponderTerminationRequest: () => false,
    });
  }, []);

  useEffect(() => { reset(); }, [areaCode]);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) reduceMotion.current = value; });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduceMotion.current = value; });
    return () => { active = false; subscription.remove(); stop(); };
  }, []);

  return { group, viewport, camera, responder, measure, zoom, reset, ignorePressUntil };
}
