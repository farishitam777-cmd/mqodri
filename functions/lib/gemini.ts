export class GeminiProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async master(analysis: any, referenceAnalysis?: any, genre?: string, userIntent?: string): Promise<any> {
    let context = "";
    if (userIntent) context = `The user describes their desired sound as: "${userIntent}".`;
    if (genre) context += ` The music genre is: "${genre}".`;
    if (analysis) context += ` Audio analysis data: ${JSON.stringify(analysis)}`;

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
          { "id": 10, "type": "lowpass", "freq": 20000, "q": 0.7, "gain": 0 },
          { "id": 11, "type": "bell", "freq": 8000, "q": 1.0, "gain": 0.5 },
          { "id": 12, "type": "bell", "freq": 16000, "q": 1.0, "gain": 0 }
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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
      const data: any = await response.json();
      return JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    } catch (err) {
      console.error("Gemini master error:", err);
      return { explanation: "Fallback standard configuration." };
    }
  }

  async critique(
    audioMetadata: { name: string; size: number; duration?: number; type?: string },
    genre?: string,
    userIntent?: string
  ): Promise<any> {
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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
      const data: any = await response.json();
      return JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    } catch (err) {
      console.error("Gemini critique error:", err);
      return { overallAssessment: "Could not analyze the audio.", weaknesses: [], priorityActions: ["Try again later."] };
    }
  }
}

export function getAIProvider(apiKey: string) {
  return new GeminiProvider(apiKey);
}
