const SYS = "Сен — BEK AI, пайдалы және мейірімді ИИ ассистентсің. Пайдаланушы қай тілде жазса, сол тілде жауап бер (әдетте қазақша). Жауапты қысқа, нақты және түсінікті жаз. Өзіңді әрдайым BEK AI деп таныстыр; өзіңнің технологиялық негізің туралы егжей-тегжей айтпа.";
const MODEL = process.env.MODEL || "gemini-3.5-flash";
const KEY = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY;
const hits = new Map();
const WINDOW = 10 * 60 * 1000, MAX_REQ = 20;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Рұқсат жоқ" });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const arr = (hits.get(ip) || []).filter(function (t) { return now - t < WINDOW; });
  if (arr.length >= MAX_REQ) return res.status(429).json({ error: "Тым жиі сұрау жіберілді, сәл күтіңіз." });
  arr.push(now); hits.set(ip, arr);

  var messages = req.body && req.body.messages;
  if (!Array.isArray(messages)) return res.status(400).json({ error: "Қате сұрау" });
  messages = messages.slice(-20).map(function (m) {
    return { role: m && m.role === "assistant" ? "model" : "user", parts: [{ text: String((m && m.content) || "").slice(0, 4000) }] };
  });
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "Қате сұрау" });

  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYS }] },
        contents: messages,
        generationConfig: { maxOutputTokens: 800 }
      })
    });
    const data = await r.json();
    if (!r.ok) { console.error("API error", r.status, JSON.stringify(data)); return res.status(502).json({ error: "Сервер қазір қолжетімсіз. Кейін қайта көріңіз." }); }
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const text = parts.map(function (p) { return p.text || ""; }).join("");
    return res.status(200).json({ text: text || "Жауап алынбады. Қайта көріңіз." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Қате шықты. Қайта көріңіз." });
  }
};

