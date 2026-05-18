import { Router } from "express";
import type { Request, Response } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"],
});

router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    const symptom = req.body?.symptom as string | undefined;

    if (!file) {
      res.status(400).json({ error: "이미지를 업로드해주세요." });
      return;
    }

    const base64 = file.buffer.toString("base64");
    const mimeType = file.mimetype || "image/jpeg";

    const symptomContext = symptom
      ? `사용자가 보고한 주요 증상: "${symptom}". 이를 분석에 반영하세요.`
      : "";

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 전문 피부과 AI 어시스턴트입니다. 사용자가 셀카를 보내면 얼굴에 보이는 모든 피부 상태를 꼼꼼히 분석하세요.

여드름, 트러블, 홍조, 건조함, 색소침착, 모공, 주름 등 미세한 것도 관찰하세요.
건강해 보여도 가장 눈에 띄는 피부 특징을 분석해주세요. "식별 불가"라고 하지 마세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "disease": "피부 상태명 (한국어)",
  "severity": 2,
  "description": "분석 설명 (한국어, 2~3문장)",
  "recommendations": ["관리법 1", "관리법 2", "관리법 3"],
  "needsHospital": false,
  "hospitalReason": ""
}

disease: 주요 피부 상태 (예: "경미한 여드름", "건성 피부", "모공 확장", "색소 침착", "건강한 피부")
severity: 1(매우 경미/건강) ~ 5(심각)
description: 관찰 내용 상세 설명 (한국어)
recommendations: 개인화된 스킨케어 팁 3개 (한국어)
needsHospital: 심각한 경우에만 true
hospitalReason: 병원 방문 필요 이유 (한국어, 불필요시 빈 문자열)`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: symptomContext || "이 사진의 피부 상태를 분석해주세요.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.error({ text: text.slice(0, 300) }, "AI response parse failed");
      res.status(502).json({ error: "AI 응답을 파싱할 수 없습니다." });
      return;
    }

    const result = JSON.parse(jsonMatch[0]);
    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Skin analysis error");
    res.status(500).json({ error: "분석 중 오류가 발생했습니다." });
  }
});

export default router;
