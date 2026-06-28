import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

// Encryption constants for storing API keys in SQLite
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "mastering_studio_ai_enc_key_32_bytes_long_!!!"; // Must be 32 bytes
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  if (!text) return "";
  try {
    // Standardize key size to exactly 32 bytes
    const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  } catch (err) {
    console.error("Encryption error:", err);
    return text;
  }
}

export function decrypt(text: string): string {
  if (!text) return "";
  try {
    const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
    const textParts = text.split(":");
    const ivHex = textParts.shift();
    if (!ivHex) return text;
    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    console.error("Decryption error:", err);
    return text;
  }
}

// ponytail: gemini-only; analyze/chat removed (unused), master+critique kept
export class GeminiProvider {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({
      apiKey: apiKey || process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  async master(analysis: any, referenceAnalysis?: any, genre?: string, userIntent?: string): Promise<any> {
    let context = "";
    if (userIntent) {
      context = `The user describes their desired sound as: "${userIntent}".`;
    }
    if (genre) {
      context += ` The music genre is: "${genre}".`;
    }
    if (analysis) {
      context += ` Audio analysis data: ${JSON.stringify(analysis)}`;
    }
    const prompt = `${context}
    Based on this context, generate professional mastering chain settings for our DSP modules (EQ, Multiband Compressor, Limiter, Stereo Imager, Saturation, Noise Reduction).
    
    Format the response as a JSON object matching this structure:
    {
      "eq": {
        "enabled": true,
        "bands": [
          { "id": 1, "type": "highpass", "freq": 30, "q": 0.7, "gain": 0 },
          { "id": 2, "type": "bell", "freq": 60, "q": 1.0, "gain": 1.5 },
          { "id": 3, "type": "bell", "freq": 120, "q": 1.2, "gain": -0.5 },
          { "id": 4, "type": "bell", "freq": 250, "q": 1.0, "gain": -0.8 },
          { "id": 5, "type": "bell", "freq": 500, "q": 1.0, "gain": 0 },
          { "id": 6, "type": "bell", "freq": 1000, "q": 1.0, "gain": 0.5 },
          { "id": 7, "type": "bell", "freq": 3000, "q": 0.8, "gain": 0.8 },
          { "id": 8, "type": "bell", "freq": 6000, "q": 1.0, "gain": 1.2 },
          { "id": 9, "type": "highshelf", "freq": 12000, "q": 0.7, "gain": 1.5 },
          { "id": 10, "type": "lowpass", "freq": 20000, "q": 0.7, "gain": 0 }
        ]
      },
      "compressor": {
        "enabled": true,
        "bands": [
          { "enabled": true, "lowFreq": 20, "highFreq": 120, "thresh": -18, "ratio": 2.5, "attack": 40, "release": 150, "gain": 1.0 },
          { "enabled": true, "lowFreq": 120, "highFreq": 500, "thresh": -20, "ratio": 2.0, "attack": 30, "release": 100, "gain": 0.5 },
          { "enabled": true, "lowFreq": 500, "highFreq": 2500, "thresh": -22, "ratio": 2.0, "attack": 25, "release": 80, "gain": 0.8 },
          { "enabled": true, "lowFreq": 2500, "highFreq": 8000, "thresh": -24, "ratio": 2.2, "attack": 20, "release": 60, "gain": 1.2 },
          { "enabled": true, "lowFreq": 8000, "highFreq": 20000, "thresh": -22, "ratio": 1.8, "attack": 15, "release": 50, "gain": 1.5 }
        ]
      },
      "limiter": {
        "enabled": true,
        "threshold": -10.0,
        "ceiling": -1.0,
        "release": 150,
        "lookahead": 0.005
      },
      "imager": {
        "enabled": true,
        "width": 1.15,
        "pan": 0,
        "midSideMode": false
      },
      "saturation": {
        "enabled": true,
        "type": "tape",
        "drive": 15,
        "mix": 25,
        "bias": 5
      },
      "noiseReduction": {
        "enabled": false,
        "threshold": -60,
        "reduction": 10,
        "type": "spectral"
      },
      "targetLUFS": -14.0,
      "explanation": "Provide a brief explanation of the mastering approach based on the analysis."
    }`;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      return JSON.parse(response.text || "{}");
    } catch (err) {
      console.error("Gemini master error:", err);
      return { explanation: "Fallback standard configuration." };
    }
  }

  async critique(audioMetadata: { name: string; size: number; duration?: number; type?: string }, genre?: string, userIntent?: string): Promise<any> {
    let context = `Analyze this audio file: "${audioMetadata.name}" (${audioMetadata.size} bytes, type: ${audioMetadata.type || "unknown"}).`;
    if (genre) context += ` The user says the genre is: "${genre}".`;
    if (userIntent) context += ` The user's desired outcome: "${userIntent}".`;

    const prompt = `${context}
    Act as a professional mastering engineer. Provide a detailed critique of the potential weaknesses in this mix/master based on the available information. 

    Format the response as a JSON object:
    {
      "overallAssessment": "Brief overall assessment",
      "weaknesses": [
        { "area": "e.g. Low End", "issue": "Description of the problem", "severity": "minor/major/critical", "recommendation": "How to fix it" }
      ],
      "priorityActions": ["List of 3-5 priority actions"],
      "estimatedGenre": "Best guess of the genre based on the filename/context",
      "estimatedTempo": "Best guess of BPM"
    }`;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      return JSON.parse(response.text || "{}");
    } catch (err) {
      console.error("Gemini critique error:", err);
      return {
        overallAssessment: "Could not analyze the audio.",
        weaknesses: [],
        priorityActions: ["Try again later."]
      };
    }
  }

}

// ponytail: gemini-only factory, no providerName dispatch needed
export function getAIProvider(_providerName: string, apiKey: string) {
  const decryptedKey = decrypt(apiKey) || process.env.GEMINI_API_KEY || "";
  return new GeminiProvider(decryptedKey);
}
