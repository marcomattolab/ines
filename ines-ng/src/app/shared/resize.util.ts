/**
 * Attaches document-level mouse listeners to track a drag-resize gesture.
 * Returns a dispose function that removes the listeners (call on component destroy).
 */
export function trackDragResize(
  startEvent: MouseEvent,
  onMove: (event: MouseEvent) => void,
  onEnd?: () => void,
): () => void {
  startEvent.preventDefault();

  const onMouseMove = (event: MouseEvent) => onMove(event);
  const dispose = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  const onMouseUp = () => {
    dispose();
    onEnd?.();
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  return dispose;
}
