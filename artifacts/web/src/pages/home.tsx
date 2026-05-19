import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { SkinAnalysisResult } from "@workspace/api-client-react/src/generated/api.schemas";
import { Loader2, UploadCloud, AlertCircle, CheckCircle2 } from "lucide-react";
import { Layout } from "@/components/layout";

type Step = "upload" | "symptoms" | "analyzing" | "result";

const SYMPTOMS_LIST = ["여드름", "트러블", "건조함", "홍조", "각질", "기타"];

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

  const toggleSymptom = (symptom: string) => {
    setSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleAnalyze = async () => {
    if (!isSignedIn) {
      setLocation("/login");
      return;
    }

    if (!selectedFile) return;

    setStep("analyzing");

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("image", selectedFile);
      if (symptoms.length > 0) {
        formData.append("symptom", symptoms.join(", "));
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
        description: "피부 분석 중 문제가 발생했습니다. 다시 시도해주세요."
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
        {step === "upload" && (
          <div className="flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="space-y-4 max-w-2xl">
              <h1 className="text-4xl md:text-5xl font-serif text-foreground leading-tight tracking-tight">
                당신의 피부를 위한 <br/>정밀한 AI 진단
              </h1>
              <p className="text-lg text-muted-foreground font-light">
                스마트폰 사진 한 장으로 시작하는 퍼스널 스킨케어 컨설팅.<br/>
                피부과 전문의의 시선으로 당신의 피부 상태를 분석합니다.
              </p>
            </div>

            <Card className="w-full max-w-xl border-dashed border-2 bg-card/50 hover:bg-card/80 transition-colors">
              <CardContent className="p-12 flex flex-col items-center justify-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <UploadCloud size={40} strokeWidth={1.5} />
                </div>
                <div className="space-y-2 text-center">
                  <h3 className="text-xl font-medium">피부 사진 업로드</h3>
                  <p className="text-sm text-muted-foreground">
                    자연광에서 화장기 없는 얼굴을 선명하게 찍어주세요.
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
                  size="lg" 
                  className="rounded-full px-8" 
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload"
                >
                  사진 선택하기
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "symptoms" && previewUrl && (
          <div className="flex flex-col md:flex-row gap-8 animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="w-full md:w-1/2 space-y-4">
              <div className="aspect-[3/4] relative rounded-2xl overflow-hidden border bg-muted shadow-sm">
                <img src={previewUrl} alt="Selected skin" className="object-cover w-full h-full" />
                <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-2xl pointer-events-none"></div>
              </div>
              <Button variant="outline" className="w-full" onClick={resetFlow}>
                다시 찍기
              </Button>
            </div>
            
            <div className="w-full md:w-1/2 space-y-8 py-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-serif text-foreground">신경 쓰이는 증상</h2>
                <p className="text-muted-foreground">해당하는 증상을 모두 선택해주세요.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {SYMPTOMS_LIST.map(symptom => (
                  <div key={symptom} className="flex items-center space-x-2 bg-card border rounded-lg p-4 shadow-sm hover:border-primary/50 transition-colors">
                    <Checkbox 
                      id={`symptom-${symptom}`} 
                      checked={symptoms.includes(symptom)}
                      onCheckedChange={() => toggleSymptom(symptom)}
                      data-testid={`checkbox-symptom-${symptom}`}
                    />
                    <Label htmlFor={`symptom-${symptom}`} className="text-base cursor-pointer flex-1">{symptom}</Label>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t">
                <Button 
                  size="lg" 
                  className="w-full h-14 text-lg rounded-xl shadow-md" 
                  onClick={handleAnalyze}
                  data-testid="button-analyze"
                >
                  {isSignedIn ? "정밀 분석 시작" : "로그인하고 분석 시작"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "analyzing" && previewUrl && (
          <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in duration-500">
            <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-primary/20 shadow-xl">
              <img src={previewUrl} alt="Analyzing" className="object-cover w-full h-full opacity-50" />
              <div className="absolute inset-0 bg-primary/10"></div>
              <div className="absolute inset-0 border-t-4 border-primary rounded-full animate-spin"></div>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-serif text-foreground animate-pulse">피부 상태 분석 중...</h2>
              <p className="text-muted-foreground">수만 건의 임상 데이터를 바탕으로 진단하고 있습니다.</p>
            </div>
          </div>
        )}

        {step === "result" && result && previewUrl && (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 fade-in duration-700">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-serif text-foreground">분석 결과 리포트</h2>
              <p className="text-muted-foreground">고객님의 피부 상태에 대한 정밀 분석 결과입니다.</p>
            </div>

            <Card className="overflow-hidden border-0 shadow-lg bg-card">
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-1/3 bg-muted">
                  <img src={previewUrl} alt="Analyzed skin" className="object-cover w-full h-full min-h-[300px]" />
                </div>
                <div className="w-full md:w-2/3 p-8 md:p-10 space-y-8">
                  
                  <div className="space-y-2">
                    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground">
                      주요 발견 사항
                    </div>
                    <h3 className="text-3xl font-serif font-medium text-foreground">{result.disease}</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-muted-foreground">심각도</span>
                      <span className="font-medium text-foreground">Level {result.severity} / 5</span>
                    </div>
                    <div className="flex gap-1 h-3">
                      {[1, 2, 3, 4, 5].map(level => (
                        <div 
                          key={level} 
                          className={`flex-1 rounded-full ${level <= result.severity ? 'bg-primary' : 'bg-primary/20'}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="prose prose-sm md:prose-base prose-p:leading-relaxed text-foreground/90">
                    <p>{result.description}</p>
                  </div>

                  {result.needsHospital && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5 flex items-start gap-4">
                      <AlertCircle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                      <div className="space-y-1 text-destructive-foreground">
                        <h4 className="font-medium text-destructive">피부과 전문의 진료 권장</h4>
                        <p className="text-sm opacity-90">{result.hospitalReason}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-medium text-lg text-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      맞춤형 케어 솔루션
                    </h4>
                    <ul className="space-y-3">
                      {result.recommendations.map((rec, i) => (
                        <li key={i} className="flex gap-3 text-foreground/80 bg-background rounded-lg p-4 border shadow-sm">
                          <span className="font-serif font-bold text-primary/50">{i + 1}.</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>
              </div>
            </Card>

            <div className="flex justify-center pt-8">
              <Button variant="outline" size="lg" className="rounded-full px-8" onClick={resetFlow}>
                새로운 사진으로 다시 분석하기
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
