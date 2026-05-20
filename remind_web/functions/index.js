/* eslint-env node */

const {onRequest} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");

setGlobalOptions({
  region: "asia-northeast3",
  maxInstances: 10,
});

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/" +
  "gemini-3.1-flash-lite:generateContent";

const jsonResponse = (response, status, body) => {
  response.status(status).json(body);
};

const getRequestBody = (request) => {
  if (request.body && typeof request.body === "object") return request.body;
  try {
    return JSON.parse(request.rawBody?.toString() || "{}");
  } catch {
    return {};
  }
};

const callGemini = async (contents) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      status: 500,
      body: {error: "GEMINI_API_KEY not set"},
    };
  }

  const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({contents}),
  });

  const bodyText = await geminiResponse.text();
  if (!geminiResponse.ok) {
    return {
      status: 502,
      body: {error: "Gemini API error", details: bodyText},
    };
  }

  const data = JSON.parse(bodyText || "{}");
  return {
    status: 200,
    body: {
      text: data?.candidates?.[0]?.content?.parts?.[0]?.text || "",
      raw: data,
    },
  };
};

exports.api = onRequest({
  secrets: ["ELEVENLABS_API_KEY", "GEMINI_API_KEY"],
}, async (request, response) => {
  const pathname = request.path || request.url || "";

  if (
    request.method === "GET" &&
    (
      pathname === "/api/elevenlabs/scribe-token" ||
      pathname === "/elevenlabs/scribe-token"
    )
  ) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      jsonResponse(response, 500, {error: "ELEVENLABS_API_KEY not set"});
      return;
    }

    try {
      const tokenResponse = await fetch(
          "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
          {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
            },
          },
      );

      const bodyText = await tokenResponse.text();
      if (!tokenResponse.ok) {
        jsonResponse(response, tokenResponse.status, {error: bodyText});
        return;
      }

      const data = JSON.parse(bodyText || "{}");
      jsonResponse(response, 200, {token: data.token || null});
    } catch (error) {
      jsonResponse(response, 500, {error: error.message});
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/gemini/caption") {
    const {customPrompt} = getRequestBody(request);
    if (!customPrompt) {
      jsonResponse(response, 400, {error: "customPrompt required"});
      return;
    }

    try {
      const result = await callGemini([
        {parts: [{text: customPrompt}]},
      ]);
      jsonResponse(response, result.status, result.body);
    } catch (error) {
      jsonResponse(response, 500, {error: error.message});
    }
    return;
  }

  if (
    request.method === "POST" &&
    (pathname === "/api/gemini/evaluate" || pathname === "/api/gemini/hint")
  ) {
    const {prompt} = getRequestBody(request);
    if (!prompt) {
      jsonResponse(response, 400, {error: "prompt required"});
      return;
    }

    try {
      const result = await callGemini([
        {parts: [{text: prompt}]},
      ]);
      jsonResponse(response, result.status, result.body);
    } catch (error) {
      jsonResponse(response, 500, {error: error.message});
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/gemini/chat") {
    const body = getRequestBody(request);
    const {message, history, systemPrompt} = body;
    if (!message) {
      jsonResponse(response, 400, {error: "message required"});
      return;
    }

    const safeHistory = Array.isArray(history) ? history : [];
    const contents = [
      ...(systemPrompt ? [
        {role: "user", parts: [{text: systemPrompt}]},
        {role: "model", parts: [{text: "네, 알겠습니다."}]},
      ] : []),
      ...safeHistory,
      {role: "user", parts: [{text: message}]},
    ];

    try {
      const result = await callGemini(contents);
      jsonResponse(response, result.status, result.body);
    } catch (error) {
      jsonResponse(response, 500, {error: error.message});
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/gemini/analyze") {
    const {imageBase64, userDescription} = getRequestBody(request);
    if (!imageBase64) {
      jsonResponse(response, 400, {error: "imageBase64 required"});
      return;
    }

    const prompt = [
      "사진과 보호자 설명을 분석하여 회상 대화에 필요한 정보를",
      "JSON 형식으로 추출해주세요.",
      `보호자 설명: ${userDescription || "(설명 없음)"}`,
    ].join("\n");

    try {
      const result = await callGemini([
        {
          parts: [
            {inlineData: {mimeType: "image/jpeg", data: imageBase64}},
            {text: prompt},
          ],
        },
      ]);
      jsonResponse(response, result.status, result.body);
    } catch (error) {
      jsonResponse(response, 500, {error: error.message});
    }
    return;
  }

  jsonResponse(response, 404, {error: "Not found"});
});
