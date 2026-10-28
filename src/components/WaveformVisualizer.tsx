import React, { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  isRecording: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  analyserNode: AnalyserNode | null;
  audioBuffer: AudioBuffer | null;
  onSeek?: (time: number) => void;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  isRecording,
  isPlaying,
  currentTime,
  duration,
  analyserNode,
  audioBuffer,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isDestroyed = false;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    const width = rect.width || 320;
    const height = rect.height || 100;
    const centerY = height / 2;

    const render = () => {
      if (isDestroyed) return;

      ctx.clearRect(0, 0, width, height);

      // Subtle background grid/ambient line
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      if (isRecording && analyserNode) {
        // Live recording visualizer: Time-domain Oscilloscope + Frequency glow
        const bufferLength = analyserNode.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteTimeDomainData(dataArray);

        // Draw glowing neon waveform
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#ec4899'); // Neon Pink
        gradient.addColorStop(0.5, '#a855f7'); // Purple
        gradient.addColorStop(1, '#06b6d4'); // Cyan

        ctx.lineWidth = 3;
        ctx.strokeStyle = gradient;
        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      } else if (isPlaying && analyserNode) {
        // Active playback: Combined frequency bars + waveform
        const freqLength = analyserNode.frequencyBinCount;
        const freqArray = new Uint8Array(freqLength);
        analyserNode.getByteFrequencyData(freqArray);

        // Draw frequency bars in background
        const numBars = 48;
        const barWidth = width / numBars - 2;
        const step = Math.floor(freqLength / numBars);

        for (let i = 0; i < numBars; i++) {
          const value = freqArray[i * step] || 0;
          const barHeight = (value / 255) * (height * 0.75);

          const barGrad = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
          barGrad.addColorStop(0, '#f43f5e');
          barGrad.addColorStop(0.5, '#c084fc');
          barGrad.addColorStop(1, '#818cf8');

          ctx.fillStyle = barGrad;
          ctx.beginPath();
          const bx = i * (barWidth + 2);
          const by = centerY - barHeight / 2;
          ctx.roundRect ? ctx.roundRect(bx, by, barWidth, barHeight, 2) : ctx.rect(bx, by, barWidth, barHeight);
          ctx.fill();
        }

        // Playhead indicator
        if (duration > 0) {
          const progress = Math.min(1, Math.max(0, currentTime / duration));
          const headX = progress * width;

          // Glowing vertical cursor
          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = 8;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(headX, 0);
          ctx.lineTo(headX, height);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      } else if (audioBuffer) {
        // Static rendered waveform
        const rawData = audioBuffer.getChannelData(0);
        const numPoints = 80;
        const step = Math.floor(rawData.length / numPoints);
        const barWidth = width / numPoints - 2;
        const progress = duration > 0 ? currentTime / duration : 0;
        const headX = progress * width;

        for (let i = 0; i < numPoints; i++) {
          let maxVal = 0;
          const startIdx = i * step;
          for (let j = 0; j < step; j += 4) {
            const v = Math.abs(rawData[startIdx + j] || 0);
            if (v > maxVal) maxVal = v;
          }

          const barHeight = Math.max(4, maxVal * height * 0.82);
          const bx = i * (barWidth + 2);
          const by = centerY - barHeight / 2;

          const isPlayed = bx <= headX;
          if (isPlayed) {
            ctx.fillStyle = '#ec4899';
          } else {
            ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
          }

          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(bx, by, barWidth, barHeight, 2) : ctx.rect(bx, by, barWidth, barHeight);
          ctx.fill();
        }

        // Draw cursor line
        if (duration > 0 && currentTime > 0) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(headX, 0);
          ctx.lineTo(headX, height);
          ctx.stroke();
        }
      } else {
        // Idle placeholder gentle sine wave animation
        const time = Date.now() * 0.002;
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < width; x += 3) {
          const y = centerY + Math.sin(x * 0.04 + time) * 10 * Math.sin(x / width * Math.PI);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      if (isRecording || isPlaying || !audioBuffer) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      isDestroyed = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isRecording, isPlaying, currentTime, duration, analyserNode, audioBuffer]);

  // Click or drag to seek
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || !audioBuffer || duration <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-purple-500/20 bg-[#120d26]/80 p-3 shadow-inner backdrop-blur-md">
      <div className="flex items-center justify-between text-xs text-purple-200/70 pb-2 font-mono tabular-nums">
        <span className="flex items-center gap-1.5">
          {isRecording ? (
            <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              Enregistrement micro en direct...
            </span>
          ) : isPlaying ? (
            <span className="text-fuchsia-300 font-medium">Lecture en cours</span>
          ) : audioBuffer ? (
            <span className="text-slate-400">Clique pour naviguer</span>
          ) : (
            <span className="text-slate-500">En attente de voix</span>
          )}
        </span>
        <span>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className={`w-full h-24 rounded-lg bg-black/30 touch-none ${
          audioBuffer ? 'cursor-pointer' : 'cursor-default'
        }`}
      />
    </div>
  );
};

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const centis = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis}`;
}
