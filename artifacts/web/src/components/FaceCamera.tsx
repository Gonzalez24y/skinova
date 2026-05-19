import { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    FaceMesh: any;
  }
}

interface FaceCameraProps {
  onCapture: (file: File, previewUrl: string) => void;
  onClose: () => void;
}

type Phase = "center" | "left" | "right";

const PHASES: { phase: Phase; label: string; step: string }[] = [
  { phase: "center", label: "얼굴을 타원 안에 맞춰주세요", step: "1/3 정면" },
  { phase: "left",   label: "왼쪽으로 천천히 돌려주세요",   step: "2/3 왼쪽" },
  { phase: "right",  label: "오른쪽으로 천천히 돌려주세요",  step: "3/3 오른쪽" },
];

/* ── Dimensions ── */
const OVAL_W = 280;
const OVAL_H = 340;
const HOLD_MS = 700;
const YAW_BUF = 6;
const CENTER_THRESH = 0.08;
const TURN_MIN = 0.06;
const TURN_CAPTURE = 0.80;

/* ── Helpers ── */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

let _audioCtx: AudioContext | null = null;
function hapticTick(freq = 1800, ms = 30) {
  try {
    if (navigator?.vibrate) { navigator.vibrate(ms); return; }
    if (!_audioCtx) _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = _audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = 0.12;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + ms / 1000);
  } catch {/* */}
}

function hapticCapture() {
  try {
    if (navigator?.vibrate) { navigator.vibrate(50); return; }
    if (!_audioCtx) _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = _audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 1200;
    g.gain.value = 0.18;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.08);
  } catch {/* */}
}

function hapticDone() {
  try {
    if (navigator?.vibrate) { navigator.vibrate([80, 40, 80, 40, 80]); return; }
    [0, 0.12, 0.24].forEach((d) => setTimeout(() => hapticTick(2000, 40), d * 1000));
  } catch {/* */}
}

/* ── CSS injected once ── */
const STYLE_ID = "face-camera-styles";
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes fc-flash {
      0%   { opacity: 0.9; }
      100% { opacity: 0; }
    }
    @keyframes fc-pop {
      0%   { transform: scale(0.8); opacity: 0; }
      50%  { transform: scale(1.05); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes ovalPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.5; transform: scale(1.02); }
    }
    @keyframes fc-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

/* ================================================================ */
export default function FaceCamera({ onCapture, onClose }: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef(0);
  const fmRef = useRef<any>(null);
  const cancelRef = useRef(false);
  const phaseRef = useRef(0);
  const holdStart = useRef<number | null>(null);
  const captured = useRef<Blob[]>([]);
  const captureFnRef = useRef<() => void>();
  const yawBuf = useRef<number[]>([]);

  const [status, setStatus] = useState<"loading" | "ready" | "aligned" | "capturing" | "done" | "error">("loading");
  const [pi, setPi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [holdPct, setHoldPct] = useState(0);
  const [faceOk, setFaceOk] = useState(false);
  const [flash, setFlash] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("카메라 준비 중...");

  const cfg = PHASES[pi];

  const stopCamera = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const tryTorch = useCallback(async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const caps = track.getCapabilities?.() as any;
      if (caps?.torch) await track.applyConstraints({ advanced: [{ torch: on } as any] });
    } catch {/* */}
  }, []);

  const snap = useCallback((): Promise<Blob | null> => {
    return new Promise((res) => {
      const v = videoRef.current, cv = canvasRef.current;
      if (!v || !cv) return res(null);
      cv.width = v.videoWidth;
      cv.height = v.videoHeight;
      const ctx = cv.getContext("2d");
      if (!ctx) return res(null);
      ctx.translate(cv.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(v, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      cv.toBlob((b) => res(b), "image/jpeg", 0.92);
    });
  }, []);

  const finish = useCallback(async () => {
    setStatus("done");
    setStatusMsg("촬영 완료!");
    hapticDone();
    stopCamera();
    const blobs = captured.current;
    if (!blobs.length) { onClose(); return; }

    const imgs = await Promise.all(
      blobs.map((b) => new Promise<HTMLImageElement>((r) => {
        const img = new Image();
        img.onload = () => r(img);
        img.src = URL.createObjectURL(b);
      }))
    );

    const W = 1200, H = 900;
    const cvs = document.createElement("canvas");
    cvs.width = W; cvs.height = H;
    const ctx = cvs.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    if (imgs[0]) {
      const s = Math.min(700 / imgs[0].width, H / imgs[0].height);
      const dw = imgs[0].width * s, dh = imgs[0].height * s;
      ctx.drawImage(imgs[0], (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
    if (imgs[1]) {
      const s = Math.min(300 / imgs[1].width, 300 / imgs[1].height);
      const dw = imgs[1].width * s, dh = imgs[1].height * s;
      ctx.drawImage(imgs[1], 20, H - dh - 20, dw, dh);
    }
    if (imgs[2]) {
      const s = Math.min(300 / imgs[2].width, 300 / imgs[2].height);
      const dw = imgs[2].width * s, dh = imgs[2].height * s;
      ctx.drawImage(imgs[2], W - dw - 20, H - dh - 20, dw, dh);
    }

    cvs.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "face-multi.jpg", { type: "image/jpeg" });
      onCapture(file, URL.createObjectURL(blobs[0]));
    }, "image/jpeg", 0.90);
  }, [stopCamera, onCapture, onClose]);

  const doCapture = useCallback(async () => {
    setStatus("capturing");
    setStatusMsg("찰칵! 다음 단계로 이동합니다");
    hapticCapture();
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    const blob = await snap();
    if (blob) captured.current.push(blob);

    const next = phaseRef.current + 1;
    if (next >= PHASES.length) {
      setTimeout(() => finish(), 400);
    } else {
      setTimeout(() => {
        phaseRef.current = next;
        setPi(next);
        holdStart.current = null;
        yawBuf.current = [];
        setHoldPct(0);
        setProgress(0);
        setStatus("ready");
        setStatusMsg(PHASES[next].label);
        hapticTick(1500, 25);
      }, 800);
    }
  }, [snap, finish]);

  captureFnRef.current = doCapture;

  /* ═══════════ INIT ═══════════ */
  useEffect(() => {
    injectStyles();
    cancelRef.current = false;
    captured.current = [];
    phaseRef.current = 0;

    (async () => {
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js");
        if (cancelRef.current) return;

        const W = window as any;
        if (!W.FaceMesh) throw new Error("FaceMesh not loaded");

        const fm = new W.FaceMesh({
          locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
        });
        fm.setOptions({ maxNumFaces: 1, refineLandmarks: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        fmRef.current = fm;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const vid = videoRef.current!;
        vid.srcObject = stream;
        await vid.play();
        setStatus("ready");
        setStatusMsg(PHASES[0].label);

        // Auto torch for dark environments
        setTimeout(() => {
          if (!vid || vid.readyState < 2) return;
          const tc = document.createElement("canvas");
          tc.width = tc.height = 64;
          const tctx = tc.getContext("2d");
          if (!tctx) return;
          tctx.drawImage(vid, 0, 0, 64, 64);
          const d = tctx.getImageData(0, 0, 64, 64).data;
          let sum = 0;
          for (let i = 0; i < d.length; i += 4) sum += d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114;
          if (sum / 4096 < 50) tryTorch(true);
        }, 2000);

        fm.onResults((res: any) => {
          if (cancelRef.current) return;

          if (!res.multiFaceLandmarks?.length) {
            setFaceOk(false);
            holdStart.current = null;
            setHoldPct(0);
            if (status !== "capturing") setStatusMsg("얼굴이 감지되지 않아요");
            return;
          }
          setFaceOk(true);

          const lm = res.multiFaceLandmarks[0];
          const nose = lm[1], le = lm[234], re = lm[454];
          const fw = Math.abs(re.x - le.x);
          if (fw < 0.01) return;

          const rawYaw = (nose.x - le.x) / fw;
          yawBuf.current.push(rawYaw);
          if (yawBuf.current.length > YAW_BUF) yawBuf.current.shift();
          const yaw = yawBuf.current.reduce((a, b) => a + b, 0) / yawBuf.current.length;

          const ph = PHASES[phaseRef.current];
          let prog = 0;
          let atTarget = false;

          if (ph.phase === "center") {
            const dist = Math.abs(yaw - 0.50);
            prog = Math.max(0, Math.min(1, 1 - dist / 0.15));
            atTarget = dist < CENTER_THRESH;
          } else if (ph.phase === "left") {
            const delta = yaw - 0.50;
            prog = Math.max(0, Math.min(1, delta / 0.12));
            atTarget = delta > TURN_MIN && prog >= TURN_CAPTURE;
          } else {
            const delta = 0.50 - yaw;
            prog = Math.max(0, Math.min(1, delta / 0.12));
            atTarget = delta > TURN_MIN && prog >= TURN_CAPTURE;
          }

          setProgress(prog);

          if (atTarget) {
            if (!holdStart.current) {
              holdStart.current = Date.now();
              hapticTick(1800, 20);
              setStatus("aligned");
              setStatusMsg("잘 됐어요! 유지해주세요");
            }
            const hp = Math.min(1, (Date.now() - holdStart.current) / HOLD_MS);
            setHoldPct(hp);
            if (hp >= 1) {
              holdStart.current = null;
              captureFnRef.current?.();
            }
          } else {
            if (holdStart.current) {
              const elapsed = Date.now() - holdStart.current;
              if (prog < 0.5 || elapsed < 150) {
                holdStart.current = null;
                setHoldPct(0);
                setStatus("ready");
                setStatusMsg(PHASES[phaseRef.current].label);
              }
            } else {
              if (prog > 0.4) {
                setStatusMsg("거의 다 됐어요...");
              } else {
                setStatusMsg(PHASES[phaseRef.current].label);
              }
            }
          }
        });

        const loop = async () => {
          if (cancelRef.current) return;
          const v = videoRef.current;
          if (v && v.readyState >= 2) {
            try { await fm.send({ image: v }); } catch {/* */}
          }
          if (!cancelRef.current) animRef.current = requestAnimationFrame(loop);
        };
        animRef.current = requestAnimationFrame(loop);

      } catch (err: any) {
        if (cancelRef.current) return;
        setErrMsg(
          err.name === "NotAllowedError"
            ? "카메라 접근이 거부되었습니다.\n설정에서 카메라 권한을 허용해주세요."
            : `카메라를 시작할 수 없습니다.\n(${err.message || err})`
        );
        setStatus("error");
      }
    })();

    return () => {
      cancelRef.current = true;
      stopCamera();
      try { fmRef.current?.close(); } catch {/* */}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ═══════════ Derived ═══════════ */
  const isAligned = status === "aligned";
  const isCapturing = status === "capturing";
  const isDone = status === "done";

  const borderColor = isDone
    ? "#4CAF50"
    : isAligned || isCapturing
    ? "#E8735A"
    : "rgba(255,255,255,0.4)";

  const borderStyle = isAligned || isCapturing || isDone ? "solid" : "dashed";

  const a = OVAL_W / 2, b = OVAL_H / 2;
  const perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  const progressLen = perimeter * progress;

  /* ═══════════ RENDER ═══════════ */
  if (status === "error") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", background: "#0A0A0A" }}>
        <div style={{ width: 64, height: 64, margin: "0 auto 16px", borderRadius: "50%", background: "rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={32} height={32} fill="none" stroke="#f87171" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p style={{ color: "#fff", fontSize: 18, fontWeight: 500, marginBottom: 8 }}>카메라 오류</p>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 32, whiteSpace: "pre-line", textAlign: "center" }}>{errMsg}</p>
        <button onClick={onClose} style={{ padding: "12px 32px", background: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: 16, border: "none", cursor: "pointer", fontSize: 14 }}>돌아가기</button>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, overflow: "hidden", background: "#0A0A0A" }}>

      {/* Full-screen camera feed */}
      <video
        ref={videoRef}
        playsInline muted autoPlay
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
      />

      {/* Dark overlay with oval cutout */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <svg width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <mask id="ovalMask">
              <rect width="100%" height="100%" fill="white" />
              <ellipse cx="50%" cy="44%" rx={OVAL_W / 2} ry={OVAL_H / 2} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(10,10,10,0.65)" mask="url(#ovalMask)" />
        </svg>
      </div>

      {/* Oval border */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", paddingBottom: "12%" }}>
        <div
          style={{
            position: "relative",
            width: OVAL_W + 4,
            height: OVAL_H + 4,
            borderRadius: "50%",
            border: `3px ${borderStyle} ${borderColor}`,
            transition: "border-color 0.3s, border-style 0.15s",
          }}
        >
          {isAligned && (
            <div style={{
              position: "absolute", inset: -8, borderRadius: "50%", pointerEvents: "none",
              border: "2px solid rgba(232,115,90,0.3)",
              boxShadow: "0 0 30px rgba(232,115,90,0.15)",
              animation: "ovalPulse 1.5s ease-in-out infinite",
            }} />
          )}
          {isDone && (
            <div style={{
              position: "absolute", inset: -8, borderRadius: "50%", pointerEvents: "none",
              border: "2px solid rgba(76,175,80,0.4)",
              boxShadow: "0 0 40px rgba(76,175,80,0.2)",
            }} />
          )}
        </div>
      </div>

      {/* Progress arc */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", paddingBottom: "12%" }}>
        <svg width={OVAL_W + 20} height={OVAL_H + 20} viewBox={`0 0 ${OVAL_W + 20} ${OVAL_H + 20}`}>
          <ellipse cx={(OVAL_W + 20) / 2} cy={(OVAL_H + 20) / 2} rx={OVAL_W / 2 + 6} ry={OVAL_H / 2 + 6} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
          {progress > 0.02 && (
            <ellipse cx={(OVAL_W + 20) / 2} cy={(OVAL_H + 20) / 2} rx={OVAL_W / 2 + 6} ry={OVAL_H / 2 + 6} fill="none"
              stroke={isAligned ? "#E8735A" : "rgba(232,115,90,0.5)"} strokeWidth={3.5} strokeLinecap="round"
              strokeDasharray={`${progressLen} ${perimeter}`} strokeDashoffset={perimeter * 0.25}
              style={{ transition: "stroke-dasharray 0.15s, stroke 0.3s" }}
            />
          )}
          {holdPct > 0 && (
            <ellipse cx={(OVAL_W + 20) / 2} cy={(OVAL_H + 20) / 2} rx={OVAL_W / 2 + 6} ry={OVAL_H / 2 + 6} fill="none"
              stroke="#E8735A" strokeWidth={4} strokeLinecap="round"
              strokeDasharray={`${perimeter * holdPct} ${perimeter}`} strokeDashoffset={perimeter * 0.25}
              style={{ transition: "stroke-dasharray 0.08s linear" }}
            />
          )}
        </svg>
      </div>

      {/* Step label */}
      <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", pointerEvents: "none", top: "calc(44% - 200px)" }}>
        <span style={{
          display: "inline-block", padding: "6px 16px", borderRadius: 999, fontSize: 12, fontWeight: 600, letterSpacing: "0.05em",
          background: isAligned ? "rgba(232,115,90,0.2)" : "rgba(255,255,255,0.1)",
          color: isAligned ? "#E8735A" : "rgba(255,255,255,0.7)",
          transition: "all 0.3s",
        }}>
          {cfg.step}
        </span>
      </div>

      {/* Status message */}
      <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", padding: "0 32px", pointerEvents: "none", top: "calc(44% + 190px)" }}>
        <p style={{
          fontSize: 16, fontWeight: 500, transition: "all 0.3s",
          color: isDone ? "#4CAF50"
            : isAligned || isCapturing ? "#E8735A"
            : !faceOk && status !== "loading" ? "rgba(255,200,50,0.8)"
            : "rgba(255,255,255,0.9)",
        }}>
          {statusMsg}
        </p>
        {holdPct > 0 && holdPct < 1 && (
          <div style={{ marginTop: 16, marginLeft: "auto", marginRight: "auto", width: 192, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 999, width: `${holdPct * 100}%`, background: "#E8735A", transition: "width 0.08s linear" }} />
          </div>
        )}
      </div>

      {/* Cancel button */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: 32, textAlign: "center" }}>
        <button
          onClick={() => { stopCamera(); onClose(); }}
          style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 500, padding: "12px 32px", background: "none", border: "none", cursor: "pointer" }}
        >
          취소
        </button>
      </div>

      {/* Loading spinner */}
      {status === "loading" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          <div style={{ width: 48, height: 48, border: "4px solid rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.8)", borderRadius: "50%", animation: "fc-spin 1s linear infinite" }} />
        </div>
      )}

      {/* Flash */}
      {flash && (
        <div style={{ position: "absolute", inset: 0, zIndex: 40, background: "#fff", pointerEvents: "none", animation: "fc-flash 0.15s ease-out forwards" }} />
      )}

      {/* Done overlay */}
      {isDone && (
        <div style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,10,10,0.85)" }}>
          <div style={{ textAlign: "center", animation: "fc-pop 0.4s ease-out" }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 16px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(76,175,80,0.15)" }}>
              <svg width={40} height={40} fill="none" stroke="#4CAF50" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>촬영 완료!</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 4 }}>분석을 시작합니다</p>
          </div>
        </div>
      )}

      {/* Hidden canvas */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
