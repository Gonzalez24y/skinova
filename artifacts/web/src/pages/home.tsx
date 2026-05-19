import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { SkinAnalysisResult } from "@workspace/api-client-react/src/generated/api.schemas";
import { Loader2, UploadCloud, AlertCircle, CheckCircle2, ImagePlus, Camera } from "lucide-react";
import { Layout } from "@/components/layout";
import FaceCamera from "@/components/FaceCamera";

type Step = "upload" | "camera" | "symptoms" | "analyzing" | "result";

const SYMPTOMS_LIST = [
  { id: "acne", label: "여드름" },
  { id: "trouble", label: "트러블" },
  { id: "dryness", label: "건조함" },
  { id: "other", label: "기타" },
];

const SEVERITY_LABELS = ["", "매우 경미", "경미", "보통", "심각", "매우 심각"];
const SEVERITY_COLORS = ["", "#4CAF50", "#8BC34A", "#FFC107", "#FF9800", "#F44336"];

export default function Home() {
  const [, setLocation] = useLocation();
  const { isSignedIn, getToken } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [result, setResult] = useState<SkinAnalysisResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setStep("symptoms");
    }
  };

  const handleCameraCapture = (file: File, preview: string) => {
    setSelectedFile(file);
    setPreviewUrl(preview);
    setStep("symptoms");
  };

  const toggleSymptom = (id: string) => {
    setSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleAnalyze = async (skipSymptoms = false) => {
    if (!isSignedIn) {
      setLocation("/login");
      return;
    }
    if (!selectedFile) return;

    const activeSymptoms = skipSymptoms ? [] : symptoms;
    setStep("analyzing");

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("image", selectedFile);
      if (activeSymptoms.length > 0) {
        formData.append("symptom", activeSymptoms.join(", "));
      }

      const res = await fetch("/api/skin/analyze", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.status === 401) {
        setLocation("/login");
        return;
      }
      if (res.status === 402) {
        setLocation("/pricing");
        return;
      }
      if (!res.ok) {
        throw new Error("분석에 실패했습니다");
      }

      const data = await res.json();
      setResult(data);
      setStep("result");
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "오류 발생",
        description: "피부 분석 중 문제가 발생했습니다. 다시 시도해주세요.",
      });
      setStep("symptoms");
    }
  };

  const resetFlow = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSymptoms([]);
    setResult(null);
    setStep("upload");
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-3xl">

        {/* ── UPLOAD ── */}
        {step === "upload" && (
          <div className="flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="space-y-4 max-w-2xl">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <UploadCloud size={40} strokeWidth={1.5} className="text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-serif text-foreground leading-tight tracking-tight">
                당신의 피부를 위한<br />정밀한 AI 진단
              </h1>
              <p className="text-lg text-muted-foreground font-light">
                스마트폰 사진 한 장으로 시작하는 퍼스널 스킨케어 컨설팅.<br />
                피부과 전문의의 시선으로 당신의 피부 상태를 분석합니다.
              </p>
            </div>

            {/* AI 얼굴 스캔 (메인) */}
            <Card className="w-full max-w-xl border-2 border-primary/30 bg-gradient-to-b from-primary/5 to-card/80 hover:border-primary/50 transition-all cursor-pointer"
              onClick={() => setStep("camera")}
            >
              <CardContent className="p-10 flex flex-col items-center justify-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera size={32} strokeWidth={1.5} className="text-primary" />
                </div>
                <div className="space-y-2 text-center">
                  <h3 className="text-xl font-medium">AI 얼굴 스캔</h3>
                  <p className="text-sm text-muted-foreground">
                    정면 · 왼쪽 · 오른쪽 3방향 자동 촬영으로<br />더 정밀한 피부 분석을 받으세요.
                  </p>
                </div>
                <Button size="lg" className="rounded-full px-8 gap-2" data-testid="button-camera">
                  <Camera size={18} />
                  얼굴 스캔 시작
                </Button>
              </CardContent>
            </Card>

            {/* 구분선 */}
            <div className="flex items-center gap-3 w-full max-w-xl">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">또는</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* 갤러리 업로드 (서브) */}
            <Card className="w-full max-w-xl border-dashed border-2 bg-card/50 hover:bg-card/80 transition-colors">
              <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
                <div className="space-y-1 text-center">
                  <h3 className="text-lg font-medium">갤러리에서 사진 선택</h3>
                  <p className="text-xs text-muted-foreground">
                    이미 찍어둔 사진이 있다면 업로드하세요.
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  data-testid="input-file"
                />
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full px-8 gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload"
                >
                  <ImagePlus size={18} />
                  갤러리에서 선택
                </Button>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              AI 기반 피부 분석 · 전문의 진단 대체 불가
            </p>
          </div>
        )}

        {/* ── CAMERA (FaceCamera fullscreen) ── */}
        {step === "camera" && (
          <FaceCamera
            onCapture={handleCameraCapture}
            onClose={() => setStep("upload")}
          />
        )}

        {/* ── SYMPTOMS ── */}
        {step === "symptoms" && previewUrl && (
          <div className="flex flex-col md:flex-row gap-8 animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="w-full md:w-1/2 space-y-4">
              <div className="aspect-[3/4] relative rounded-2xl overflow-hidden border bg-muted shadow-sm">
                <img
                  src={previewUrl}
                  alt="Selected skin"
                  className="object-cover w-full h-full"
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-2xl pointer-events-none" />
              </div>
              <Button variant="outline" className="w-full" onClick={resetFlow}>
                다시 찍기
              </Button>
            </div>

            <div className="w-full md:w-1/2 space-y-6 py-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-serif text-foreground">
                  신경 쓰이는 증상을<br />골라주세요
                </h2>
                <p className="text-muted-foreground text-sm">여러 개 선택 가능</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {SYMPTOMS_LIST.map((s) => {
                  const selected = symptoms.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSymptom(s.id)}
                      data-testid={`button-symptom-${s.id}`}
                      className={`
                        relative flex items-center justify-center p-4 rounded-2xl border-2 text-base font-medium
                        transition-all duration-150 cursor-pointer
                        ${selected
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-card border-border text-foreground hover:border-primary/40"
                        }
                      `}
                    >
                      {selected && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle2 size={12} className="text-primary-foreground" />
                        </span>
                      )}
                      {s.label}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3 pt-2 border-t">
                <Button
                  size="lg"
                  className="w-full h-14 text-lg rounded-xl shadow-md gap-2"
                  onClick={() => handleAnalyze(false)}
                  disabled={symptoms.length === 0}
                  data-testid="button-analyze"
                >
                  분석 시작
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => handleAnalyze(true)}
                  data-testid="button-skip-symptoms"
                >
                  증상 없이 바로 분석
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYZING ── */}
        {step === "analyzing" && previewUrl && (
          <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in duration-500">
            <div className="relative w-56 h-56 rounded-full overflow-hidden border-4 border-primary/20 shadow-xl">
              <img
                src={previewUrl}
                alt="Analyzing"
                className="object-cover w-full h-full opacity-60"
              />
              <div className="absolute inset-0 bg-primary/10" />
              <div className="absolute inset-0 border-t-4 border-primary rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-serif text-foreground animate-pulse">
                AI가 피부를 분석 중이에요
              </h2>
              <p className="text-muted-foreground">잠시만 기다려주세요</p>
            </div>
          </div>
        )}

        {/* ── RESULT ── */}
        {step === "result" && result && previewUrl && (
          <div className="space-y-6 animate-in slide-in-from-bottom-8 fade-in duration-700">
            <p className="text-center text-sm text-muted-foreground font-medium tracking-wide uppercase">분석 결과</p>

            {/* Disease card */}
            <Card className="overflow-hidden border shadow-md">
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-1/3 min-h-[200px] bg-muted">
                  <img
                    src={previewUrl}
                    alt="Analyzed"
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="w-full md:w-2/3 p-6 md:p-8 space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">추정 상태</p>
                    <h3 className="text-2xl font-serif font-medium text-foreground">
                      {result.disease}
                    </h3>
                  </div>
                  <p className="text-foreground/80 leading-relaxed text-sm">
                    {result.description}
                  </p>
                </div>
              </div>
            </Card>

            {/* Severity */}
            {result.severity > 0 && (
              <Card className="p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-muted-foreground font-medium">심각도</span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: SEVERITY_COLORS[result.severity] }}
                  >
                    {result.severity}/5 · {SEVERITY_LABELS[result.severity]}
                  </span>
                </div>
                <div className="flex gap-1.5 h-3">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className="flex-1 rounded-full"
                      style={{
                        backgroundColor:
                          level <= result.severity
                            ? SEVERITY_COLORS[result.severity]
                            : "hsl(var(--muted))",
                      }}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* Hospital warning */}
            {result.needsHospital && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5 flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-medium text-destructive">피부과 전문의 진료 권장</h4>
                  <p className="text-sm text-destructive/80">{result.hospitalReason}</p>
                </div>
              </div>
            )}

            {/* Recommendations */}
            <Card className="p-5 space-y-4">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                맞춤 관리법
              </h4>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-foreground/80 bg-background rounded-lg p-3 border shadow-sm text-sm"
                    data-testid={`text-recommendation-${i}`}
                  >
                    <span className="font-serif font-bold text-primary/60">{i + 1}.</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-8"
                onClick={resetFlow}
                data-testid="button-reset"
              >
                새로운 사진으로 다시 분석
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
