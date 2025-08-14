'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/app/student/dashboard/studentContext';
import {
  Camera, StopCircle, QrCode, CheckCircle2, XCircle, FlipHorizontal, SunMedium
} from 'lucide-react';

/** If you're using TS and don't have dom-barcode-detection types */
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

type ScanStatus = 'idle' | 'scanning' | 'submitting' | 'success' | 'error';

export default function StudentAttendanceQR() {
  const params = useParams() as { courseInstanceId?: string };
  const courseInstanceId = params?.courseInstanceId || '';
  const { user } = useUser();
  const studentId = (user?._id || (user as any)?.id || '').toString();

  const [status, setStatus] = useState<ScanStatus>('idle');
  const [msg, setMsg] = useState<string>('');
  const [record, setRecord] = useState<any>(null);

  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(undefined);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);
  const detectorRef = useRef<any | null>(null);

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

  const getAuthToken = () =>
    localStorage.getItem('token_student') ||
    sessionStorage.getItem('token_student') ||
    '';

  const stopStream = useCallback(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setTorchSupported(false);
    setTorchOn(false);
  }, []);

  const stopScanning = useCallback(() => {
    stopStream();
    setStatus(s => (s === 'scanning' ? 'idle' : s));
  }, [stopStream]);

  useEffect(() => {
    return () => stopScanning(); // cleanup on unmount
  }, [stopScanning]);

  const listVideoInputs = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter(d => d.kind === 'videoinput');
    setVideoInputs(cams);
    return cams;
  }, []);

  const pickBackCamera = (cams: MediaDeviceInfo[]) => {
    // Prefer labels that hint back/rear/environment
    const byLabel = cams.find(c =>
      /back|rear|environment/i.test(c.label || '')
    );
    return byLabel?.deviceId || cams[0]?.deviceId;
  };

  const applyTorch = async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    const caps: any = track.getCapabilities?.() || {};
    if (!caps.torch) {
      setTorchSupported(false);
      return;
    }
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] as any });
      setTorchOn(on);
      setTorchSupported(true);
    } catch {
      setTorchSupported(false);
    }
  };

  const startStream = useCallback(
    async (deviceId?: string) => {
      // Stop any existing stream first
      stopStream();

      // Base constraints (aim for back camera, decent resolution)
      let constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: 'environment' as any },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
        audio: false
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            /* some mobile browsers need user gesture; the scan button provides it */
          }
        }

        // After permission, device labels are available → pick the best back cam
        const cams = await listVideoInputs();
        if (!deviceId) {
          const backId = pickBackCamera(cams);
          if (backId && stream.getVideoTracks()[0].getSettings().deviceId !== backId) {
            // Restart explicitly with the back camera
            await startStream(backId);
            return;
          }
          setActiveDeviceId(backId);
        } else {
          setActiveDeviceId(deviceId);
        }

        // Torch support?
        const track = stream.getVideoTracks()[0];
        const caps: any = track.getCapabilities?.() || {};
        setTorchSupported(!!caps.torch);
        setTorchOn(false);
      } catch (err: any) {
        setStatus('error');
        setMsg(err?.message || 'Could not access camera.');
        stopStream();
        throw err;
      }
    },
    [listVideoInputs, stopStream]
  );

  const switchCamera = useCallback(async () => {
    if (!videoInputs.length) return;
    if (!activeDeviceId) {
      await startStream();
      return;
    }
    const idx = videoInputs.findIndex(d => d.deviceId === activeDeviceId);
    const next = videoInputs[(idx + 1) % videoInputs.length];
    if (next) await startStream(next.deviceId);
  }, [videoInputs, activeDeviceId, startStream]);

  const submitToken = useCallback(
    async (rawToken: string) => {
      const auth = getAuthToken();
      if (!auth) {
        setStatus('error');
        setMsg('Auth token missing. Please sign in again.');
        return;
      }
      if (!backend) {
        setStatus('error');
        setMsg('Backend URL not configured (NEXT_PUBLIC_BACKEND_URL).');
        return;
      }

      setStatus('submitting');
      setMsg('Submitting attendance…');

      try {
        const res = await fetch(`${backend}/attendance/scan`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token: rawToken })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus('error');
          setMsg(data?.error || 'Failed to record attendance. Try again.');
          return;
        }
        setStatus('success');
        setRecord(data?.record || null);
        setMsg('Checked in! Your attendance has been recorded as present.');
      } catch (e: any) {
        setStatus('error');
        setMsg(e?.message || 'Network error. Try again.');
      }
    },
    [backend]
  );

  const startScanning = useCallback(async () => {
    if (!('BarcodeDetector' in window)) {
      setStatus('error');
      setMsg('QR scanning not supported in this browser. Use Chrome/Edge/Brave or iOS Safari 16.4+.');
      return;
    }
    const auth = getAuthToken();
    if (!auth) {
      setStatus('error');
      setMsg('Auth token missing. Please sign in again.');
      return;
    }
    setStatus('scanning');
    setMsg('Point your camera at the QR code…');

    await startStream(); // prefer back camera

    try {
      detectorRef.current =
        detectorRef.current || new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch {
      setStatus('error');
      setMsg('Could not initialize QR detector on this device.');
      stopScanning();
      return;
    }

    // Scan loop (~4x/sec)
    tickRef.current = window.setInterval(async () => {
      if (!videoRef.current || !detectorRef.current) return;
      try {
        const codes = await detectorRef.current.detect(videoRef.current);
        if (codes && codes.length > 0) {
          const raw = (codes[0].rawValue || '').toString().trim();
          stopStream();               // stop camera immediately
          setStatus('submitting');    // avoid flashing back to scanning
          await submitToken(raw);     // send token from QR
        }
      } catch {
        // ignore transient detect errors, keep scanning
      }
    }, 250);
  }, [startStream, stopScanning, submitToken]);

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">Take Attendance</h1>
            <p className="text-sm text-gray-600">
              Course: <span className="font-medium break-all">{courseInstanceId || '—'}</span>
            </p>
            <p className="text-sm text-gray-600">
              You: <span className="font-medium break-all">{studentId || '—'}</span>
            </p>
          </div>
          <QrCode className="w-7 h-7 text-indigo-600 shrink-0" />
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={startScanning}
            disabled={status === 'scanning' || status === 'submitting'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Camera className="w-4 h-4" />
            {status === 'scanning' ? 'Scanning…' : 'Scan QR'}
          </button>

          {status === 'scanning' && (
            <>
              <button
                onClick={stopScanning}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                <StopCircle className="w-4 h-4" />
                Stop
              </button>

              {videoInputs.length > 1 && (
                <button
                  onClick={switchCamera}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  <FlipHorizontal className="w-4 h-4" />
                  Flip camera
                </button>
              )}

              {torchSupported && (
                <button
                  onClick={() => applyTorch(!torchOn)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${
                    torchOn ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  <SunMedium className="w-4 h-4" />
                  {torchOn ? 'Torch on' : 'Torch'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Video preview */}
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-black">
          <video
            ref={videoRef}
            className="w-full h-auto object-cover aspect-video sm:aspect-[16/9] bg-black"
            muted
            playsInline
          />
          {/* Overlay frame */}
          {status === 'scanning' && (
            <>
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="w-[70%] max-w-sm aspect-square border-2 border-white/80 rounded-xl shadow-[0_0_0_20000px_rgba(0,0,0,0.35)]" />
              </div>
              {/* Scanning line */}
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="w-[68%] max-w-sm h-[2px] bg-white/90 animate-[scan_2s_ease-in-out_infinite]" />
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        {status !== 'idle' && (
          <div
            className={`rounded-lg p-3 text-sm ${
              status === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : status === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : status === 'submitting'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-gray-50 text-gray-700 border border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {status === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {status === 'error' && <XCircle className="w-4 h-4" />}
              <span>{msg}</span>
            </div>
            {status === 'success' && record && (
              <div className="mt-2 text-xs text-gray-600 grid gap-1">
                <div><span className="font-medium">Status:</span> {record.status}</div>
                {record.markedAt && (
                  <div><span className="font-medium">Marked at:</span> {new Date(record.markedAt).toLocaleString()}</div>
                )}
                {record.session && <div><span className="font-medium">Session:</span> {String(record.session)}</div>}
                {record.via && <div><span className="font-medium">Via:</span> {record.via}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(-40%); opacity: .2; }
          10% { opacity: 1; }
          50% { transform: translateY(40%); opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-40%); opacity: .2; }
        }
      `}</style>
    </div>
  );
}
