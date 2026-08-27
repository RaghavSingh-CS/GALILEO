import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.GALILEO_PORT || 4000;
const API_KEY = process.env.GALILEO_API_KEY;

if (!API_KEY) {
  console.warn(
    "\n⚠  GALILEO_API_KEY not set. Chat endpoint will return an error.\n" +
      "   Set it in .env: GALILEO_API_KEY=your_gemini_api_key\n"
  );
}

app.get("/api/galileo/health", (req, res) => {
  if (API_KEY) {
    res.json({ status: "connected" });
  } else {
    res.json({ status: "disconnected" });
  }
});

app.post("/api/galileo/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        reply:
          "GALILEO_API_KEY is not configured. Please set it in your .env file.",
      });
    }

    const { message, context } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ reply: "Message is required." });
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const modelName = process.env.GALILEO_MODEL || "gemini-3.6-flash";
    const systemInstruction = buildSystemPrompt(context);

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [{ text: message }],
        },
      ],
      config: {
        systemInstruction,
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    });

    const reply =
      response.text ?? "I wasn't able to generate a response. Try again.";

    return res.json({ reply });
  } catch (error: unknown) {
    console.error("GALILEO chat error:", error);
    const errMsg =
      error instanceof Error ? error.message : "Unknown error occurred";
    return res.status(500).json({
      reply: `Error communicating with GALILEO: ${errMsg}`,
    });
  }
});

function buildSystemPrompt(
  context?: {
    experimentId?: string;
    experimentTitle?: string;
    aim?: string;
    sessionStatus?: string;
    validationMessages?: string[];
    apparatusValues?: Record<string, number>;
    observations?: Array<{
      inputs: Record<string, number>;
      outputs: Record<string, number>;
    }>;
    scientificResult?: Record<string, unknown>;
    aiVerbosity?: string;
  }
): string {
  let prompt =
    `You are GALILEO, an intelligent virtual lab assistant for science experiments.\n` +
    `You help students understand experimental concepts, guide them through procedures, analyze observations, and explain results clearly.\n` +
    `Keep answers concise, clear, and educational.\n` +
    `CRITICAL FORMATTING INSTRUCTIONS:\n` +
    `- NEVER output LaTeX commands or backslashes (do NOT write \\frac, \\propto, \\quad, \\implies, \\text, \\cdot, etc.).\n` +
    `- NEVER use dollar signs ($) around equations.\n` +
    `- Always use clean standard Unicode symbols for math and physics (e.g., ∝, ⟹, →, ·, ×, ÷, ±, Ω, µ, Δ, ², ³, ⁻³, 10⁻³, etc.).\n` +
    `- Write equations in clean plain text, for example: "V ∝ I ⟹ V = I · R ⟹ R = V / I" and "1 mA = 10⁻³ A".\n` +
    `- Format key concepts with bold (**concept**) and organize steps with bullet points.`;

  if (context?.experimentId) {
    prompt += `\n\nCurrent experiment: ${context.experimentTitle || context.experimentId}`;
    if (context.aim) {
      prompt += `\nAim: ${context.aim}`;
    }
    if (context.sessionStatus) {
      prompt += `\nSession status: ${context.sessionStatus}`;
    }
    if (context.validationMessages && context.validationMessages.length > 0) {
      prompt += `\nSetup or validation warnings: ${JSON.stringify(context.validationMessages)}`;
    }
    if (context.apparatusValues) {
      prompt += `\nCurrent apparatus settings: ${JSON.stringify(context.apparatusValues)}`;
    }
    if (context.observations && context.observations.length > 0) {
      prompt += `\nRecorded observations (${context.observations.length} readings): ${JSON.stringify(context.observations.slice(-10))}`;
    }
    if (context.scientificResult) {
      prompt += `\nCurrent engine-derived scientific result and validation: ${JSON.stringify(context.scientificResult)}`;
    }
    if (context.aiVerbosity) {
      prompt += `\nTone: ${context.aiVerbosity === "detailed" ? "Pedagogical and detailed step-by-step" : "Concise and direct scientific briefing"}`;
    }
  }

  return prompt;
}

app.listen(PORT, () => {
  console.log(`GALILEO proxy server running on http://localhost:${PORT}`);
});
