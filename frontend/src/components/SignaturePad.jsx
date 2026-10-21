import React, { useRef, useEffect } from 'react';

/**
 * A draw-to-sign pad, not a text field — mouse or touch, exactly like
 * signing on a screen. Produces a PNG data URL (what the backend expects
 * for embedding a real signature image into the exported Word doc).
 */
export default function SignaturePad({ id, label, value, disabled, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  // Redraw whatever's already saved (e.g. reloading the form) whenever the
  // value or edit-lock state changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (value && value.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
    }
  }, [value, disabled]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const start = (e) => {
    if (disabled) return;
    e.preventDefault();
    drawing.current = true;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#16233F';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  const hasSignature = value && value.startsWith('data:image');

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`sig-pad${disabled ? ' sig-pad--disabled' : ''}`}>
        <canvas
          ref={canvasRef}
          id={id}
          width={340}
          height={90}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
        {!disabled && !hasSignature && <span className="sig-pad-hint">Sign here</span>}
      </div>
      {!disabled && (
        <button type="button" className="sig-clear-btn" onClick={clear}>Clear signature</button>
      )}
    </div>
  );
}