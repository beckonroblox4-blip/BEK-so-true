// BEK AI — серверлік функция (Vercel). API кілті тек осында, Environment Variable ішінде тұрады.
const SYS = "Сен — BEK AI, пайдалы және мейірімді ИИ ассистентсің. Пайдаланушы қай тілде жазса, сол тілде жауап бер (әдетте қазақша). Жауапты қысқа, нақты және түсінікті жаз. Өзіңді әрдайым BEK AI деп таныстыр; өзіңнің технологиялық негізің туралы егжей-тегжей айтпа.";
const MODEL = process.env.MODEL || "claude-haiku-5-5";
const hits = new Map();
const WINDOW = 10 * 60 * 1000, MAX_REQ = 20;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Рұқсат жоқ" });

  // IP бойынша қарапайым лимит (10 минутта 20 сұрау)
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const arr = (hits.get(ip) || []).filter(function (t) { return now - t < WINDOW; });
  if (arr.length >= MAX_REQ) return res.status(429).json({ error: "Тым жиі сұрау жіберілді, сәл күтіңіз." });
  arr.push(now); hits.set(ip, arr);

  var messages = req.body && req.body.messages;
  if (!Array.isArray(messages)) return res.status(400).json({ error: "Қате сұрау" });
  messages = messages.slice(-20).map(function (m) {
    return { role: m && m.role === "assistant" ? "assistant" : "user", content: String((m && m.content) || "").slice(0, 4000) };
  });
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "Қате сұрау" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 800, system: SYS, messages: messages })
    });
    const data = await r.json();
    if (!r.ok) { console.error("API error", r.status, JSON.stringify(data)); return res.status(502).json({ error: "Сервер қазір қолжетімсіз. Кейін қайта көріңіз." }); }
    const text = (data.content || []).map(function (c) { return c.type === "text" ? c.text : ""; }).join("");
    return res.status(200).json({ text: text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Қате шықты. Қайта көріңіз." });
  }
};
