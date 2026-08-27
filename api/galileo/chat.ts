import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed." });
  }

  try {
    const API_KEY = process.env.GALILEO_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({
        reply: "GALILEO_API_KEY is not configured.",
      });
    }

    const { message, context } = req.body ?? {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        reply: "Message is required.",
      });
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const modelName =
      process.env.GALILEO_MODEL || "gemini-3.6-flash";

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
      response.text ??
      "I wasn't able to generate a response. Try again.";

    return res.status(200).json({ reply });
  } catch (error: unknown) {
    console.error("GALILEO chat error:", error);

    const errMsg =
      error instanceof Error
        ? error.message
        : "Unknown error occurred";

    return res.status(500).json({
      reply: `Error communicating with GALILEO: ${errMsg}`,
    });
  }
}

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
    `- NEVER output LaTeX commands or backslashes.\n` +
    `- NEVER use dollar signs around equations.\n` +
    `- Always use clean standard Unicode symbols for math and physics.\n` +
    `- Format key concepts with bold and organize steps with bullet points.`;

  if (context?.experimentId) {
    prompt += `\n\nCurrent experiment: ${
      context.experimentTitle || context.experimentId
    }`;

    if (context.aim) {
      prompt += `\nAim: ${context.aim}`;
    }

    if (context.sessionStatus) {
      prompt += `\nSession status: ${context.sessionStatus}`;
    }

    if (
      context.validationMessages &&
      context.validationMessages.length > 0
    ) {
      prompt += `\nSetup or validation warnings: ${JSON.stringify(
        context.validationMessages
      )}`;
    }

    if (context.apparatusValues) {
      prompt += `\nCurrent apparatus settings: ${JSON.stringify(
        context.apparatusValues
      )}`;
    }

    if (context.observations?.length) {
      prompt += `\nRecorded observations (${
        context.observations.length
      } readings): ${JSON.stringify(
        context.observations.slice(-10)
      )}`;
    }

    if (context.scientificResult) {
      prompt += `\nCurrent engine-derived scientific result and validation: ${JSON.stringify(
        context.scientificResult
      )}`;
    }

    if (context.aiVerbosity) {
      prompt += `\nTone: ${
        context.aiVerbosity === "detailed"
          ? "Pedagogical and detailed step-by-step"
          : "Concise and direct scientific briefing"
      }`;
    }
  }

  return prompt;
}