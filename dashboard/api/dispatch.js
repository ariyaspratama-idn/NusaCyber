export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
  const { token, payload } = req.body;
  if (!token) return res.status(400).json({ message: 'GitHub Token required' });

  try {
    const response = await fetch('https://api.github.com/repos/ariyaspratama-idn/NusaCyber/dispatches', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'NusaCyber-Proxy',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ event_type: 'run-audit', client_payload: payload || {} })
    });

    if (response.status === 204 || response.ok) {
      return res.status(200).json({ success: true, message: 'Audit Dispatch Successful' });
    } else {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }
  } catch (error) {
    return res.status(500).json({ message: 'Proxy Error', error: error.message });
  }
}
