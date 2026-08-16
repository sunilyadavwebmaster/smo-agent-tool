import { checkPassword, setAuthCookie } from "../../lib/auth";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { password } = req.body || {};
  try {
    if (!checkPassword(password)) {
      return res.status(401).json({ error: "Wrong password" });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
  setAuthCookie(res);
  return res.status(200).json({ ok: true });
}
